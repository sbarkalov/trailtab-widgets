// An image from space — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { display: flex; color: #e8ecf5; background: transparent; }
  .wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
  .shot { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .shot img { max-width: 100%; max-height: 100%; display: block; border-radius: 4px; }
  .credit { flex: 0 0 auto; padding: 6px 8px 0; font-size: 11px; line-height: 1.35; }
  .title { opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .by { opacity: 0.62; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note { margin: auto; font-size: 13px; opacity: 0.7; padding: 0 16px; text-align: center; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="note">…</div></div>`)
})()
// One image from the agency's own library.
//
// The picture of the day would be the obvious source and cannot be used: its
// interface refuses a request without a key, the shared demo key allows ten
// requests an hour across everyone who ships it, and its feed — which needs no
// key — is served without the header a browser needs to read it cross-origin.
// The library needs none of that.
//
// What this widget may say is narrower than what a widget drawing from a
// collection that publishes licences may say, and the difference is deliberate.
// This library states no licence per item: it gives a title, a description, the
// centre that produced it and a date. The agency's general position is that its
// material is not copyrighted, but a general position is not a statement about
// this image, and some items carry other people's work. So the credit names the
// agency and the centre — facts the library does give — and claims no licence.
// Asserting one the source withheld would be inventing provenance, which is the
// one thing a mark of provenance must not do.
var SEARCH = 'https://images-api.nasa.gov/search?media_type=image&page_size=1&q='
// Where renditions are served from, written out in full. Checked rather than
// trusted, so a changed response fails here legibly instead of being refused
// less legibly later — and written as an origin so the address this widget can
// reach is a fact of the file rather than something only a run reveals.
var ASSET_ORIGIN = 'https://images-assets.nasa.gov'
// The library's page for one item, built from its identifier. The panel offers
// it; this widget cannot open it, and does not try.
var DETAILS_PAGE = 'https://images.nasa.gov/details/'
// A few subjects rather than one, so the widget is not the same picture twice.
var SUBJECTS = ['nebula', 'galaxy', 'aurora', 'earth from orbit', 'saturn', 'lunar surface', 'solar corona']

var wrap = document.querySelector('.wrap')
var esc = function (t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML }

function fail(message) { wrap.innerHTML = '<div class="note">' + esc(message) + '</div>' }

function render(item) {
  var data = item && item.data && item.data[0]
  var image = item && item.links && item.links[0] && item.links[0].href
  if (!data || !image || image.lastIndexOf(ASSET_ORIGIN + '/', 0) !== 0) return fail('No image right now.')

  if (data.nasa_id) TrailTabWidget.source(DETAILS_PAGE + encodeURIComponent(data.nasa_id))

  var year = (data.date_created || '').slice(0, 4)
  var by = ['NASA', data.center, year].filter(Boolean).join(' · ')

  wrap.innerHTML =
    '<div class="shot"><img alt="" src="' + esc(image) + '"></div>' +
    '<div class="credit">' +
      '<div class="title">' + esc(data.title) + '</div>' +
      '<div class="by">' + esc(by) + '</div>' +
    '</div>'
}

function load() {
  var subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)]
  // A page rather than the first result, or the same few images come back for
  // a given subject every time.
  var page = 1 + Math.floor(Math.random() * 20)
  fetch(SEARCH + encodeURIComponent(subject) + '&page=' + page)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) {
      var items = j && j.collection && j.collection.items
      if (!items || !items.length) return fail('No image right now.')
      render(items[0])
    })
    .catch(function () { fail('The image library is unavailable right now.') })
}

TrailTabWidget.onInit(load)
