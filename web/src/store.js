import { create } from 'zustand'

const THEME_KEY = 'vectes-theme'

function savedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {}
  return 'dark'
}

// Global UI state shared across tabs
export const useStore = create((set) => ({
  theme: savedTheme(),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(THEME_KEY, theme) } catch {}
    set({ theme })
  },

  // Display currency for every price on the site (wired up in the Market tab)
  currency: 'USD',
  setCurrency: (currency) => set({ currency }),
}))
