// Tetris — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { /* Given a box, expected to fit it — a widget that overflows is clipped,
     never scrolled, because the panel around it cannot scroll either. */
    overflow: hidden; margin: 0; height: 100%; background: transparent;
               font-family: system-ui, sans-serif; color: #e8ecf5; }
  body { display: flex; align-items: center; justify-content: center; gap: 14px; }
  canvas { background: rgba(255,255,255,0.04); border-radius: 4px; display: block; }
  /* A fixed width, because the pair is centred and the hint changes when play
     starts. Letting the panel size to its text moved the board sideways at the
     exact moment the user was about to use it. Wide enough for the playing
     hint, which wraps to two lines — a height change is free here, since the
     row centres vertically and nothing else depends on it. */
  .side { width: 132px; flex: 0 0 auto;
          font-size: 12px; opacity: 0.75; line-height: 1.6; text-align: left; }
  .side b { display: block; font-size: 20px; opacity: 1; }
  /* No focus ring. The canvas takes focus only from start(), so this ring was
     never a "you are here" for the keyboard — it only ever appeared during
     play, on top of the one thing the player is watching. That the widget holds
     the keyboard is the panel's statement to make, and it makes it by removing
     the cover. */
  canvas:focus, canvas:focus-visible { outline: none; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<!-- Authored at the smallest board \`fit()\` can produce (cell 6 x 20 rows), not at a
     comfortable one: until the panel sends \`init\` the canvas keeps these attributes,
     and a 240px board in a 190px hero overflowed the frame and showed its own
     scrollbar for that moment. Measured: 215px of content in a 190px box. -->
<canvas id="board" width="60" height="120" tabindex="0"></canvas>
<div class="side"><b id="score">0</b><span id="hint">Click to play</span></div>`)
})()
// No network at all. This widget exists to exercise the parts of the contract
// the other two never touch — focus handover and focus release — on something
// that genuinely uses them.
//
// `expand`/`collapse` are the protocol's names for gaining and losing the
// keyboard. They were named for a hero that could grow and no longer can; the
// names stay because widgets outside this repository are written against them.
var COLS = 10, ROWS = 20
var SHAPES = [
  [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]]
]
var canvas = document.getElementById('board')
var ctx = canvas.getContext('2d')
var scoreEl = document.getElementById('score')
var hintEl = document.getElementById('hint')

var grid, piece, playing = false, timer = null, score = 0, cell = 12

function reset() {
  grid = []
  for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0))
  score = 0
  scoreEl.textContent = '0'
  spawn()
}

function spawn() {
  var s = SHAPES[Math.floor(Math.random() * SHAPES.length)]
  piece = { shape: s, x: Math.floor((COLS - s[0].length) / 2), y: 0 }
  if (hits(piece.shape, piece.x, piece.y)) reset()
}

function hits(shape, x, y) {
  for (var r = 0; r < shape.length; r++) {
    for (var c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      var nx = x + c, ny = y + r
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true
      if (ny >= 0 && grid[ny][nx]) return true
    }
  }
  return false
}

function merge() {
  piece.shape.forEach(function (row, r) {
    row.forEach(function (v, c) { if (v && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = 1 })
  })
  for (var r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every(function (v) { return v })) {
      grid.splice(r, 1)
      grid.unshift(new Array(COLS).fill(0))
      score += 10
      scoreEl.textContent = String(score)
      r++
    }
  }
  spawn()
}

function drop() {
  if (hits(piece.shape, piece.x, piece.y + 1)) merge()
  else piece.y++
  draw()
}

function rotate() {
  var s = piece.shape
  var out = s[0].map(function (_, i) { return s.map(function (row) { return row[i] }).reverse() })
  if (!hits(out, piece.x, piece.y)) piece.shape = out
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#8d94a6'
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++)
      if (grid[r][c]) ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2)
  ctx.fillStyle = '#f7ec13'
  piece.shape.forEach(function (row, r) {
    row.forEach(function (v, c) {
      if (v) ctx.fillRect((piece.x + c) * cell + 1, (piece.y + r) * cell + 1, cell - 2, cell - 2)
    })
  })
}

// On the document, not the canvas: a click on the score or the hint moved focus
// to the body, and a canvas listener then heard nothing — the pieces kept
// falling and Escape could not leave. Keys reach the document from anywhere in
// it, which is where the keyboard is once the panel has handed it over.
document.addEventListener('keydown', function (e) {
  if (!playing) return
  // Escape is the widget's to handle: the panel cannot see keys inside this
  // document, so it cannot offer the way out on the widget's behalf.
  if (e.key === 'Escape') { stop(); return TrailTabWidget.releaseFocus() }
  if (e.key === 'ArrowLeft' && !hits(piece.shape, piece.x - 1, piece.y)) piece.x--
  else if (e.key === 'ArrowRight' && !hits(piece.shape, piece.x + 1, piece.y)) piece.x++
  else if (e.key === 'ArrowDown') return drop()
  else if (e.key === 'ArrowUp') rotate()
  else return
  e.preventDefault()
  draw()
})

function start() {
  playing = true
  hintEl.textContent = '← → to move, ↑ to turn, Esc to leave'
  canvas.focus()
  if (!timer) timer = setInterval(drop, 600)
}

function stop() {
  playing = false
  hintEl.textContent = 'Click to play'
  if (timer) { clearInterval(timer); timer = null }
}

function fit(size) {
  // The board takes the height it is given, within reason; the side panel keeps
  // its own width out of the calculation.
  //
  // Reverted to what it was before the panel work: the 12px margin and the
  // whole-number cell are back, and with them the band above and below the
  // board that varies with the height. Two replacements were tried and both
  // were worse in the user's eyes — taking the whole height put the board flush
  // against the panel's clipped edge, and a constant inset shrank it. Restored
  // on request; the band is a known cost, not an oversight.
  cell = Math.max(6, Math.floor(Math.min((size.height || 200) - 12, 420) / ROWS))
  canvas.height = cell * ROWS
  canvas.width = cell * COLS
  draw()
}

TrailTabWidget.onInit(function (init) { reset(); fit(init) })
TrailTabWidget.onExpand(function (size) { fit(size); start() })
TrailTabWidget.onCollapse(function (size) { stop(); fit(size) })
