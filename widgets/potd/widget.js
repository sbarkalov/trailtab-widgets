// Picture of the day — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { display: flex; color: #e8ecf5; background: transparent; }
  .wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
  /* The picture is never cropped. A photograph is someone's composition and a
     box is not a reason to re-frame it, so it is contained and the surplus is
     ground. */
  .shot { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .shot img { max-width: 100%; max-height: 100%; display: block; border-radius: 4px; }
  /* The credit is a row of the layout, not an overlay. Overlaid on the picture
     it would be legible or not depending on what the picture happens to be,
     and this credit is the condition on drawing the picture at all. */
  .credit { flex: 0 0 auto; padding: 6px 8px 0; font-size: 11px; line-height: 1.35; }
  .title { color: #e8ecf5; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .by { opacity: 0.62; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note { margin: auto; font-size: 13px; opacity: 0.7; padding: 0 16px; text-align: center; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="note">…</div></div>`)
})()
// The picture of the day, from a collection that publishes one and states what
// may be done with it.
//
// The licence is the whole reason this widget is shaped the way it is. The
// picture arrives under a licence that permits reuse only with its author named
// and the licence named — so the credit is not a caption, it is the condition on
// drawing anything at all. Where either is missing the widget draws nothing and
// says why, because a picture without them is a picture we have no right to.
//
// The image is fetched from the rendition host, not the one holding the stored
// original: the original measured 5701x3806 against a box at most 640 wide, so
// fetching it would be tens of megabytes to draw a twentieth of it, on a page
// the user opens all day. The rendition is 640 wide, which is exactly what the
// larger box draws.
var FEED = 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured/'
// Where a rendition is served from, written out in full. Checked rather than
// trusted: an image URL arriving from anywhere else is refused here, before the
// CSP refuses it less legibly. Written as an origin rather than a bare host so
// that the address this widget can reach is a fact of the file — readable, and
// checkable, without running it.
var RENDITION_ORIGIN = 'https://thumb.wikimedia.org'
// The page for the picture itself, which the feed names and the panel offers.
// Written out for the same reason as the rendition host: the address arrives in
// the response, so putting the origin here is what makes it a fact of the file
// — and what lets it be checked before it is passed on.
var FILE_PAGE_ORIGIN = 'https://commons.wikimedia.org'
var wrap = document.querySelector('.wrap')

function show(html) { wrap.innerHTML = html }
function fail(message) { show('<div class="note">' + message + '</div>') }

function today() {
  var d = new Date()
  var pad = function (n) { return (n < 10 ? '0' : '') + n }
  return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate())
}

function textOf(node) {
  // The feed wraps prose in HTML; only the text is wanted, and building it
  // through the DOM rather than a regex is what keeps markup out of the credit.
  var d = document.createElement('div')
  d.innerHTML = (node && node.text) || ''
  return (d.textContent || '').trim()
}

function render(image) {
  var thumb = image && image.thumbnail && image.thumbnail.source
  var author = textOf(image && image.artist)
  var licence = image && image.license && image.license.type

  if (!thumb || thumb.lastIndexOf(RENDITION_ORIGIN + '/', 0) !== 0) return fail('No picture today.')
  // Both, or neither. The licence is what permits the drawing and the author is
  // what the licence requires; half a credit is not a lesser credit, it is a
  // breach with a caption.
  if (!author || !licence) return fail('Today’s picture arrived without its credit.')

  // The panel draws the link, not this widget: the frame is sandboxed without
  // permission to open a window and the panel's overlay takes the clicks. So
  // the address is handed over and the panel decides — and it will refuse one
  // this widget never declared, which is why only the expected origin is sent.
  var page = image.file_page
  if (page && page.lastIndexOf(FILE_PAGE_ORIGIN + '/', 0) === 0) TrailTabWidget.source(page)

  var title = (image.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '')
  var esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML }

  show(
    '<div class="shot"><img alt="" src="' + esc(thumb) + '"></div>' +
    '<div class="credit">' +
      '<div class="title">' + esc(title) + '</div>' +
      '<div class="by">' + esc(author) + ' · ' + esc(licence) + '</div>' +
    '</div>'
  )
}

function load() {
  fetch(FEED + today())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) { render(j && j.image) })
    .catch(function () { fail('The picture of the day is unavailable right now.') })
}

TrailTabWidget.onInit(load)
