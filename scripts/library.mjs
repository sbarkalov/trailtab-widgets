#!/usr/bin/env node
// node scripts/library.mjs build             — regenerate library.json
// node scripts/library.mjs check [--base R]  — verify every widget and the listing
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
} from './lib.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const WIDGETS = join(ROOT, 'widgets')
const LISTING = join(ROOT, 'library.json')
const ALLOWLIST = join(ROOT, 'allowlist.json')

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
    const extra = files.filter((f) => !EXPECTED_FILES.includes(f))
    const missing = EXPECTED_FILES.filter((f) => !files.includes(f))
    for (const f of extra) problems.push(`unexpected file ${f}: a widget is one script`)
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
      entry: problems.length === 0 ? listingEntry(meta, file, bytes) : undefined,
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
else if (command === 'allowlist') allowlist(rest[0])
else {
  console.error('usage: library.mjs build | check [--base <ref>] | allowlist <manifest.json>')
  process.exit(2)
}
