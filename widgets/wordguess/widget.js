// Five letters — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body { background: transparent; color: #e8ecf5; }
  /* No ring around the whole widget: the panel says it is active by taking the
     cover away. Where the caret is it does not say — \`.at\` does. */
  .wrap { display: flex; gap: 10px; padding: 8px; height: 100%; box-sizing: border-box; outline: none; }
  .board { display: grid; grid-auto-rows: var(--t); gap: 2px; }
  .row { display: grid; grid-template-columns: repeat(5, var(--t)); gap: 2px; }
  .t {
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; text-transform: uppercase;
    background: rgba(255,255,255,.07); border-radius: 3px;
    border-bottom: 3px solid transparent;
  }
  /* Colour is how this game is usually read, and not every player can read it.
     The bar under a letter carries the same three states in shape — solid in
     place, dashed in the word, absent for absent — via \`border-bottom-style\`,
     which a test can check. An earlier version drew the dashes with
     \`border-image\`, whose computed style is identical to \`solid\`: a
     distinction nothing could verify. */
  .ok  { background: rgba(127,214,163,.30); border-bottom-color: #7fd6a3; }
  .near{ background: rgba(255,212,121,.26);
         border-bottom-style: dashed; border-bottom-color: #ffd479; }
  .no  { background: rgba(255,255,255,.03); opacity: .45; border-bottom-style: none; }
  /* The caret's cell, at two strengths for two questions: faint says where you
     are, lit says the keyboard actually arrived — which happens only when the
     panel hands it over, and is what looks broken before that. Inset, clear of
     the bottom border carrying the letter's state. */
  .t.at { box-shadow: inset 0 0 0 2px #ffffff33; }
  .wrap:focus .t.at { box-shadow: inset 0 0 0 2px #9fd8ff; background: #9fd8ff1f; }
  .side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .bank { display: flex; flex-wrap: wrap; gap: 3px; align-content: flex-start; font-size: 11px; }
  .bank span { padding: 1px 4px; border-radius: 3px; text-transform: uppercase;
               background: rgba(255,255,255,.07); border-bottom: 2px solid transparent; }
  /* The bank repeats the shapes, so a letter's state is readable twice and
     never only by hue. */
  .bank .ok { border-bottom-color: #7fd6a3; }
  .bank .near { border-bottom-style: dashed; border-bottom-color: #ffd479; }
  .bank .no { opacity: .35; text-decoration: line-through; }
  .strip { font-size: 11px; opacity: .75; margin-top: auto; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<div class="wrap" id="wrap" tabindex="0">
  <div>
    <div class="board" id="board"></div>
  </div>
  <div class="side"><div class="bank" id="bank"></div><div class="strip" id="strip"></div></div>
</div>`)
})()

// The word lists arrive as the widget's data file, as text: '#' lines carry
// SCOWL's notice, and two lines carry the packed lists. The page read them
// from a second script; a library widget is one script and one data file.
var WORD_ANSWERS = ''
var WORD_GUESSES = ''
;(TrailTabWidget.data || '').split('\n').forEach(function (line) {
  if (line.indexOf('ANSWERS ') === 0) WORD_ANSWERS = line.slice(8)
  if (line.indexOf('GUESSES ') === 0) WORD_GUESSES = line.slice(8)
})
if (!WORD_ANSWERS || !WORD_GUESSES) TrailTabWidget.fail('The word list did not arrive.')
// Six tries at a five-letter word. Not named after any published version: the
// mechanic is not ownable, a name is.
//
// Two lists, from SCOWL — see words.js for its licence notice. What is fair to
// *ask* is a much smaller set than what is acceptable to *offer*, so answers
// come from the common band and guesses from a wider one. A non-word is refused
// without spending a try: a try lost to a typo is the worst this game can do.
var TRIES = 6
var LEN = 5
var wrap = document.getElementById('wrap')
var boardEl = document.getElementById('board')
var bankEl = document.getElementById('bank')
var stripEl = document.getElementById('strip')

var answers = unpack(WORD_ANSWERS)
var accepted = {}
unpack(WORD_GUESSES).forEach(function (w) { accepted[w] = 1 })

function unpack(s) {
  var out = []
  for (var i = 0; i < s.length; i += LEN) out.push(s.substr(i, LEN))
  return out
}

var word, rows, slots, at, done, message

function reset() {
  word = answers[Math.floor(Math.random() * answers.length)]
  rows = [] // { guess, marks }
  slots = Array(LEN).fill('')
  at = 0 // the cell a letter lands in
  done = null    // null | 'won' | 'lost'
  message = ''
  render()
}

// Two passes: a letter guessed twice must not be marked present twice when the
// answer holds it once. The first takes exact hits out of the pool; only what
// is left can answer a misplaced letter.
function mark(guess) {
  var pool = {}
  var marks = []
  var i
  for (i = 0; i < LEN; i++) {
    if (guess[i] !== word[i]) pool[word[i]] = (pool[word[i]] || 0) + 1
  }
  for (i = 0; i < LEN; i++) {
    if (guess[i] === word[i]) marks.push('ok')
    else if (pool[guess[i]]) { pool[guess[i]]--; marks.push('near') }
    else marks.push('no')
  }
  return marks
}

function put(i) { at = i < 0 ? 0 : i > LEN - 1 ? LEN - 1 : i }

function submit() {
  var guess = slots.join('')
  if (guess.length < LEN) { message = 'Five letters.'; return render() }
  if (!accepted[guess]) { message = 'Not a word I know.'; return render() }
  var marks = mark(guess)
  rows.push({ guess: guess, marks: marks })
  if (guess === word) done = 'won'
  else if (rows.length === TRIES) done = 'lost'
  slots = Array(LEN).fill('')
  at = 0
  message = ''
  render()
}

function best(a, b) { return a === 'ok' || b === 'ok' ? 'ok' : a === 'near' || b === 'near' ? 'near' : 'no' }

function render() {
  var html = ''
  for (var r = 0; r < TRIES; r++) {
    var row = rows[r]
    // A string for a played row, the slots for the live one: both index by cell.
    var text = row ? row.guess : (r === rows.length ? slots : '')
    var caret = !done && r === rows.length ? at : -1
    html += '<div class="row">'
    for (var c = 0; c < LEN; c++) {
      var cls = row ? ' ' + row.marks[c] : c === caret ? ' at' : ''
      html += '<div class="t' + cls + '">' + (text[c] || '') + '</div>'
    }
    html += '</div>'
  }
  boardEl.innerHTML = html

  var state = {}
  for (var i = 0; i < rows.length; i++) {
    for (var j = 0; j < LEN; j++) {
      var ch = rows[i].guess[j]
      state[ch] = state[ch] ? best(state[ch], rows[i].marks[j]) : rows[i].marks[j]
    }
  }
  var bank = ''
  for (var k = 0; k < 26; k++) {
    var letter = String.fromCharCode(97 + k)
    bank += '<span class="' + (state[letter] || '') + '">' + letter + '</span>'
  }
  bankEl.innerHTML = bank

  stripEl.textContent = done === 'won'
    ? 'Got it in ' + rows.length + '. Enter for another.'
    : done === 'lost'
      ? 'It was ' + word.toUpperCase() + '. Enter for another.'
      : message || (TRIES - rows.length) + ' tries left'
}

wrap.addEventListener('keydown', function (e) {
  // Escape is the widget's: the parent cannot see keys inside this sandbox, so
  // this is the only place the keyboard can be handed back.
  if (e.key === 'Escape') return TrailTabWidget.releaseFocus()
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (done) { if (e.key === 'Enter') { e.preventDefault(); reset() } return }

  if (e.key === 'Enter') { e.preventDefault(); return submit() }

  // Five cells, not a queue: append-only made a wrong second letter cost the
  // three after it.
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    put(at + (e.key === 'ArrowRight' ? 1 : -1))
    return render()
  }
  if (e.key === 'Backspace') {
    e.preventDefault()
    if (!slots[at]) put(at - 1) // clears where it stands, else steps back
    slots[at] = ''
    message = ''
    return render()
  }
  if (/^[a-zA-Z]$/.test(e.key)) {
    e.preventDefault()
    slots[at] = e.key.toLowerCase()
    put(at + 1)
    message = ''
    render()
  }
})

function fit(size) {
  // Sized from the height — five wide, six tall, in a box twice as wide as it
  // is high — and the width left over holds the bank.
  var h = (size && size.height) || 180
  var t = Math.max(14, Math.floor((h - 16 - 18) / TRIES))
  wrap.style.setProperty('--t', t + 'px')
  boardEl.style.fontSize = Math.round(t * 0.5) + 'px'
}

TrailTabWidget.onInit(function (init) { reset(); fit(init) })
TrailTabWidget.onExpand(function (size) { fit(size); wrap.focus() })
TrailTabWidget.onCollapse(function (size) { fit(size) })
