// Portfolio report as a downloadable PDF. Built from the simulation data (not a
// screenshot): selectable text, vector charts and a print-friendly light palette,
// whatever theme the visitor is using. jsPDF loads only when the button is pressed.

import { BENCHMARKS } from './portfolio.js'
import { PERIODS, REBALANCING, STRATEGIES } from './backtest.js'

const INK = '#0f1d30'
const MUTED = '#5b6b82'
const GRID = '#e3e9f1'
const NAVY = '#1b4668'
const GREEN = '#529c69'
const UP = '#1f8a55'
const DOWN = '#d23f4c'
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#c98500']

const A4 = { w: 210, h: 297 }
const M = 16 // page margin, mm

// Helvetica (the PDF base font) has no "₿" or the "−" minus sign
function pdfMoney(currency) {
  const prefix = currency.id === 'BTC' ? 'BTC ' : currency.symbol
  return (v, signed = false, compact = false) => {
    if (v == null || !Number.isFinite(v)) return 'n/a'
    const abs = Math.abs(v) < 1e-9 ? 0 : Math.abs(v)
    const digits = abs >= 1000 || abs === 0 ? 0 : abs >= 1 ? 2 : 4
    const body = compact && abs >= 10000
      ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(abs)
      : abs.toLocaleString('en-US', { minimumFractionDigits: compact ? 0 : digits, maximumFractionDigits: compact ? 0 : digits })
    const sign = v < 0 ? '-' : signed && v > 0 ? '+' : ''
    return `${sign}${prefix}${body}${currency.suffix ?? ''}`
  }
}
const pct = (v, digits = 2, signed = true) => (v == null || !Number.isFinite(v)
  ? 'n/a'
  : `${signed && v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`)
const day = (seconds) => new Date(seconds * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

// The Vectes mark, from the same polygons as the site's SVG logo (viewBox 465 x 355)
const MARK = [
  { color: NAVY, points: [[0, 355], [58.5, 355], [177.5, 153.5], [224.5, 228.5], [260, 190], [207.5, 100], [151, 100]] },
  { color: NAVY, points: [[148.5, 240], [178.5, 191.5], [247.5, 303.5], [381, 77.5], [337, 55], [458.5, 0], [465, 133.5], [426, 105], [276, 355], [217.5, 355]] },
  { color: GREEN, points: [[224.5, 228.5], [350, 91.5], [246, 266.5]] },
]
function drawMark(doc, x, y, height) {
  const k = height / 355
  for (const { color, points } of MARK) {
    const pts = points.map(([px, py]) => [x + px * k, y + py * k])
    const deltas = pts.slice(1).map(([px, py], i) => [px - pts[i][0], py - pts[i][1]])
    doc.setFillColor(color)
    doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true)
  }
  return 465 * k
}

// Round axis steps (1, 2, 2.5, 5 x 10^n) covering [lo, hi]
function niceTicks(lo, hi, count = 4) {
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw)
  const first = Math.floor(lo / step) * step
  const ticks = []
  for (let v = first; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step)
  if (ticks.at(-1) < hi) ticks.push(ticks.at(-1) + step)
  return ticks
}

