// The rules a widget is held to before it can be listed.
//
// Two audiences read these results and they need different things. The
// extension re-checks shape, size and digest on every refresh and refuses what
// fails — so those checks here are a courtesy, telling an author in a pull
// request what the extension would otherwise tell nobody. The contacts checks
// are different: the extension cannot perform them at all, because it never
// reads a payload's code. Here is the only place they happen before a reviewer.
//
// Pure functions over strings, so every rule is testable without a filesystem.

import { createHash } from 'node:crypto'

/** Mirrors `MAX_WIDGET_BYTES` in the extension. The whole file, comments included. */
export const MAX_WIDGET_BYTES = 16 * 1024

/** Mirrors `MAX_DATA_BYTES` in the extension: one data file, read as text, never run. */
export const MAX_DATA_BYTES = 64 * 1024

/** The fields `widget.json` may carry. Anything else is a typo or a wish. */
const META_FIELDS = new Set([
  'id',
  'title',
  'version',
  'interactive',
  'contacts',
  'rotatable',
  'data',
  'bundled',
])

// A data file's name: a plain file in the widget's own folder. Not a script —
// data is handed to the widget as text and never run, and a `.js` here would be
// code carried under the data bound, which is four times the code one.
const DATA_NAME = /^[a-z0-9][a-z0-9_-]*\.(txt|json|csv|tsv)$/

/**
 * Fields the extension accepts and ignores. Refused here rather than passed
 * through: an author who sets one expects it to do something, and the panel's
 * box is not negotiable.
 */
const INERT_FIELDS = new Set(['aspect', 'minExpandedHeight'])

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const VERSION = /^\d+\.\d+\.\d+$/
// A bare hostname: what the consent tooltip shows and what `source()` links
// are matched against. A scheme or a path here would never match anything.
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/**
 * Why an id is not one a person can read, or null if it is.
 *
 * The id is permanent — changing it makes a different widget as far as every
 * cache is concerned — and it is what a maintainer, an issue and a diagnostic
 * log call the widget. So it should say what the widget shows. Whether it
 * *does* is for review; this refuses only the shapes that plainly cannot:
 * serial numbers, versions, hashes, and words that describe every widget.
 */
export function idProblem(id) {
  if (id.length < 3 || id.length > 40) return 'must be 3 to 40 characters'
  if (!/^[a-z]/.test(id)) return 'must start with a letter'
  const parts = id.split('-')
  // A version or a date in the id would have to change when the widget does,
  // and the id is the one thing that must not.
  if (parts.some((p) => /^v?\d+$/.test(p))) {
    return 'must not contain a number, version or date — the id outlives them'
  }
  if (parts.some((p) => p.length >= 8 && /\d/.test(p) && /^[0-9a-f]+$/.test(p))) {
    return 'looks like a hash; name what the widget shows'
  }
  const generic = ['widget', 'test', 'my', 'new', 'demo', 'untitled']
  const found = parts.find((p) => generic.includes(p))
  if (found) return `must not use "${found}": it says nothing about this widget`
  return null
}

