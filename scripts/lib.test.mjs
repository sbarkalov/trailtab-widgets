import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_WIDGET_BYTES,
  allowlistFromCsp,
  checkAgainstBase,
  checkMeta,
  checkSource,
  hostsIn,
  listingEntry,
  sha256Hex,
} from './lib.mjs'

const meta = (over = {}) => ({
  id: 'clock',
  title: 'Clock',
  version: '1.0.0',
  interactive: false,
  contacts: null,
  ...over,
})
const allow = { connect: ['api.example.org'], img: ['img.example.org'] }
const enc = (s) => new TextEncoder().encode(s)
const src = (s, m = meta()) => checkSource(s, m, allow, enc(s))

test('a plain declaration passes', () => {
  assert.deepEqual(checkMeta(meta(), 'clock'), [])
})

test('contacts must be stated, and null is the statement of nothing', () => {
  const { contacts: _, ...absent } = meta()
  assert.match(checkMeta(absent, 'clock').join(), /required/)
  assert.match(checkMeta(meta({ contacts: [] }), 'clock').join(), /non-empty/)
  assert.match(checkMeta(meta({ contacts: 'api.example.org' }), 'clock').join(), /non-empty/)
  assert.match(checkMeta(meta({ contacts: ['https://x.org'] }), 'clock').join(), /bare hostname/)
})

test('the id is the directory', () => {
  assert.match(checkMeta(meta(), 'watch').join(), /directory/)
  assert.match(checkMeta(meta({ id: 'Clock' }), 'Clock').join(), /lowercase/)
})

test('fields that do nothing are refused rather than ignored', () => {
  assert.match(checkMeta(meta({ aspect: 2 }), 'clock').join(), /does nothing/)
  assert.match(checkMeta(meta({ colour: 'red' }), 'clock').join(), /unknown field/)
})

test('an undeclared address fails, and so does a declared unused one', () => {
  assert.match(src('fetch("https://api.example.org/x")').problems.join(), /does not declare/)
  assert.match(
    src('1', meta({ contacts: ['api.example.org'] })).problems.join(),
    /never names/,
  )
  assert.deepEqual(
    src('fetch("https://api.example.org/x")', meta({ contacts: ['api.example.org'] })).problems,
    [],
  )
})

test('a host outside the allowlist is for the reviewer, not a failure', () => {
  const r = src('source("https://en.example.org/wiki")', meta({ contacts: ['en.example.org'] }))
  assert.deepEqual(r.problems, [])
  assert.match(r.notes.join(), /allowlist/)
})

test('SVG namespaces are not contacts, but the same host otherwise is', () => {
  assert.deepEqual(hostsIn('createElementNS("http://www.w3.org/2000/svg", "svg")'), [])
  assert.deepEqual(hostsIn('fetch("https://www.w3.org/TR/")'), ['www.w3.org'])
})

test('the size limit counts every byte', () => {
  const at = '/'.repeat(MAX_WIDGET_BYTES)
  assert.deepEqual(src(at).problems, [])
  assert.match(src(at + '/').problems.join(), /limit/)
})

test('markup is refused: the shell runs the payload as a script', () => {
  assert.match(src('<!doctype html><p>hi</p>').problems.join(), /HTML/)
})

test('a byte-order mark is refused, since the extension would hash without it', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('1')])
  assert.match(checkSource('1', meta(), allow, bytes).problems.join(), /byte-order mark/)
})

test('the digest is the one the extension computes over the decoded text', () => {
  // sha256("abc"), a published test vector.
  assert.equal(
    sha256Hex(enc('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})

test('rotatable is carried into the listing only when stated', () => {
  assert.equal('rotatable' in listingEntry(meta(), 'f', enc('1')), false)
  assert.equal(listingEntry(meta({ rotatable: false }), 'f', enc('1')).rotatable, false)
})

test('new code needs a new version, and a new version needs new code', () => {
  const was = { id: 'clock', version: '1.0.0', sha256: 'a' }
  assert.match(checkAgainstBase([{ ...was, sha256: 'b' }], [was]).join(), /still 1.0.0/)
  assert.match(checkAgainstBase([{ ...was, version: '1.0.1' }], [was]).join(), /did not change/)
  assert.deepEqual(checkAgainstBase([{ ...was, sha256: 'b', version: '1.1.0' }], [was]), [])
})

test('the allowlist is read out of the sandbox CSP', () => {
  const csp =
    "sandbox allow-scripts; script-src 'self'; connect-src https://a.org https://b.org; img-src 'self' data: https://c.org; child-src 'self';"
  assert.deepEqual(allowlistFromCsp(csp), { connect: ['a.org', 'b.org'], img: ['c.org'] })
})
