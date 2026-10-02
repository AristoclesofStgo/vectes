import { create } from 'zustand'

const THEME_KEY = 'vectes-theme'
const PREFS_KEY = 'vectes-prefs'

// Browser storage can be missing or blocked (private mode, previews); never let it break the app
function read(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key, value) {
  try { localStorage.setItem(key, value) } catch {}
}

function savedTheme() {
  const t = read(THEME_KEY)
  return t === 'light' || t === 'dark' ? t : 'dark'
}

function savedPrefs() {
  try { return JSON.parse(read(PREFS_KEY)) ?? {} } catch { return {} }
}

const DEFAULT_INDICATORS = { sma20: true, sma50: false, ema20: false, bb: false, rsi: false }
const prefs = savedPrefs()

// Global UI state shared across tabs
export const useStore = create((set) => ({
  theme: savedTheme(),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme
    write(THEME_KEY, theme)
    set({ theme })
  },

  // Display currency for every price on the site
  currency: typeof prefs.currency === 'string' ? prefs.currency : 'USD',
  setCurrency: (currency) => set({ currency }),

  // Market chart overlays
  indicators: { ...DEFAULT_INDICATORS, ...prefs.indicators },
  toggleIndicator: (id) => set((s) => ({ indicators: { ...s.indicators, [id]: !s.indicators[id] } })),
  showVolume: prefs.showVolume ?? true,
  toggleVolume: () => set((s) => ({ showVolume: !s.showVolume })),
}))

// Remember viewer preferences between visits
useStore.subscribe((s) => {
  write(PREFS_KEY, JSON.stringify({ currency: s.currency, indicators: s.indicators, showVolume: s.showVolume }))
})
