// Minesweeper — a widget the extension ships, published here as its source.
// Ported from a page of its own: the page set its styles and markup in HTML,
// and here the script writes them, since the shell holds nothing but the
// protocol. Everything below the preamble is the page's script, unchanged.
;(function () {
  var style = document.createElement('style')
  style.textContent = `
  html, body { overflow: hidden; margin: 0; height: 100%; font-family: system-ui, sans-serif; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: transparent; color: #e8ecf5;
  }
  /* No focus ring: the panel says the widget is active by taking its cover
     away. Where the cursor is is a different question; the grid shows it. */
  canvas { display: block; outline: none; }
  .strip { height: 18px; line-height: 18px; font-size: 11px; opacity: 0.7; }
`
  document.head.appendChild(style)
  document.body.insertAdjacentHTML('afterbegin', `<canvas id="grid" width="60" height="30" tabindex="0"></canvas>
<div class="strip" id="strip"></div>`)
})()
// One game at every size: the grid is fixed, the cell derived from the box.
// Growing the grid instead would make the large box a harder game. 16 x 8 is
// what the *smaller* box allows — 18px cells there, 35px large; 20 columns
// would be 14px, too small to aim at.
var COLS = 16
var ROWS = 8
var MINES = 20
var STRIP = 18
var PAD = 8

var canvas = document.getElementById('grid')
var ctx = canvas.getContext('2d')
var strip = document.getElementById('strip')

var cell = 18
var cells = []       // { mine, open, flag, near }
var placed = false   // mines go down after the first reveal, never before
var over = null      // null | 'won' | 'lost'
var cur = { x: 0, y: 0 }
var showCursor = false

var HUE = ['', '#7fb2ff', '#7fd6a3', '#ff9a8a', '#c8a6ff', '#ffd479', '#7fe0e0', '#e8ecf5', '#b0b6c4']

function idx(x, y) { return y * COLS + x }
function inside(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS }

function neighbours(x, y, fn) {
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && inside(x + dx, y + dy)) fn(x + dx, y + dy)
    }
  }
}

function reset() {
  cells = []
  for (var i = 0; i < COLS * ROWS; i++) cells.push({ mine: 0, open: 0, flag: 0, near: 0 })
  placed = false
  over = null
  cur = { x: 0, y: 0 }
  draw()
}

// Mines are laid after the first cell is chosen, excluding it and its
// neighbours — so the first move opens a region, not one number.
function place(safeX, safeY) {
  var free = []
  for (var y = 0; y < ROWS; y++) {
    for (var x = 0; x < COLS; x++) {
      if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue
      free.push(idx(x, y))
    }
  }
  for (var n = 0; n < MINES && free.length; n++) {
    var pick = Math.floor(Math.random() * free.length)
    cells[free[pick]].mine = true
    free.splice(pick, 1)
  }
  for (var yy = 0; yy < ROWS; yy++) {
    for (var xx = 0; xx < COLS; xx++) {
      var count = 0
      neighbours(xx, yy, function (nx, ny) { if (cells[idx(nx, ny)].mine) count++ })
      cells[idx(xx, yy)].near = count
    }
  }
  placed = true
}

function open(x, y) {
  var c = cells[idx(x, y)]
  if (c.open || c.flag) return
  c.open = true
  if (c.mine) { over = 'lost'; return }
  // An empty cell opens its neighbours, and they theirs.
  if (c.near === 0) {
    var queue = [[x, y]]
    while (queue.length) {
      var p = queue.pop()
      neighbours(p[0], p[1], function (nx, ny) {
        var n = cells[idx(nx, ny)]
        if (n.open || n.flag) return
        n.open = true
        if (n.near === 0) queue.push([nx, ny])
      })
    }
  }
}

function checkWon() {
  for (var i = 0; i < cells.length; i++) {
    if (!cells[i].mine && !cells[i].open) return
  }
  over = 'won'
}

function reveal(x, y) {
  if (over || !inside(x, y)) return
  if (!placed) place(x, y)
  open(x, y)
  if (!over) checkWon()
  draw()
}

function flag(x, y) {
  if (over || !inside(x, y)) return
  var c = cells[idx(x, y)]
  if (c.open) return
  c.flag = !c.flag
  draw()
}

// Both buttons on a satisfied number open the rest. A misplaced flag loses the
// game: checking first would remove flagging's only consequence.
function chord(x, y) {
  if (over || !inside(x, y)) return
  var c = cells[idx(x, y)]
  if (!c.open || !c.near) return
  var f = 0
  neighbours(x, y, function (nx, ny) { if (cells[idx(nx, ny)].flag) f++ })
  if (f !== c.near) return
  neighbours(x, y, function (nx, ny) { open(nx, ny) })
  if (!over) checkWon()
  draw()
}

