// A picture — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { /* Given a box, expected to fit it — a widget that overflows is clipped,
     never scrolled, because the panel around it cannot scroll either. */
    overflow: hidden; margin: 0; height: 100%; }
  body { display: flex; align-items: center; justify-content: center; background: transparent;
         font-family: system-ui, sans-serif; color: #e8ecf5; }
  /* Fills the box it was given without distorting: the frame's proportions are
     the hero's, and the image's are its own. */
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .note { font-size: 13px; opacity: 0.7; padding: 0 16px; text-align: center; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="note">…</div>`)
})()
// picsum.photos needs no key. The size is asked for in the URL so the service
// returns something close to the box rather than a full-resolution image that
// would be scaled down after the bytes were already spent.
function load(init) {
  var w = Math.max(1, Math.round(init.width || 600))
  var h = Math.max(1, Math.round(init.height || 300))
  var img = new Image()
  img.alt = ''
  img.onload = function () { document.body.replaceChildren(img) }
  img.onerror = function () {
    document.body.innerHTML = '<div class="note">The picture could not be loaded.</div>'
  }
  // The address asked for is not the address served. This host answers 302 to
  // https://fastly.picsum.photos/id/<n>/<w>/<h>.jpg?hmac=..., which is where the
  // bytes actually come from — so both belong in the allowlist and in what this
  // widget declares. Only the first was there, and the redirect was refused by
  // the policy with the widget left showing nothing: measured, `Loading the
  // image ... violates the Content Security Policy` and a request failing with
  // `csp`. A redirect is not a detail of transport when a policy is what decides
  // whether it is followed.
  img.src = 'https://picsum.photos/' + w + '/' + h
}

TrailTabWidget.onInit(load)
// A new box is a new image: asking for the collapsed size and then stretching it
// across the expanded one would show a soft picture where a sharp one was free.
TrailTabWidget.onExpand(load)
TrailTabWidget.onCollapse(load)