// Simple vector line chart: hairline grid, labelled y axis, month ticks, legend above
function lineChart(doc, { x, y, w, h, title, times, series, format, area = false, zeroLine = false }) {
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(INK).text(title, x, y)
  const legendY = y + 5
  let lx = x
  doc.setFont('helvetica', 'normal').setFontSize(7.5)
  for (const s of series) {
    doc.setDrawColor(s.color).setLineWidth(0.8).line(lx, legendY - 1, lx + 5, legendY - 1)
    doc.setTextColor(MUTED).text(s.label, lx + 6.5, legendY)
    lx += 9 + doc.getTextWidth(s.label) + 4
  }

  const top = y + 9
  const plotX = x + 18
  const plotW = w - 18
  const plotH = h - 16
  const all = series.flatMap((s) => s.values).filter(Number.isFinite)
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (zeroLine) hi = Math.max(hi, 0)
  if (hi - lo < Math.abs(hi) * 1e-6 + 1e-9) {
    // Flat series (e.g. all cash): give the axis a small, sensible span
    if (zeroLine) lo = Math.min(lo, -0.05)
    else { const d = Math.max(Math.abs(hi) * 0.05, 1); lo -= d; hi += d }
  }
  const ticks = niceTicks(lo, hi)
  lo = ticks[0]
  hi = ticks.at(-1)
  const yOf = (v) => top + plotH - ((v - lo) / (hi - lo)) * plotH
  const xOf = (i) => plotX + (i / Math.max(1, times.length - 1)) * plotW

  // Grid and y labels
  doc.setFontSize(7).setTextColor(MUTED).setLineWidth(0.15).setDrawColor(GRID)
  for (const v of ticks) {
    const gy = yOf(v)
    doc.line(plotX, gy, plotX + plotW, gy)
    doc.text(format(v), plotX - 2, gy + 1, { align: 'right' })
  }
  // Month ticks along the bottom
  let lastMonth = null
  times.forEach((t, i) => {
    const d = new Date(t * 1000)
    const m = d.getUTCMonth()
    if (m !== lastMonth && d.getUTCDate() <= 7 && i > 0) {
      doc.text(d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), xOf(i), top + plotH + 4.5, { align: 'center' })
    }
    lastMonth = m
  })

  for (const s of series) {
    const pts = s.values.map((v, i) => [xOf(i), yOf(v)])
    if (area) {
      const base = yOf(0)
      const poly = [[pts[0][0], base], ...pts, [pts.at(-1)[0], base]]
      doc.setFillColor(s.fill ?? s.color)
      doc.lines(poly.slice(1).map(([px, py], i) => [px - poly[i][0], py - poly[i][1]]), poly[0][0], poly[0][1], [1, 1], 'F', true)
    }
    doc.setDrawColor(s.color).setLineWidth(s.width ?? 0.6)
    if (s.dash) doc.setLineDashPattern(s.dash, 0)
    doc.lines(pts.slice(1).map(([px, py], i) => [px - pts[i][0], py - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'S', false)
    doc.setLineDashPattern([], 0)
  }
  return y + h
}

function footer(doc, url) {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(GRID).setLineWidth(0.2).line(M, A4.h - 15, A4.w - M, A4.h - 15)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(MUTED)
    doc.text('For educational purposes only, not investment advice.', M, A4.h - 10)
    doc.text(`Page ${p} of ${pages}`, A4.w - M, A4.h - 10, { align: 'right' })
    // The full URL reproduces this exact portfolio on the site
    doc.setTextColor('#2a78d6').textWithLink('Open this portfolio in Vectes', M, A4.h - 6, { url })
  }
}

