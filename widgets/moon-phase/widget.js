// The moon tonight: its phase, how much of it is lit, and when it next turns.
//
// Computed, not fetched — it reaches nothing, so it needs no consent and
// declares `contacts: null`. The price is precision, and it is stated rather
// than hidden: this uses the mean synodic month, and a real phase lands up to
// about fourteen hours either side of the mean one. So the lit fraction is
// shown to the percent, which that error barely moves, while the next full and
// new moon are given in whole days and hedged, because hours would claim more
// than the arithmetic knows.
//
// Drawn as seen from the northern hemisphere, waxing on the right. A widget
// has no way to learn where its reader is without asking a network for it, and
// guessing from the clock's time zone would be a guess dressed as a fact.
;(function () {
  'use strict'

  var SYNODIC_DAYS = 29.530588853
  // A known new moon, 2000-01-06 18:14 UTC — the usual epoch for this.
  var EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14)
  var DAY_MS = 86400000

  var NAMES = [
    'New moon',
    'Waxing crescent',
    'First quarter',
    'Waxing gibbous',
    'Full moon',
    'Waning gibbous',
    'Last quarter',
    'Waning crescent',
  ]

  // Styles go in by hand: the payload arrives as a script inside the shell
  // page, so there is no <head> of its own to write them into.
  var style = document.createElement('style')
  style.textContent =
    'html,body{overflow:hidden}' +
    '.moon{display:flex;align-items:center;justify-content:center;gap:6%;height:100vh;box-sizing:border-box;padding:0 6%}' +
    '.moon svg{height:78vh;width:78vh;flex:none}' +
    '.moon .text{min-width:0}' +
    '.moon .name{font-size:11vh;font-weight:650;line-height:1.1}' +
    '.moon .lit{margin-top:3vh;font-size:6.5vh;opacity:.85}' +
    '.moon .next{margin-top:5vh;font-size:5.5vh;line-height:1.45;opacity:.65}'
  document.head.appendChild(style)

  var root = document.createElement('div')
  root.className = 'moon'
  document.body.appendChild(root)

  /** Days into the current lunation, in [0, SYNODIC_DAYS). */
  function age(now) {
    var days = (now - EPOCH_MS) / DAY_MS
    return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS
  }

  // Eight names, each owning the eighth of the month centred on its moment,
  // so "Full moon" means within about two days of full rather than the instant.
  function name(a) {
    return NAMES[Math.floor((a / SYNODIC_DAYS) * 8 + 0.5) % 8]
  }

  // `n` counts forward to the next one, so a moment just past full reads as a
  // whole month away. Within half a day either side it is today — found by
  // drawing a full moon that announced the next one in 29 days.
  function days(n) {
    var d = n > SYNODIC_DAYS - 0.5 ? 0 : Math.round(n)
    if (d <= 0) return 'today'
    return d === 1 ? 'in about a day' : 'in about ' + d + ' days'
  }

  // The lit shape is two arcs: the limb on the lit side, a half circle, and
  // the terminator back, a half ellipse whose width is |cos| of the phase
  // angle. Which way each one sweeps is what turns a crescent into a gibbous.
  function litPath(angle, r) {
    var c = Math.cos(angle)
    var rx = Math.abs(c) * r
    var waxing = angle < Math.PI
    var limbSweep = waxing ? 1 : 0
    var terminatorSweep = waxing ? (c > 0 ? 0 : 1) : c > 0 ? 1 : 0
    return (
      'M 50 ' + (50 - r) +
      ' A ' + r + ' ' + r + ' 0 0 ' + limbSweep + ' 50 ' + (50 + r) +
      ' A ' + rx.toFixed(3) + ' ' + r + ' 0 0 ' + terminatorSweep + ' 50 ' + (50 - r) +
      ' Z'
    )
  }

  function draw() {
    var now = Date.now()
    var a = age(now)
    var angle = (a / SYNODIC_DAYS) * 2 * Math.PI
    var lit = (1 - Math.cos(angle)) / 2
    var toFull = (SYNODIC_DAYS / 2 - a + SYNODIC_DAYS) % SYNODIC_DAYS
    var toNew = SYNODIC_DAYS - a
    var r = 46

    root.innerHTML =
      '<svg viewBox="0 0 100 100" role="img" aria-label="' + name(a) + '">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="#e8ecf5" fill-opacity=".1"/>' +
      '<path d="' + litPath(angle, r) + '" fill="#f3efe0"/>' +
      '</svg>' +
      '<div class="text">' +
      '<div class="name">' + name(a) + '</div>' +
      '<div class="lit">' + Math.round(lit * 100) + '% lit</div>' +
      '<div class="next">Full moon ' + days(toFull) + '<br>New moon ' + days(toNew) + '</div>' +
      '</div>'
  }

  // Started the way every widget starts. The protocol answers even though this
  // code was delivered after the panel sent the message, so there is one way to
  // write a widget rather than one per provenance.
  TrailTabWidget.onInit(function () {
    draw()
    // A tab can stay open across a night. Half an hour is finer than any figure
    // shown here changes.
    setInterval(draw, 30 * 60 * 1000)
  })

  // Sizing is in viewport units, so a resize redraws itself: the box is never
  // read here, and the size messages have nothing to do.
})()
