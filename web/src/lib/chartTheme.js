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
    series: (n) => v(`--series-${n}`),
  }
}

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

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
