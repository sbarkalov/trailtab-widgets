// Word of the day — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { display: flex; color: #e8ecf5; background: transparent; }
  .wrap { display: flex; flex-direction: column; justify-content: center; width: 100%; height: 100%; padding: 0 14px; box-sizing: border-box; }
  .head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  /* Sized down rather than wrapped: the curator picks phrases as well as
     words, and the layout is measured against those. */
  .word { font-size: clamp(18px, 5.4vw, 34px); font-weight: 650; line-height: 1.15; }
  .pos, .ipa { font-size: clamp(12px, 1.9vw, 14px); }
  .pos { font-style: italic; opacity: 0.6; }
  .ipa { opacity: 0.72; }
  /* Plays when asked, never on a draw. */
  .say { font: inherit; font-size: clamp(11px, 1.8vw, 13px); color: inherit; background: rgba(255,255,255,0.09); border: 0; border-radius: 999px; padding: 2px 9px; cursor: pointer; }
  .say:hover { background: rgba(255,255,255,0.16); }
  /* Clipped by lines, not characters: a count lands mid-word. */
  .sense { margin-top: 9px; font-size: clamp(12.5px, 2.4vw, 16px); line-height: 1.45; opacity: 0.92; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; }
  .credit { margin-top: 10px; font-size: clamp(10.5px, 1.7vw, 12px); opacity: 0.55; }
  .note { margin: auto; font-size: 13px; opacity: 0.7; text-align: center; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="note">…</div></div>`)
})()
// The word of the day, as somebody else chose it.
//
// Not ours to pick, and that is the point: an editor puts a word on a dated
// page for that date. Picking our own, which an earlier draft did, loses the
// only thing that makes the day's word worth reading.
//
// Through the action API, not REST: REST refuses the `Wiktionary:` namespace
// with `404 Domain not allowed`, and reading that as "no word of the day exists
// to fetch" is the mistake this file exists to not repeat.
//
// It has one control, so it declares `interactive: true` — see the registry for
// why a widget with a button has no other choice.
var API = 'https://en.wiktionary.org/w/api.php'
var ENTRY = 'https://en.wiktionary.org/wiki/'
// Only ever an <audio src>. Checked against what arrives, so the one address
// this widget plays from is a fact of the file.
var AUDIO_ORIGIN = 'https://upload.wikimedia.org'
var wrap = document.querySelector('.wrap')
var playing = null
var say = null

function show(html) { wrap.innerHTML = html }
function fail(message) { show('<div class="note">' + message + '</div>') }
function esc(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML }

function parseUrl(page) {
  return API + '?action=parse&prop=text&format=json&origin=*&page=' + encodeURIComponent(page)
}

// Two names, in the order Wiktionary's own note gives: since 2020 the live page
// carries the year, the undated one is the fallback for a day nobody set.
// Reading only the undated one returns a stale word.
function pages(now) {
  // Asked for in English, not the reader's locale: the page names are English.
  var m = now.toLocaleString('en-US', { month: 'long' }), d = now.getDate()
  return ['Wiktionary:Word of the day/' + now.getFullYear() + '/' + m + ' ' + d,
          'Wiktionary:Word of the day/' + m + '_' + d]
}

function ask(page) {
  return fetch(parseUrl(page))
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) {
      // A rate limit answers with a body too: the payload is what tells a
      // missing page from a refused request.
      if (!j || j.error || !j.parse || !j.parse.text) throw new Error('no page')
      return j.parse.text['*']
    })
}

// Parsed inert: innerHTML on a detached node still loads the page's images and
// DOMParser does not.
function extract(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html')
  var titleEl = doc.getElementById('WOTD-rss-title')
  var descEl = doc.getElementById('WOTD-rss-description')
  if (!titleEl || !descEl) return null

  // The anchors are Wiktionary's own — it builds an RSS feed from these pages.
  // Renamed, this returns null and the widget says it has nothing, which is why
  // nothing here keys on position in the markup.
  var word = (titleEl.textContent || '').trim()

  // Senses are list items: the first, minus any nested list, is the primary
  // sense without its sub-senses, and that is what fits.
  var first = descEl.querySelector('li')
  if (first) {
    first = first.cloneNode(true)
    var nested = first.querySelector('ol, ul')
    if (nested) nested.remove()
  }
  var sense = ((first || descEl).textContent || '').replace(/\s+/g, ' ').trim()
  if (!word || !sense) return null

  var cell = titleEl.closest('td')
  var posEl = cell && cell.querySelector('i')
  var mp3 = doc.querySelector('source[type^="audio/mpeg"]')
  var src = mp3 && mp3.getAttribute('src')
  // Protocol-relative, as MediaWiki writes it.
  if (src && src.lastIndexOf('//', 0) === 0) src = 'https:' + src
  if (src && src.lastIndexOf(AUDIO_ORIGIN + '/', 0) !== 0) src = null

  return { word: word, pos: posEl ? (posEl.textContent || '').trim() : '', sense: sense, audio: src }
}

// Not on the day's page; in the entry, and the second request. English section
// only: an entry can carry several languages.
function transcription(word) {
  return fetch(API + '?action=parse&prop=wikitext&format=json&origin=*&page=' + encodeURIComponent(word))
    .then(function (r) { return r.ok ? r.json() : null })
    .then(function (j) {
      var t = j && j.parse && j.parse.wikitext && j.parse.wikitext['*']
      if (!t) return ''
      var en = t.split('==English==')[1]
      if (!en) return ''
      var m = /\{\{IPA\|en\|([^}|]+)/.exec(en.split('\n----')[0])
      return m ? m[1].trim() : ''
    })
    .catch(function () { return '' })
}

function render(w, ipa) {
  var head = '<div class="head"><span class="word">' + esc(w.word) + '</span>' +
    (w.pos ? '<span class="pos">' + esc(w.pos) + '</span>' : '') +
    (ipa ? '<span class="ipa">' + esc(ipa) + '</span>' : '') +
    (w.audio ? '<button class="say" type="button">▸ say it</button>' : '') + '</div>'

  show(head +
    '<div class="sense">' + esc(w.sense) + '</div>' +
    '<div class="credit">Wiktionary · CC BY-SA</div>')

  if (w.audio) {
    playing = new Audio(w.audio)
    say = wrap.querySelector('.say')
    say.addEventListener('click', function () { playing.play().catch(function () {}) })
  }
  // The panel draws the link, outside the sandbox, and refuses an undeclared
  // host. The entry holds the senses that did not fit and the full attribution.
  TrailTabWidget.source(ENTRY + encodeURIComponent(w.word))
}

function load() {
  var names = pages(new Date())
  ask(names[0])
    .catch(function () { return ask(names[1]) })
    .then(function (html) {
      var w = extract(html)
      // A response is not a word. Both blank widgets this project shipped
      // passed a check on the request and failed on what reached the screen.
      if (!w) throw new Error('nothing extracted')
      return transcription(w.word).then(function (ipa) { render(w, ipa) })
    })
    .catch(function () { fail('No word of the day right now.') })
}

TrailTabWidget.onInit(load)

// Expanded means the keyboard has been handed over, so the one control takes
// it: Space plays the word without reaching for the mouse.
TrailTabWidget.onExpand(function () { if (say) say.focus() })

// The reader has left; a recording still playing is the widget outstaying it.
TrailTabWidget.onCollapse(function () { if (playing) playing.pause() })

// The one contract a widget holding the keyboard has: the panel cannot see this
// keystroke, so nothing else can give the keyboard back.
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return
  if (playing) playing.pause()
  TrailTabWidget.releaseFocus()
})
