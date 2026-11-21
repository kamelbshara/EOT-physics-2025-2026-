// Handwriting surface for the solution notebook (student) and the teacher's marking layer.
// Strokes are vectors in a fixed 1000 × 1400 page space, so a page looks the same on any screen.
import { t } from './language.js'

export const PAGE_W = 1000, PAGE_H = 1400
export const COLORS = ['#1d2b2a', '#1f5fbf', '#c0392b', '#1d7a4c', '#c77c0e', '#7b3fb5', '#d6337f', '#0e8a92']
const WIDTHS = [2, 4, 8]

function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n }

// layers: [{ name, strokes, editable, color }]; the editable layer receives new ink.
// question: { text, options: [string], dir } is printed at the top of the page when the background carries +question
export function createSketchpad(host, { layers, background = 'blank', figureUrl = null, question = null, onChange = () => {}, toolbar = true } = {}) {
  const state = { tool: 'pen', color: layers.find(l => l.editable)?.color || COLORS[0], width: 1, zoom: 1, penOnly: false, background, figure: null, replaying: false }
  const editable = layers.find(l => l.editable) || null
  const undo = [], redo = []
  const root = node('div', 'sketch')
  const bar = node('div', 'sketch-bar')
  const scroller = node('div', 'sketch-scroll')
  const canvas = node('canvas', 'sketch-canvas')
  canvas.setAttribute('aria-label', t('Handwriting page', 'صفحة الكتابة'))
  scroller.append(canvas)
  root.append(bar, scroller)
  host.replaceChildren(root)
  const ctx = canvas.getContext('2d')

  // ---------------------------------------------------------------- toolbar
  const buttons = {}
  function tbtn(id, label, title, onclick, group) {
    const b = node('button', 'sk-btn', label); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title)
    b.onclick = onclick; if (group) b.dataset.group = group; buttons[id] = b; return b
  }
  function refreshBar() {
    for (const [id, b] of Object.entries(buttons)) {
      if (b.dataset.group === 'tool') b.setAttribute('aria-pressed', state.tool === id)
      if (b.dataset.group === 'width') b.setAttribute('aria-pressed', 'w' + state.width === id)
      if (b.dataset.group === 'color') b.setAttribute('aria-pressed', state.color === b.dataset.color)
    }
    buttons.undo && (buttons.undo.disabled = !undo.length)
    buttons.redo && (buttons.redo.disabled = !redo.length)
    buttons.penOnly && buttons.penOnly.setAttribute('aria-pressed', state.penOnly)
  }
  if (toolbar && editable) {
    const tools = node('div', 'sk-group')
    tools.append(
      tbtn('pen', '✎', t('Pen', 'قلم'), () => { state.tool = 'pen'; refreshBar() }, 'tool'),
      tbtn('hl', '▮', t('Highlighter', 'قلم تظليل'), () => { state.tool = 'hl'; refreshBar() }, 'tool'),
      tbtn('line', '╱', t('Straight line', 'خط مستقيم'), () => { state.tool = 'line'; refreshBar() }, 'tool'),
      tbtn('arrow', '➚', t('Arrow', 'سهم'), () => { state.tool = 'arrow'; refreshBar() }, 'tool'),
      tbtn('eraser', '⌫', t('Eraser', 'ممحاة'), () => { state.tool = 'eraser'; refreshBar() }, 'tool'))
    const colors = node('div', 'sk-group sk-colors')
    for (const c of COLORS) { const b = tbtn('c' + c, '', t('Colour', 'لون'), () => { state.color = c; if (state.tool === 'eraser') state.tool = 'pen'; refreshBar() }, 'color'); b.dataset.color = c; b.style.setProperty('--swatch', c); colors.append(b) }
    const widths = node('div', 'sk-group')
    WIDTHS.forEach((w, i) => { const b = tbtn('w' + i, '', t('Thickness', 'السماكة'), () => { state.width = i; refreshBar() }, 'width'); b.style.setProperty('--dot', (4 + i * 4) + 'px'); b.classList.add('sk-width'); widths.append(b) })
    const actions = node('div', 'sk-group')
    actions.append(
      tbtn('undo', '↶', t('Undo', 'تراجع'), () => doUndo()),
      tbtn('redo', '↷', t('Redo', 'إعادة'), () => doRedo()),
      tbtn('clear', '🗑', t('Clear my ink', 'مسح كتابتي'), () => { if (editable.strokes.length && confirm(t('Clear everything you wrote on this page?', 'مسح كل ما كتبته في هذه الصفحة؟'))) { undo.push({ type: 'clear', strokes: editable.strokes.slice() }); redo.length = 0; editable.strokes.length = 0; changed() } }))
    const view = node('div', 'sk-group')
    const bg = node('select', 'sk-select'); bg.setAttribute('aria-label', t('Page background', 'خلفية الصفحة'))
    for (const [v, en, ar] of [['blank', 'Blank', 'فارغة'], ['lined', 'Lined', 'مسطّرة'], ['grid', 'Grid', 'مربعات'], ['axes', 'Axes', 'محاور']]) { const o = node('option', '', t(en, ar)); o.value = v; bg.append(o) }
    bg.value = state.background.split('+')[0]
    bg.onchange = () => { state.background = bg.value + (state.background.includes('+') ? state.background.slice(state.background.indexOf('+')) : ''); render(); onChange('background') }
    view.append(bg,
      tbtn('zoomOut', '−', t('Zoom out', 'تصغير'), () => setZoom(state.zoom / 1.25)),
      tbtn('zoomIn', '+', t('Zoom in', 'تكبير'), () => setZoom(state.zoom * 1.25)),
      tbtn('penOnly', '✍', t('Pen only (ignore palm and finger)', 'القلم فقط (تجاهل راحة اليد والإصبع)'), () => { state.penOnly = !state.penOnly; refreshBar() }))
    bar.append(tools, colors, widths, actions, view)
  } else if (toolbar) {
    const view = node('div', 'sk-group')
    view.append(tbtn('zoomOut', '−', t('Zoom out', 'تصغير'), () => setZoom(state.zoom / 1.25)), tbtn('zoomIn', '+', t('Zoom in', 'تكبير'), () => setZoom(state.zoom * 1.25)))
    bar.append(view)
  }
  refreshBar()

  // ---------------------------------------------------------------- geometry
  let scale = 1
  function resize() {
    const avail = Math.max(260, scroller.clientWidth - 2)
    const cssW = Math.round(avail * state.zoom)
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    canvas.style.width = cssW + 'px'
    canvas.style.height = Math.round(cssW * PAGE_H / PAGE_W) + 'px'
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssW * PAGE_H / PAGE_W * dpr)
    scale = canvas.width / PAGE_W
    render()
  }
  function setZoom(z) { state.zoom = Math.min(3, Math.max(1, z)); resize() }
  const observer = new ResizeObserver(() => resize())
  observer.observe(scroller)

  // ---------------------------------------------------------------- drawing
  function drawBackground() {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    const kind = state.background.split('+')[0]
    ctx.save(); ctx.scale(scale, scale)
    ctx.lineWidth = 1
    if (kind === 'lined') { ctx.strokeStyle = '#d7e3ee'; for (let y = 60; y < PAGE_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke() } }
    if (kind === 'grid' || kind === 'axes') {
      ctx.strokeStyle = '#e4ebe5'
      for (let x = 0; x <= PAGE_W; x += 25) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); ctx.stroke() }
      for (let y = 0; y <= PAGE_H; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); ctx.stroke() }
    }
    if (kind === 'axes') {
      ctx.strokeStyle = '#6d7f76'; ctx.lineWidth = 2
      const ox = 100, oy = PAGE_H - 200
      ctx.beginPath(); ctx.moveTo(ox, 60); ctx.lineTo(ox, oy); ctx.lineTo(PAGE_W - 60, oy); ctx.stroke()
      arrowHead(ox, 80, ox, 60, '#6d7f76', 2); arrowHead(PAGE_W - 80, oy, PAGE_W - 60, oy, '#6d7f76', 2)
    }
    let top = 30
    if (question && state.background.includes('+question')) top = drawQuestion() + 20
    if (state.figure) {
      const img = state.figure, w = Math.min(PAGE_W - 80, img.naturalWidth * 1.4), h = w * img.naturalHeight / img.naturalWidth
      if (!state.background.includes('+question')) {
        // pages saved before the printed question keep their original figure geometry, so existing ink stays aligned
        ctx.drawImage(img, (PAGE_W - w) / 2, 30, w, Math.min(h, PAGE_H * 0.55))
      } else {
        const fh = Math.min(h, PAGE_H * 0.5), fw = fh < h ? fh * img.naturalWidth / img.naturalHeight : w
        ctx.drawImage(img, (PAGE_W - fw) / 2, top, fw, fh)
      }
    }
    ctx.restore()
  }
  // The question in a shaded box at the top of the page; returns the y where the box ends.
  function drawQuestion() {
    const rtl = question.dir === 'rtl', pad = 24, x0 = 30, width = PAGE_W - 60, size = 24, lh = 36
    ctx.save()
    ctx.font = `600 ${size}px 'Student Arabic', Inter, 'Segoe UI', Arial, sans-serif`
    ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left'; ctx.textBaseline = 'top'
    const wrap = (text, max) => {
      const lines = []
      for (const para of String(text || '').split(/\n+/)) {
        let line = ''
        for (const word of para.split(/\s+/).filter(Boolean)) {
          const next = line ? line + ' ' + word : word
          if (ctx.measureText(next).width > max && line) { lines.push(line); line = word } else line = next
        }
        if (line) lines.push(line)
      }
      return lines
    }
    const lines = wrap(question.text, width - pad * 2).slice(0, 12)
    ctx.font = `500 ${size - 2}px 'Student Arabic', Inter, 'Segoe UI', Arial, sans-serif`
    const opts = (question.options || []).flatMap(o => wrap(o, width - pad * 2 - 20)).slice(0, 10)
    const height = pad * 2 + lines.length * lh + (opts.length ? 10 + opts.length * (lh - 4) : 0)
    ctx.fillStyle = '#f2f7ef'; ctx.strokeStyle = '#b9d3c4'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, 20, width, height, 14) : ctx.rect(x0, 20, width, height); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#0f7b5f'; ctx.fillRect(rtl ? x0 + width - 6 : x0, 20, 6, height)
    const tx = rtl ? x0 + width - pad : x0 + pad
    let y = 20 + pad
    ctx.fillStyle = '#10302a'; ctx.font = `600 ${size}px 'Student Arabic', Inter, 'Segoe UI', Arial, sans-serif`
    for (const l of lines) { ctx.fillText(l, tx, y); y += lh }
    if (opts.length) {
      y += 10; ctx.fillStyle = '#304a42'; ctx.font = `500 ${size - 2}px 'Student Arabic', Inter, 'Segoe UI', Arial, sans-serif`
      for (const l of opts) { ctx.fillText(l, rtl ? tx - 20 : tx + 20, y); y += lh - 4 }
    }
    ctx.restore()
    return 20 + height
  }
  function arrowHead(x1, y1, x2, y2, color, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), l = 14 + w * 2
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - l * Math.cos(a - 0.4), y2 - l * Math.sin(a - 0.4)); ctx.lineTo(x2 - l * Math.cos(a + 0.4), y2 - l * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill()
  }
  function drawStroke(s, upto = s.p.length) {
    const pts = s.p.slice(0, upto)
    if (!pts.length) return
    ctx.save(); ctx.scale(scale, scale)
    ctx.lineCap = s.t === 'hl' ? 'butt' : 'round'; ctx.lineJoin = 'round'
    ctx.strokeStyle = s.c; ctx.globalAlpha = s.t === 'hl' ? 0.32 : 1
    if (s.t === 'line' || s.t === 'arrow') {
      const [a, b] = [pts[0], pts[pts.length - 1]]
      ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke()
      if (s.t === 'arrow' && pts.length > 1) arrowHead(a[0], a[1], b[0], b[1], s.c, s.w)
    } else if (pts.length === 1) {
      ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill()
    } else {
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i]
        const pressure = s.t === 'hl' ? 0.5 : (p0[2] + p1[2]) / 2
        ctx.lineWidth = s.t === 'hl' ? s.w : s.w * (0.45 + pressure * 1.1)
        ctx.beginPath()
        const m0 = i > 1 ? [(pts[i - 2][0] + p0[0]) / 2, (pts[i - 2][1] + p0[1]) / 2] : p0
        const m1 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
        ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(p0[0], p0[1], i === pts.length - 1 ? p1[0] : m1[0], i === pts.length - 1 ? p1[1] : m1[1])
        ctx.stroke()
      }
    }
    ctx.restore()
  }
  function render() {
    drawBackground()
    for (const layer of layers) for (const s of layer.strokes) drawStroke(s)
    if (live) drawStroke(live)
  }
  if (figureUrl) {
    const img = new Image()
    img.onload = () => { state.figure = img; render() }
    img.crossOrigin = 'use-credentials'
    img.src = figureUrl
  }

  // ---------------------------------------------------------------- input
  let live = null, erasing = null, activePointer = null
  const pos = e => { const r = canvas.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * PAGE_W * 10) / 10, Math.round((e.clientY - r.top) / r.height * PAGE_H * 10) / 10] }
  const pressureOf = e => e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5
  function hit(s, [x, y], r) {
    if (s.t === 'line' || s.t === 'arrow') {
      const [a, b] = [s.p[0], s.p[s.p.length - 1]]
      const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy || 1
      const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len))
      return Math.hypot(a[0] + k * dx - x, a[1] + k * dy - y) < r + s.w
    }
    return s.p.some(p => Math.hypot(p[0] - x, p[1] - y) < r + s.w)
  }
  canvas.addEventListener('pointerdown', e => {
    if (!editable || state.replaying || activePointer !== null) return
    if (state.penOnly && e.pointerType === 'touch') return
    if (e.button && e.button !== 0) return
    e.preventDefault(); canvas.setPointerCapture(e.pointerId); activePointer = e.pointerId
    const p = pos(e)
    if (state.tool === 'eraser') { erasing = []; eraseAt(p); return }
    live = { t: state.tool, c: state.color, w: state.tool === 'hl' ? WIDTHS[state.width] * 4 : WIDTHS[state.width], s: Date.now(), p: [[p[0], p[1], pressureOf(e), 0]] }
    render()
  })
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointer) return
    e.preventDefault()
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    for (const ev of events) {
      const p = pos(ev)
      if (erasing) { eraseAt(p); continue }
      if (!live) continue
      if (live.t === 'line' || live.t === 'arrow') { live.p[1] = [p[0], p[1], 0.5, Date.now() - live.s]; continue }
      const last = live.p[live.p.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) continue
      live.p.push([p[0], p[1], Math.round(pressureOf(ev) * 100) / 100, Date.now() - live.s])
    }
    if (live) render()
  })
  function finish(e) {
    if (e.pointerId !== activePointer) return
    activePointer = null
    if (erasing) { if (erasing.length) { undo.push({ type: 'erase', strokes: erasing }); redo.length = 0; changed() } erasing = null; return }
    if (live) { editable.strokes.push(live); undo.push({ type: 'add', stroke: live }); redo.length = 0; live = null; changed() }
  }
  canvas.addEventListener('pointerup', finish)
  canvas.addEventListener('pointercancel', finish)
  function eraseAt(p) {
    const r = 6 + WIDTHS[state.width] * 2
    for (let i = editable.strokes.length - 1; i >= 0; i--) {
      if (hit(editable.strokes[i], p, r)) { erasing.push({ stroke: editable.strokes[i], index: i }); editable.strokes.splice(i, 1) }
    }
    render()
  }
  function doUndo() {
    const a = undo.pop(); if (!a) return
    if (a.type === 'add') editable.strokes.splice(editable.strokes.lastIndexOf(a.stroke), 1)
    if (a.type === 'erase') for (const x of [...a.strokes].reverse()) editable.strokes.splice(x.index, 0, x.stroke)
    if (a.type === 'clear') editable.strokes.push(...a.strokes)
    redo.push(a); changed()
  }
  function doRedo() {
    const a = redo.pop(); if (!a) return
    if (a.type === 'add') editable.strokes.push(a.stroke)
    if (a.type === 'erase') for (const x of a.strokes) editable.strokes.splice(editable.strokes.indexOf(x.stroke), 1)
    if (a.type === 'clear') editable.strokes.length = 0
    undo.push(a); changed()
  }
  function changed() { render(); refreshBar(); onChange('strokes') }
  const keys = e => {
    if (!root.isConnected) return document.removeEventListener('keydown', keys)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo() }
  }
  document.addEventListener('keydown', keys)

  // ---------------------------------------------------------------- replay: the solution as it was written
  async function replay(speed = 2) {
    if (state.replaying) return
    state.replaying = true
    const all = layers.flatMap(l => l.strokes.map(s => ({ s }))).sort((a, b) => (a.s.s || 0) - (b.s.s || 0))
    drawBackground()
    const wait = ms => new Promise(r => setTimeout(r, ms))
    for (const { s } of all) {
      if (!state.replaying) break
      const n = s.p.length
      for (let i = 1; i <= n; i += Math.max(1, Math.round(speed))) { drawStroke(s, i); await wait(Math.min(24, (s.p[Math.min(i, n - 1)]?.[3] - (s.p[i - 2]?.[3] || 0)) / speed || 8)) }
      drawStroke(s)
      await wait(120 / speed)
    }
    state.replaying = false
    render()
  }

  resize()
  // the question text uses the page font, which may still be loading
  if (question && document.fonts?.ready) document.fonts.ready.then(() => render())
  return {
    element: root,
    get background() { return state.background },
    setBackground(b) { state.background = b; render() },
    replay,
    stopReplay() { state.replaying = false },
    render,
    toPNG() { return canvas.toDataURL('image/png') },
    destroy() { observer.disconnect(); document.removeEventListener('keydown', keys); root.remove() },
  }
}