/** Problems with a widget's declaration. An empty list means it passed. */
export function checkMeta(meta, dirName) {
  const problems = []
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return ['widget.json must be an object']
  }
  for (const key of Object.keys(meta)) {
    if (INERT_FIELDS.has(key)) {
      problems.push(`"${key}" does nothing: the panel draws every widget at its published size`)
    } else if (!META_FIELDS.has(key)) {
      problems.push(`unknown field "${key}"`)
    }
  }
  if (typeof meta.id !== 'string' || !ID.test(meta.id)) {
    problems.push('"id" must be lowercase letters, digits and single hyphens')
  } else if (idProblem(meta.id)) {
    problems.push(`"id" ${idProblem(meta.id)}`)
  } else if (meta.id !== dirName) {
    // One name for one thing: the directory is what a reviewer sees in the
    // diff, the id is what the cache remembers.
    problems.push(`"id" is "${meta.id}" but the directory is "${dirName}"`)
  }
  if (typeof meta.title !== 'string' || meta.title.trim() === '') {
    problems.push('"title" must be a non-empty string')
  }
  if (typeof meta.version !== 'string' || !VERSION.test(meta.version)) {
    problems.push('"version" must be MAJOR.MINOR.PATCH')
  }
  if (typeof meta.interactive !== 'boolean') {
    problems.push('"interactive" must be true or false')
  }
  if (meta.rotatable !== undefined && typeof meta.rotatable !== 'boolean') {
    problems.push('"rotatable", if present, must be true or false')
  }
  // Declares that the extension ships this widget. Nothing at runtime reads it;
  // the extension's own bundle manifest decides, and refuses to disagree.
  if (meta.bundled !== undefined && typeof meta.bundled !== 'boolean') {
    problems.push('"bundled", if present, must be true or false')
  }
  if (meta.data !== undefined && (typeof meta.data !== 'string' || !DATA_NAME.test(meta.data))) {
    problems.push('"data", if present, must name a .txt, .json, .csv or .tsv file in the widget\'s folder')
  }
  // Absent is not an answer; null is. And the extension still reads a bare
  // string for widgets published before lists existed, but nothing new needs
  // that spelling, so here there is one.
  if (!('contacts' in meta)) {
    problems.push('"contacts" is required — write null if the widget reaches nothing')
  } else if (meta.contacts !== null) {
    if (!Array.isArray(meta.contacts) || meta.contacts.length === 0) {
      problems.push('"contacts" must be null or a non-empty list of hostnames')
    } else {
      for (const h of meta.contacts) {
        if (typeof h !== 'string' || !HOST.test(h)) problems.push(`"${h}" is not a bare hostname`)
      }
      if (new Set(meta.contacts).size !== meta.contacts.length) {
        problems.push('"contacts" lists a host twice')
      }
    }
  }
  return problems
}

/**
 * Every host written into the source as an absolute http(s) address.
 *
 * This finds what is spelled out and nothing that is assembled — a host built
 * by concatenation is invisible to it. That is a limit stated rather than
 * worked around: a widget that hides where it goes is one the reviewer refuses,
 * and the CSP allowlist stops it reaching anywhere unlisted regardless.
 */
export function hostsIn(source) {
  const hosts = new Set()
  // Namespace names are identifiers that happen to be spelled as addresses:
  // `createElementNS('http://www.w3.org/2000/svg', …)` fetches nothing. Only
  // the exact namespace forms are excused, so a real request to the host is
  // still caught.
  const unNamespaced = source.replace(
    /https?:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1999\/xlink|1998\/Math\/MathML)\b/g,
    '',
  )
  for (const m of unNamespaced.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    hosts.add(m[1].toLowerCase().replace(/\.$/, ''))
  }
  return [...hosts].sort()
}

/**
 * Problems with the source file itself, checked against its declaration and
 * against what the extension currently permits.
 *
 * Returns `problems`, which fail the check, and `notes`, which a reviewer
 * reads. A host outside the allowlist is a note, not a failure: a page the
 * widget only links to through `TrailTabWidget.source()` belongs in `contacts`
 * and never in the allowlist, and no reading of the code can tell a link from a
 * fetch reliably.
 */
