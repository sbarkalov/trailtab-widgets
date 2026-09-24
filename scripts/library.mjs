#!/usr/bin/env node
// node scripts/library.mjs build             — regenerate library.json
// node scripts/library.mjs check [--base R]  — verify every widget, the listing and the pin
// node scripts/library.mjs publish            — move pin.json to the current commit
// node scripts/library.mjs allowlist <manifest.json> — refresh allowlist.json
//
// `library.json` is generated, never written by hand: a digest typed by a
// person is a digest that is wrong the first time the file is touched. It is
// still committed, because the extension reads it from a commit and a listing
// that only exists after a build step is not in that commit.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import {
  allowlistFromCsp,
  checkAgainstBase,
  checkMeta,
  checkSource,
  listingEntry,
  renderListing,
  MAX_DATA_BYTES,
} from './lib.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const WIDGETS = join(ROOT, 'widgets')
const LISTING = join(ROOT, 'library.json')
const ALLOWLIST = join(ROOT, 'allowlist.json')
const PIN = join(ROOT, 'pin.json')

// One page and its declaration. A second file of the widget's own is refused
// whatever its size: the byte limit and the one-file rule only mean something
// together.
const EXPECTED_FILES = ['widget.js', 'widget.json']

function readWidgets() {
  const results = []
  for (const dir of readdirSync(WIDGETS, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const path = join(WIDGETS, dir.name)
    const problems = []
    const notes = []
    const files = readdirSync(path).sort()
    const missing = EXPECTED_FILES.filter((f) => !files.includes(f))
    for (const f of missing) problems.push(`missing ${f}`)
    if (missing.length) {
      results.push({ name: dir.name, problems, notes })
      continue
    }

    let meta
    try {
      meta = JSON.parse(readFileSync(join(path, 'widget.json'), 'utf8'))
    } catch (e) {
      problems.push(`widget.json does not parse: ${e.message}`)
      results.push({ name: dir.name, problems, notes })
      continue
    }
    problems.push(...checkMeta(meta, dir.name))

    // The one file beyond the script and its declaration is the data file the
    // declaration names, and only that one.
    const dataName = typeof meta.data === 'string' ? meta.data : null
    const extra = files.filter((f) => !EXPECTED_FILES.includes(f) && f !== dataName)
    for (const f of extra) problems.push(`unexpected file ${f}: a widget is one script, and at most one data file it names`)
    let dataBytes
    if (dataName) {
      if (!files.includes(dataName)) {
        problems.push(`"data" names ${dataName}, which is not in the folder`)
      } else {
        dataBytes = readFileSync(join(path, dataName))
        if (dataBytes.length > MAX_DATA_BYTES) {
          problems.push(`${dataName} is ${dataBytes.length} bytes; a data file is at most ${MAX_DATA_BYTES}`)
        }
      }
    }

    const bytes = readFileSync(join(path, 'widget.js'))
    const source = new TextDecoder().decode(bytes)
    if (problems.length === 0) {
      const checked = checkSource(source, meta, readAllowlist(), bytes)
      problems.push(...checked.problems)
      notes.push(...checked.notes)
    }
    const file = `widgets/${dir.name}/widget.js`
    results.push({
      name: dir.name,
      problems,
      notes,
      entry: problems.length === 0 ? listingEntry(meta, file, bytes, dataBytes) : undefined,
    })
  }
  return results
}

function readAllowlist() {
  return JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
}

function report(results) {
  let failed = false
  for (const r of results) {
    for (const p of r.problems) {
      failed = true
      console.log(`✗ ${r.name}: ${p}`)
    }
    for (const n of r.notes) console.log(`! ${r.name}: ${n}`)
    if (r.problems.length === 0) console.log(`✓ ${r.name}`)
  }
  return failed
}

function build() {
  const results = readWidgets()
  if (report(results)) {
    console.log('\nlibrary.json not written: fix the problems above first.')
    process.exit(1)
  }
  writeFileSync(LISTING, renderListing(results.map((r) => r.entry)))
  console.log(`\nlibrary.json: ${results.length} widget(s)`)
}

function check(baseRef) {
  const results = readWidgets()
  let failed = report(results)

  if (!failed) {
    const expected = renderListing(results.map((r) => r.entry))
    const actual = existsSync(LISTING) ? readFileSync(LISTING, 'utf8') : ''
    if (actual !== expected) {
      failed = true
      console.log('✗ library.json is out of date: run `npm run build` and commit the result')
    }
  }

  for (const p of checkPin()) {
    failed = true
    console.log(`✗ pin: ${p}`)
  }

  if (baseRef) {
    let base = null
    try {
      base = execFileSync('git', ['show', `${baseRef}:library.json`], { cwd: ROOT, encoding: 'utf8' })
    } catch {
      // No listing at the base is the first widget ever, not an error.
    }
    if (base) {
      const entries = results.filter((r) => r.entry).map((r) => r.entry)
      for (const p of checkAgainstBase(entries, JSON.parse(base).widgets)) {
        failed = true
        console.log(`✗ ${p}`)
      }
    }
  }

  if (failed) process.exit(1)
  console.log('\nall widgets pass')
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()

/**
 * The pin is the one file whose mistakes reach every user at once: the
 * extension follows it before it reads anything else, so a pin naming a state
 * that is not there is the whole library going quiet.
 *
 * A pin naming a commit that is not an ancestor of this branch is the
 * dangerous case rather than the obviously broken one — such a commit can
 * exist, can resolve on the CDN, and is a state nobody reviewed here.
 */
function checkPin() {
  let pin
  try {
    pin = JSON.parse(readFileSync(PIN, 'utf8'))
  } catch (e) {
    return [`pin.json does not parse: ${e.message}`]
  }
  if (!/^[0-9a-f]{40}$/.test(pin.commit ?? '')) {
    return ['pin.json "commit" must be a full 40-character commit hash']
  }
  const problems = []
  try {
    git('merge-base', '--is-ancestor', pin.commit, 'HEAD')
  } catch {
    problems.push(`pin.json names ${pin.commit.slice(0, 7)}, which is not an ancestor of HEAD`)
  }
  // The listing at that commit is what the extension will read. A pin at a
  // commit from before the listing existed, or at one whose listing was
  // hand-edited into invalid JSON, publishes nothing at all.
  try {
    const listed = JSON.parse(git('show', `${pin.commit}:library.json`))
    if (!Array.isArray(listed.widgets)) problems.push('the listing at that commit has no widgets')
  } catch {
    problems.push(`library.json at ${pin.commit.slice(0, 7)} is missing or does not parse`)
  }
  return problems
}

/**
 * Names the current commit — the act that publishes.
 *
 * The pin therefore never names the commit that contains it, and cannot: the
 * pin is written before the commit it would have to name exists. What it names
 * is the state whose widgets are being published, which is the state before
 * this one.
 */
function publish() {
  const commit = git('rev-parse', 'HEAD')
  const pin = JSON.parse(readFileSync(PIN, 'utf8'))
  writeFileSync(
    PIN,
    JSON.stringify({ ...pin, commit, movedAt: new Date().toISOString() }, null, 2) + '\n',
  )
  console.log(`pin.json now names ${commit}`)
  console.log('Commit it — committing is what publishes that state.')
}

function allowlist(manifestPath) {
  if (!manifestPath) {
    console.error('usage: library.mjs allowlist <path to the extension manifest.json>')
    process.exit(2)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const csp = manifest.content_security_policy?.sandbox
  if (!csp) {
    console.error('that manifest has no sandbox CSP')
    process.exit(1)
  }
  writeFileSync(ALLOWLIST, JSON.stringify(allowlistFromCsp(csp), null, 2) + '\n')
  console.log('allowlist.json refreshed')
}

const [command, ...rest] = process.argv.slice(2)
if (command === 'build') build()
else if (command === 'check') check(rest[0] === '--base' ? rest[1] : undefined)
else if (command === 'publish') publish()
else if (command === 'allowlist') allowlist(rest[0])
else {
  console.error('usage: library.mjs build | check [--base <ref>] | publish | allowlist <manifest.json>')
  process.exit(2)
}
