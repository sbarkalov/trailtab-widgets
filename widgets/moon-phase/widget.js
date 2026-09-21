// The moon tonight: its phase, how much of it is lit, and when it next turns.
//
// Computed, not fetched — it reaches nothing, so `contacts: null` and no
// consent. The price is precision, stated rather than hidden: the mean synodic
// month puts a real phase up to fourteen hours either side of this one, so the
// lit fraction is given to the percent, which that error barely moves, and the
// next full and new moon in whole days, hedged.
//
// Northern hemisphere, waxing on the right. Where the reader is cannot be known
// without asking a network, and the clock's time zone would be a guess dressed
// as a fact.
;(function () {
  'use strict'

  var SYNODIC_DAYS = 29.530588853
  // A known new moon, 2000-01-06 18:14 UTC — the usual epoch for this.
  var EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14)
  var DAY_MS = 86400000

  var NAMES = [
    'New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
    'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent',
  ]

  // Styles by hand: the payload runs inside the shell, which has no <head> of
  // its own to write them into.
  var style = document.createElement('style')
  style.textContent =
    'html,body{overflow:hidden}' +
    '.moon{display:flex;align-items:center;justify-content:center;gap:5%;height:100vh;box-sizing:border-box;padding:0 5%}' +
    '.moon svg{height:88vh;width:88vh;flex:none;margin-left:-4%}' +
    '.moon .text{min-width:0}' +
    // The moon is the picture; the words are its caption.
    '.moon .name{font-size:11.5vh;font-weight:600;line-height:1.08;letter-spacing:-.02em}' +
    '.moon .lit{margin-top:2.5vh;font-size:6vh;opacity:.62;letter-spacing:.01em}' +
    '.moon .next{margin-top:5vh;font-size:5.2vh;line-height:1.6;opacity:.5}' +
    // The figures are what a reader compares; the sentence can recede.
    '.moon .next b{font-weight:600;opacity:1.3}'
  document.head.appendChild(style)

  var root = document.createElement('div')
  root.className = 'moon'
  document.body.appendChild(root)

  /** Days into the lunation, in [0, SYNODIC_DAYS). */
  function age(now) {
    var days = (now - EPOCH_MS) / DAY_MS
    return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS
  }

  // Eight names, each owning the eighth of the month centred on its moment, so
  // "Full moon" means within about two days of it rather than the instant.
  function name(a) {
    return NAMES[Math.floor((a / SYNODIC_DAYS) * 8 + 0.5) % 8]
  }

  // `n` counts forward, so a moment just past full reads as a whole month away.
  // Within half a day either side it is today — found drawing a full moon that
  // announced the next one in 29 days.
  function days(n) {
    var d = n > SYNODIC_DAYS - 0.5 ? 0 : Math.round(n)
    if (d <= 0) return '<b>today</b>'
    return d === 1 ? 'in about <b>a day</b>' : 'in about <b>' + d + ' days</b>'
  }

  // The night side, laid over the whole disc rather than a lit shape cut out of
  // nothing. That is what lets the moon have a surface — seas and craters are
  // painted once and the shadow passes over them — and what leaves the unlit
  // part faintly visible, which is true: earthshine.
  //
  // Two arcs: the limb on the *dark* side, then the terminator back, a half
  // ellipse of width |cos|. The sweeps are what make a crescent or a gibbous.
  function nightPath(angle, r) {
    var c = Math.cos(angle)
    var rx = Math.abs(c) * r
    var waxing = angle < Math.PI
    // The limb opposite the lit one, so this covers what the light does not.
    var limbSweep = waxing ? 0 : 1
    var terminatorSweep = waxing ? (c > 0 ? 0 : 1) : c > 0 ? 1 : 0
    return (
      'M 50 ' + (50 - r) +
      ' A ' + r + ' ' + r + ' 0 0 ' + limbSweep + ' 50 ' + (50 + r) +
      ' A ' + rx.toFixed(3) + ' ' + r + ' 0 0 ' + terminatorSweep + ' 50 ' + (50 - r) +
      ' Z'
    )
  }

  // The face, fixed because the moon's is: the same side faces us every night,
  // and one that reshuffled per draw would be a lava lamp. Eyeballed from the
  // near side rather than surveyed.
  var SEAS =
    '<ellipse cx="38" cy="33" rx="14" ry="10" transform="rotate(-18 38 33)"/>' +
    '<ellipse cx="57" cy="27" rx="10" ry="8"/>' +
    '<ellipse cx="71" cy="37" rx="6" ry="5"/>' +
    '<ellipse cx="32" cy="53" rx="11" ry="13" transform="rotate(12 32 53)"/>' +
    '<ellipse cx="49" cy="44" rx="8" ry="6"/>' +
    '<ellipse cx="25" cy="69" rx="8" ry="5" transform="rotate(-25 25 69)"/>'
  // A pit with a lit rim each: flat grey discs read as stickers, which is what
  // the first draft looked like.
  var CRATERS = [
    [47, 76, 4], [62, 65, 2.6], [71, 55, 1.8], [24, 40, 2],
    [59, 81, 1.5], [36, 86, 1.8], [18, 57, 1.4], [42, 62, 1.6],
  ]
  var PITS = CRATERS.map(function (c) {
    return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '"/>'
  }).join('')
  // Rims offset toward the sun — one direction, because one sun lights them.
  function rims(waxing) {
    return CRATERS.map(function (c) {
      var d = c[2] * 0.28
      return (
        '<circle cx="' + (c[0] + (waxing ? d : -d)).toFixed(2) + '" cy="' +
        (c[1] - d).toFixed(2) + '" r="' + c[2] + '"/>'
      )
    }).join('')
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
      '<defs>' +
      // Lit from one side, so the face is not flat.
      '<radialGradient id="face" cx="' + (angle < Math.PI ? 68 : 32) + '%" cy="34%" r="76%">' +
      '<stop offset="0" stop-color="#fffdf4"/><stop offset=".62" stop-color="#f1ecdb"/>' +
      '<stop offset="1" stop-color="#cdc6b4"/></radialGradient>' +
      // A halo, not a glow: weak, and gone before the edge of the box.
      '<radialGradient id="halo"><stop offset=".45" stop-color="#cfd8ef" stop-opacity=".2"/>' +
      '<stop offset="1" stop-color="#cfd8ef" stop-opacity="0"/></radialGradient>' +
      // A shadow's edge, not a cut — softest at a quarter, where the sun
      // grazes the surface.
      '<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feGaussianBlur stdDeviation="' + (0.6 + 1.5 * Math.abs(Math.sin(angle))).toFixed(2) + '"/>' +
      '</filter>' +
      // The seas have no edges to speak of; drawn sharp they read as stickers.
      '<filter id="blur"><feGaussianBlur stdDeviation="2.4"/></filter>' +
      '<clipPath id="disc"><circle cx="50" cy="50" r="' + r + '"/></clipPath>' +
      '</defs>' +
      '<circle cx="50" cy="50" r="49" fill="url(#halo)"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="url(#face)"/>' +
      '<g clip-path="url(#disc)">' +
      '<g fill="#6f6d62" fill-opacity=".28" filter="url(#blur)">' + SEAS + '</g>' +
      '<g fill="#fffcef" fill-opacity=".3">' + rims(angle < Math.PI) + '</g>' +
      '<g fill="#77746a" fill-opacity=".26">' + PITS + '</g>' +
      // The night side over all of it. Not opaque: what shows through is the
      // earthshine, and it is why the dark limb is visible at all.
      '<path d="' + nightPath(angle, r) + '" fill="#0d1120" fill-opacity=".9" ' +
      'filter="url(#soft)"/>' +
      '</g>' +
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