export function checkSource(source, meta, allowlist, bytes) {
  const problems = []
  const notes = []

  if (bytes.length > MAX_WIDGET_BYTES) {
    problems.push(`${bytes.length} bytes; the limit is ${MAX_WIDGET_BYTES}, comments included`)
  }
  // The extension hashes `TextEncoder(response.text())`, not the raw bytes. A
  // byte-order mark or an invalid sequence survives on disk and not through
  // that round trip, so the digest published here would never match.
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    problems.push('starts with a byte-order mark, which the extension strips before hashing')
  }
  if (!Buffer.from(new TextDecoder().decode(bytes)).equals(Buffer.from(bytes))) {
    problems.push('is not valid UTF-8')
  }
  // The shell runs the payload as a script. Markup is a syntax error there and
  // shows as an empty frame, which is the most confusing way to learn this.
  if (/^\s*</.test(source)) {
    problems.push('looks like HTML; a library widget is JavaScript that builds its own page')
  }

  const found = hostsIn(source)
  const declared = meta.contacts ?? []
  for (const h of found) {
    if (!declared.includes(h)) problems.push(`reaches ${h}, which "contacts" does not declare`)
  }
  // The other direction too: a declared address the widget never uses puts a
  // host in front of the user at consent time for no reason.
  for (const h of declared) {
    if (!found.includes(h)) problems.push(`declares ${h}, which the source never names`)
  }
  const permitted = new Set([...allowlist.connect, ...allowlist.img, ...(allowlist.media ?? [])])
  for (const h of found) {
    if (!permitted.has(h)) {
      notes.push(
        `${h} is not on the extension's allowlist: fine only as a link target passed to source(); a fetch or image there will be blocked`,
      )
    }
  }
  return { problems, notes }
}

/** Lowercase hex, computed the way the extension computes it. */
export function sha256Hex(bytes) {
  const text = new TextDecoder().decode(bytes)
  return createHash('sha256').update(new TextEncoder().encode(text)).digest('hex')
}

/** One listing entry, fields in a fixed order so the file diffs cleanly. */
export function listingEntry(meta, file, bytes, dataBytes) {
  const entry = {
    id: meta.id,
    title: meta.title,
    version: meta.version,
    file,
    sha256: sha256Hex(bytes),
    interactive: meta.interactive,
    contacts: meta.contacts,
  }
  if (meta.rotatable !== undefined) entry.rotatable = meta.rotatable
  if (meta.data !== undefined) {
    entry.data = { file: file.replace(/[^/]+$/, meta.data), sha256: sha256Hex(dataBytes) }
  }
  if (meta.bundled === true) entry.bundled = true
  return entry
}

export function renderListing(entries) {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id))
  return JSON.stringify({ widgets: sorted }, null, 2) + '\n'
}

/**
 * Problems with a change to an already-listed widget, against the listing at
 * the base of the pull request.
 *
 * The extension keeps a cached widget until its version changes, so new bytes
 * under an old version would reach nobody who already holds it — and would
 * make one version name two different programs.
 */
export function checkAgainstBase(entries, baseEntries) {
  const problems = []
  const base = new Map(baseEntries.map((e) => [e.id, e]))
  for (const e of entries) {
    const was = base.get(e.id)
    if (!was) continue
    // The data is part of what a version names: a cached widget keeps its data
    // until the version moves, exactly as it keeps its code.
    const changed = was.sha256 !== e.sha256 || was.data?.sha256 !== e.data?.sha256
    if (changed && was.version === e.version) {
      problems.push(`${e.id}: the code or its data changed but the version is still ${e.version}`)
    }
    if (!changed && was.version !== e.version) {
      problems.push(`${e.id}: the version moved to ${e.version} but neither the code nor its data changed`)
    }
  }
  return problems
}

/** The two source lists out of the extension's sandbox CSP. */
export function allowlistFromCsp(csp) {
  const directive = (name) => {
    const m = csp.match(new RegExp(`(?:^|;)\\s*${name}\\s+([^;]*)`))
    if (!m) return []
    return m[1]
      .trim()
      .split(/\s+/)
      .filter((s) => s.startsWith('https://'))
      .map((s) => new URL(s).hostname)
      .sort()
  }
  // Every directive that names a destination. The extension added media-src
  // (for audio from Wikimedia) and this read only the first two, so the file
  // meant to be the list of permitted destinations was missing one.
  return {
    connect: directive('connect-src'),
    img: directive('img-src'),
    media: directive('media-src'),
  }
}
