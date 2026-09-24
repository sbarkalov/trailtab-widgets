// A work of art — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { display: flex; color: #e8ecf5; background: transparent; }
  .wrap { display: flex; flex-direction: column; width: 100%; height: 100%; }
  /* Contained, never cropped. Re-framing a painting to fit a box is the one
     thing an art widget must not do. */
  .shot { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .shot img { max-width: 100%; max-height: 100%; display: block; }
  .credit { flex: 0 0 auto; padding: 6px 8px 0; font-size: 11px; line-height: 1.35; }
  .title { opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .by { opacity: 0.62; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .note { margin: auto; font-size: 13px; opacity: 0.7; padding: 0 16px; text-align: center; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="note">…</div></div>`)
})()
// One work from one of two collections, public domain only.
//
// A collection serving an image is not a collection granting the right to
// redraw it, so the public-domain flag is asked for in the request — a request
// that omits it comes back with works that are not. Measured on both.
//
// The two are asked differently because they answer differently. One returns
// the work and the address of its image together, in a single call. The other
// returns identifiers only, so the work needs a second call — and its filter is
// not reliable: of 25 identifiers taken from a search that asked for public
// domain with images, 20 satisfied both when fetched. So what that side
// promises is checked on the work itself, and another identifier is tried when
// it does not hold. Three attempts, then the widget says so.
//
// The image is loaded before anything is drawn, and a failure to load is a
// failure of the draw. This is not caution: one collection here was serving a
// bot-protection page instead of the picture, and because the credit was
// written straight into the document the widget showed a title and an artist
// over nothing at all, for days, looking like a design choice.
//
// A collection that fails is reported rather than replaced by the other. A
// widget that quietly becomes single-source tells the user it draws on two
// while drawing on one, and nothing on screen would distinguish that from
// working.

// CC0 only, which is a stronger statement than a public-domain flag: the
// collection has waived what it had rather than reporting that a work is old.
var CMA_SEARCH =
  'https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=1' +
  '&fields=id,title,creators,creation_date,images,url&skip='
// Where its renditions are served. Checked before use, and written out so the
// address this widget can reach is a fact of the file.
var CMA_IMAGE_ORIGIN = 'https://openaccess-cdn.clevelandart.org'
// The work's own page, which the panel offers as somewhere to go.
var CMA_PAGE_ORIGIN = 'https://clevelandart.org'

// One department rather than the whole collection: 2,665 works in 19KB against
// 34,000 in 208KB for a broader one, on a page the user opens all day.
var MET_SEARCH =
  'https://collectionapi.metmuseum.org/public/collection/v1/search' +
  '?isPublicDomain=true&hasImages=true&departmentId=11&q=*'
var MET_OBJECT = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/'
var MET_IMAGE_ORIGIN = 'https://images.metmuseum.org'
// Where the work's own page lives. The address comes back in the response, so
// the origin is written here to be checked against — and so that what this
// widget can put someone in front of is readable without running it.
var MET_PAGE_ORIGIN = 'https://www.metmuseum.org'

var wrap = document.querySelector('.wrap')
var esc = function (t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML }

function fail(message) { wrap.innerHTML = '<div class="note">' + esc(message) + '</div>' }

function draw(work) {
  // The picture first. Nothing is drawn until it has actually decoded, so the
  // widget can never show a credit over an empty space — which is precisely
  // what it did while one collection answered with a challenge page.
  return new Promise(function (resolve, reject) {
    var img = new Image()
    img.alt = ''
    img.onload = function () {
      // Only now: the panel is offered the page, and the credit goes in beside
      // a picture that exists.
      if (work.page) TrailTabWidget.source(work.page)

      var shot = document.createElement('div')
      shot.className = 'shot'
      shot.appendChild(img)

      var credit = document.createElement('div')
      credit.className = 'credit'
      credit.innerHTML =
        '<div class="title">' + esc(work.title) + (work.date ? ', ' + esc(work.date) : '') + '</div>' +
        // An unrecorded artist is said to be unrecorded. Dropping the line would
        // read as an oversight and naming the collection would credit it with
        // work it did not make.
        '<div class="by">' + esc(work.artist || 'Artist unrecorded') + ' · ' + esc(work.source) + '</div>'

      wrap.replaceChildren(shot, credit)
      resolve()
    }
    img.onerror = function () { reject(new Error('image did not load')) }
    img.src = work.image
  })
}

function fromCleveland() {
  // An offset into the collection rather than the first result, or it is the
  // same work every time.
  var skip = Math.floor(Math.random() * 40000)
  return fetch(CMA_SEARCH + skip)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) {
      var a = j && j.data && j.data[0]
      var images = a && a.images
      var web = images && images.web && images.web.url
      if (!a || !web) throw new Error('no work')
      if (web.lastIndexOf(CMA_IMAGE_ORIGIN + '/', 0) !== 0) throw new Error('unexpected host')

      var creators = a.creators || []
      var page = a.url
      return {
        image: web,
        page: page && page.lastIndexOf(CMA_PAGE_ORIGIN + '/', 0) === 0 ? page : null,
        title: a.title,
        artist: creators[0] && creators[0].description,
        date: a.creation_date,
        source: 'Cleveland Museum of Art',
      }
    })
}

function fromMet() {
  return fetch(MET_SEARCH)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) {
      var ids = (j && j.objectIDs) || []
      if (!ids.length) throw new Error('no works')

      var tries = 0
      function attempt() {
        if (++tries > 3) throw new Error('no usable work')
        var id = ids[Math.floor(Math.random() * ids.length)]
        return fetch(MET_OBJECT + id)
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
          .then(function (o) {
            // What the search promised, verified where it is actually stated.
            if (!o.isPublicDomain || !o.primaryImageSmall) return attempt()
            if (o.primaryImageSmall.lastIndexOf(MET_IMAGE_ORIGIN + '/', 0) !== 0) return attempt()
            var page = o.objectURL
            return {
              image: o.primaryImageSmall,
              page: page && page.lastIndexOf(MET_PAGE_ORIGIN + '/', 0) === 0 ? page : null,
              title: o.title,
              artist: o.artistDisplayName,
              date: o.objectDate,
              source: 'The Met',
            }
          })
      }
      return attempt()
    })
}

function load() {
  var pick = Math.random() < 0.5 ? fromCleveland : fromMet
  pick()
    .then(draw)
    .catch(function () { fail('That collection is unavailable right now.') })
}

TrailTabWidget.onInit(load)
