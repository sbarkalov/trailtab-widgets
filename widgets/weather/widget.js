// Weather — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { /* Given a box, expected to fit it — a widget that overflows is clipped,
     never scrolled, because the panel around it cannot scroll either. */
    overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { display: flex; align-items: center; justify-content: center; color: #e8ecf5; background: transparent; }
  .wrap { text-align: center; line-height: 1.3; }
  .temp { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .place { font-size: 13px; opacity: 0.7; }
  .note { font-size: 13px; opacity: 0.7; padding: 0 16px; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="note">…</div></div>`)
})()
// wttr.in needs no key and answers cross-origin requests, which is the standing
// selection criterion: a source needing a key would force a server to hold it —
// and this widget is sandboxed, so the key would sit in plain text in this very
// file, in every installed copy, on a quota all users share. A source without
// CORS headers would force a host permission. Neither is something a widget is
// allowed to cost.
//
// It is also asked for no location, and that is the point. Given none it
// resolves one from the address this request arrives on, and returns the
// weather for it — so the widget finds the user in a single request, without a
// permission prompt and without reading anything of theirs.
//
// One host rather than two, deliberately. A dedicated IP-geolocation service
// followed by a weather API also works (measured: several answer keyless, with
// CORS, and agree with each other), and is rejected because it is a *second*
// party contacted for the sole purpose of finding the user. This one receives
// the address regardless — every HTTP request carries it — and what changes is
// only that it acts on what it already has. That is the whole privacy argument,
// and it is narrow on purpose: it does not claim locating by address is
// nothing, only that telling one party is less than telling two.
//
// Still forbidden, and not by convention: no geolocation permission, and no
// guessing from the user's bookmarks or tabs — the sandbox makes the second
// impossible for a widget and the spec keeps it impossible for the host.
var URL_J1 = 'https://wttr.in/?format=j1'
var wrap = document.querySelector('.wrap')

function show(html) { wrap.innerHTML = html }

function text(node) {
  // wttr.in wraps every leaf in a one-element array of { value }.
  return node && node[0] && typeof node[0].value === 'string' ? node[0].value.trim() : ''
}

function placeOf(json) {
  var area = json && json.nearest_area && json.nearest_area[0]
  if (!area) return ''
  var name = text(area.areaName)
  if (!name) return ''
  var country = text(area.country)
  // The name as the source gives it, with its country for an unfamiliar
  // district. No table of our own: a second opinion about where the user is
  // would disagree with the first silently.
  return country && country !== name ? name + ', ' + country : name
}

// The response is the source's text, not markup: every other widget that draws
// a response escapes it, and this one wrote the place name straight into
// innerHTML, where the sandbox's 'unsafe-inline' would run a handler in it.
var esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML }

function load() {
  fetch(URL_J1)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(function (j) {
      var current = j && j.current_condition && j.current_condition[0]
      var t = current ? Number(current.temp_C) : NaN
      if (!isFinite(t)) throw new Error('no reading')

      var place = placeOf(j)
      if (!place) {
        // A temperature with no place is the defect this widget was changed to
        // fix, one step worse: conditions for somewhere unnamed are conditions
        // the user cannot tell are theirs.
        return show('<div class="note">Weather is unavailable for this location.</div>')
      }
      show('<div class="temp">' + Math.round(t) + '°C</div><div class="place">' + esc(place) + '</div>')
    })
    .catch(function () {
      // Failing inside its own frame: the panel around it is unaffected, and the
      // widget says so rather than showing an empty box.
      show('<div class="note">Weather is unavailable right now.</div>')
    })
}

TrailTabWidget.onInit(load)