export async function downloadPortfolioReport({ config, currency, portfolio, benchmarks, targets, assetsById, url }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const money = pdfMoney(currency)
  const { result, stats } = portfolio
  const isDca = config.strategy !== 'lump'
  const label = (list, id) => list.find((o) => o.id === id)?.label ?? id
  const from = result.times[0]
  const to = result.times.at(-1)

  // ── Header ──
  const markW = drawMark(doc, M, M - 1, 9)
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(NAVY).text('VECTES', M + markW + 3, M + 6.5)
  doc.setFontSize(13).setTextColor(INK).text('Portfolio report', A4.w - M, M + 3, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(MUTED)
    .text(`Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, A4.w - M, M + 8, { align: 'right' })
  doc.setDrawColor(GREEN).setLineWidth(0.6).line(M, M + 12, A4.w - M, M + 12)

  // ── Settings ──
  let y = M + 20
  const settings = [
    ['Capital', money(config.capital)],
    ['Currency', `${currency.id} · ${currency.label}`],
    ['Period', `${label(PERIODS, config.period)} · ${day(from)} to ${day(to)}`],
    ['Strategy', label(STRATEGIES, config.strategy) + (isDca ? ` · ${result.contributions} contributions` : '')],
    ['Rebalancing', `${label(REBALANCING, config.rebalance)} · ${result.rebalances} rebalances`],
  ]
  doc.setFontSize(8.5)
  settings.forEach(([k, v], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const sx = M + col * ((A4.w - 2 * M) / 3)
    const sy = y + row * 10
    doc.setFont('helvetica', 'normal').setTextColor(MUTED).text(k.toUpperCase(), sx, sy)
    doc.setFont('helvetica', 'bold').setTextColor(INK).text(v, sx, sy + 4.5)
  })
  y += 24

  // ── KPI tiles ──
  const kpis = [
    ['Final value', money(result.final), `${pct(stats.moneyReturn)} (${money(result.profit, true)})`, stats.moneyReturn],
    isDca
      ? ['Total invested', money(result.totalInvested), `${result.contributions} contributions`, null]
      : ['Annualized return', pct(stats.annualized), 'time-weighted', stats.annualized],
    ['Time-weighted return', pct(stats.totalReturn), `${pct(stats.annualized)} annualized`, stats.totalReturn],
    ['Volatility', pct(stats.volatility, 1, false), 'annualized', null],
    ['Sharpe ratio', stats.sharpe == null ? 'n/a' : stats.sharpe.toFixed(2), 'risk-adjusted', null],
    ['Max drawdown', pct(stats.maxDrawdown), 'largest peak-to-trough fall', null],
  ]
  const tileW = (A4.w - 2 * M - 2 * 4) / 3
  kpis.forEach(([k, v, sub, tone], i) => {
    const tx = M + (i % 3) * (tileW + 4)
    const ty = y + Math.floor(i / 3) * 21
    doc.setDrawColor(GRID).setFillColor('#f6f8fb').setLineWidth(0.2).roundedRect(tx, ty, tileW, 17, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(MUTED).text(k, tx + 4, ty + 5)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(tone > 0 ? UP : tone < 0 ? DOWN : INK).text(v, tx + 4, ty + 11)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(MUTED).text(sub, tx + 4, ty + 15)
  })
  y += 46

  // ── Charts ──
  const valueSeries = [{ label: 'Your portfolio', color: SERIES[0], values: result.value, width: 0.8 }]
  config.benchmarks.forEach((id, i) => {
    const b = BENCHMARKS.find((x) => x.id === id)
    if (b && benchmarks[id]) valueSeries.push({ label: b.label, color: SERIES[i + 1], values: benchmarks[id].result.value })
  })
  if (isDca) valueSeries.push({ label: 'Invested', color: MUTED, values: result.invested, dash: [1.2, 1] })
  y = lineChart(doc, { x: M, y, w: A4.w - 2 * M, h: 72, title: 'Portfolio value', times: result.times, series: valueSeries, format: (v) => money(v, false, true) })
  y += 6
  y = lineChart(doc, {
    x: M, y, w: A4.w - 2 * M, h: 46, title: 'Drawdown', times: result.times, area: true, zeroLine: true,
    series: [{ label: `Max ${pct(stats.maxDrawdown, 1)}`, color: DOWN, fill: '#f7d4d7', values: stats.drawdown }],
    format: (v) => `${(v * 100).toFixed(0)}%`,
  })

  // ── Tables ──
  const table = (title, head, body, opts = {}) => {
    let startY = (doc.lastAutoTable?.finalY ?? y) + 10
    // Keep a title with its table: estimate the height before drawing the title
    if (startY + 12 + (body.length + 1) * 7.6 > A4.h - 22) { doc.addPage(); startY = M + 4 }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(INK).text(title, M, startY)
    autoTable(doc, {
      startY: startY + 3,
      head: [head],
      body,
      margin: { left: M, right: M, bottom: 20 },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
      headStyles: { fontStyle: 'bold', textColor: MUTED, fontSize: 7, lineWidth: { bottom: 0.3 }, lineColor: GRID },
      bodyStyles: { lineWidth: { bottom: 0.15 }, lineColor: GRID },
      pageBreak: 'avoid', // move a table whole to the next page rather than orphan a row
      didParseCell: (d) => {
        // Numbers right-aligned, headers included; text columns left
        d.cell.styles.halign = d.column.index === 0 || (opts.leftCols ?? []).includes(d.column.index) ? 'left' : 'right'
        opts.didParseCell?.(d)
      },
    })
  }

  // Page 1 is the summary (settings, KPIs, charts); the tables start on page 2
  doc.addPage()
  y = M - 6

  const allocation = Object.entries(targets).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])
  const cash = Math.max(0, 1 - allocation.reduce((s, [, w]) => s + w, 0))
  table('Allocation', ['Asset', 'Name', 'Target weight'], [
    ...allocation.map(([id, w]) => [id, assetsById[id]?.name ?? id, pct(w, 1, false)]),
    ...(cash > 0.0001 ? [['Cash', 'Unallocated capital', pct(cash, 1, false)]] : []),
  ], { leftCols: [1] })

  const rows = [
    { id: 'portfolio', label: 'Your portfolio', ...portfolio },
    ...BENCHMARKS.map((b) => ({ id: b.id, label: b.label, ...benchmarks[b.id] })),
  ]
  table('Versus benchmarks', ['Strategy', 'Final value', 'Gain', 'TWR', 'Volatility', 'Sharpe', 'Max DD'],
    rows.map((r) => [r.label, money(r.result.final), pct(r.stats.moneyReturn), pct(r.stats.totalReturn, 1),
      pct(r.stats.volatility, 1, false), r.stats.sharpe == null ? 'n/a' : r.stats.sharpe.toFixed(2), pct(r.stats.maxDrawdown, 1)]),
    { didParseCell: (d) => { if (d.section === 'body' && d.row.index === 0) d.cell.styles.fontStyle = 'bold' } })

  const holdings = Object.keys(result.pnl)
    .map((id) => ({ id, pnl: result.pnl[id], target: targets[id] ?? 0, final: result.finalWeights[id] }))
    .sort((a, b) => b.pnl - a.pnl)
  table('Holdings', ['Asset', 'Name', 'Target', 'Final', 'P&L', 'Contribution'],
    holdings.length
      ? holdings.map((h) => [h.id, assetsById[h.id]?.name ?? h.id, pct(h.target, 1, false), pct(h.final, 1, false),
        money(h.pnl, true), pct(h.pnl / result.totalInvested)])
      : [['Cash', 'No assets allocated', '100.0%', '100.0%', money(0), pct(0)]],
    { leftCols: [1] })

  footer(doc, url)
  doc.save(`vectes-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`)
}