function flagsUsed() {
  var n = 0
  for (var i = 0; i < cells.length; i++) if (cells[i].flag) n++
  return n
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (var y = 0; y < ROWS; y++) {
    for (var x = 0; x < COLS; x++) {
      var c = cells[idx(x, y)]
      var px = x * cell
      var py = y * cell
      var lost = over === 'lost'

      ctx.fillStyle = c.open ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.14)'
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2)

      ctx.font = Math.round(cell * 0.6) + 'px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      var cx = px + cell / 2
      var cy = py + cell / 2 + 1

      if (c.flag) {
        ctx.fillStyle = '#ffd479'
        ctx.fillText('⚑', cx, cy)
      } else if (lost && c.mine) {
        ctx.fillStyle = '#ff9a8a'
        ctx.fillText('✹', cx, cy)
      } else if (c.open && c.near) {
        ctx.fillStyle = HUE[c.near]
        ctx.fillText(String(c.near), cx, cy)
      }

      if (showCursor && cur.x === x && cur.y === y) {
        ctx.strokeStyle = '#e8ecf5'
        ctx.lineWidth = 2
        ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2)
      }
    }
  }

  var left = MINES - flagsUsed()
  strip.textContent = over === 'won'
    ? 'Cleared. R for another.'
    : over === 'lost'
      ? 'Hit a mine. R for another.'
      : left + ' left · right-click or F'
}

function at(event) {
  var box = canvas.getBoundingClientRect()
  return {
    x: Math.floor((event.clientX - box.left) / cell),
    y: Math.floor((event.clientY - box.top) / cell),
  }
}

canvas.addEventListener('mousedown', function (e) {
  canvas.focus()
  showCursor = false
  var p = at(e)
  // `buttons` is what is held now, so the second press is the whole signal.
  // The first press cost nothing: on a revealed cell — the only place this
  // applies — reveal and flag both refuse.
  if (e.buttons === 3) chord(p.x, p.y)
  else if (e.button === 2) flag(p.x, p.y)
  else if (e.button === 0) reveal(p.x, p.y)
})

// The secondary click belongs to the game, or the browser's menu takes it.
canvas.addEventListener('contextmenu', function (e) { e.preventDefault() })

// On the document, not the canvas: a click on the strip or the margin moved
// focus to the body, and a canvas listener then heard nothing, Escape included.
// This document only has the keyboard after the panel handed it over, so no
// further guard is needed.
document.addEventListener('keydown', function (e) {
  // Escape is the widget's: the parent cannot see keys inside this sandbox, so
  // this is the only place the keyboard can be handed back.
  if (e.key === 'Escape') { showCursor = false; draw(); return TrailTabWidget.releaseFocus() }

  var moved = true
  switch (e.key) {
    case 'ArrowLeft': cur.x = Math.max(0, cur.x - 1); break
    case 'ArrowRight': cur.x = Math.min(COLS - 1, cur.x + 1); break
    case 'ArrowUp': cur.y = Math.max(0, cur.y - 1); break
    case 'ArrowDown': cur.y = Math.min(ROWS - 1, cur.y + 1); break
    default: moved = false
  }
  if (moved) { showCursor = true; e.preventDefault(); return draw() }

  // No new binding: the key means "act on this cell"; on an open one, chord.
  if (e.key === ' ' || e.key === 'Enter') {
    showCursor = true
    e.preventDefault()
    return cells[idx(cur.x, cur.y)].open ? chord(cur.x, cur.y) : reveal(cur.x, cur.y)
  }
  if (e.key === 'f' || e.key === 'F') { showCursor = true; e.preventDefault(); return flag(cur.x, cur.y) }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); return reset() }
})

function fit(size) {
  // The grid stays; the box decides the cell. What the gutter and strip leave
  // is the grid's.
  var w = (size && size.width) || 360
  var h = (size && size.height) || 180
  cell = Math.max(8, Math.floor(Math.min((w - PAD * 2) / COLS, (h - PAD * 2 - STRIP) / ROWS)))
  canvas.width = cell * COLS
  canvas.height = cell * ROWS
  draw()
}

TrailTabWidget.onInit(function (init) { reset(); fit(init) })
TrailTabWidget.onExpand(function (size) { fit(size); canvas.focus() })
TrailTabWidget.onCollapse(function (size) { showCursor = false; fit(size) })
