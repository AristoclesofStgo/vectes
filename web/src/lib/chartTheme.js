// Chart tokens resolved from the active theme's CSS custom properties

export function chartTokens() {
  const css = getComputedStyle(document.documentElement)
  const v = (name) => css.getPropertyValue(name).trim()
  return {
    surface: v('--surface'),
    surface2: v('--surface-2'),
    text: v('--text'),
    muted: v('--text-muted'),
    border: v('--border'),
    grid: v('--chart-grid'),
    crosshair: v('--chart-crosshair'),
    up: v('--up'),
    down: v('--down'),
    font: v('--font-ui'),
    seqLow: v('--seq-low'),
    seqHigh: v('--seq-high'),
    diverging: [v('--div-neg'), v('--div-neg-soft'), v('--div-mid'), v('--div-pos-soft'), v('--div-pos')],
    series: (n) => v(`--series-${n}`),
  }
}

// Ink that stays readable on top of a filled cell
export function inkOn(hex, t) {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.35 ? '#0f1d30' : '#ffffff'
}

export const escapeHtml =(s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Shared axis + tooltip styling: hairline solid grid, recessive axes
export function baseOption(t) {
  const axis = {
    axisLine: { lineStyle: { color: t.border } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontFamily: t.font, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, type: 'solid', width: 1 } },
  }
  return {
    animationDuration: 300,
    textStyle: { fontFamily: t.font, color: t.text },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.border,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.text, fontFamily: t.font, fontSize: 12 },
      extraCssText: 'box-shadow: 0 6px 18px rgba(0,0,0,.18); border-radius: 8px;',
    },
    axis,
  }
}

// Tooltip row: short line key, value first (strong), label second
export function tooltipRow(color, value, label) {
  return `<div style="display:flex;align-items:center;gap:8px;margin-top:3px">`
    + `<span style="display:inline-block;width:12px;height:2px;border-radius:1px;background:${color}"></span>`
    + `<strong style="font-variant-numeric:tabular-nums">${escapeHtml(value)}</strong>`
    + `<span style="opacity:.7">${escapeHtml(label)}</span></div>`
}
