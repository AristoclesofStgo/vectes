import { create } from 'zustand'

// Session state for the gated tabs.
// Phase 1 placeholder: the demo session lives in localStorage only. Phase 2 swaps
// this store's internals for Supabase Auth (email, Google and anonymous demo users)
// while keeping the same shape, so components don't change.

const SESSION_KEY = 'vectes-session'
export const DEMO_DAYS = 7

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (!s || typeof s.expiresAt !== 'number') return null
    return s.expiresAt > Date.now() ? s : null
  } catch {
    return null
  }
}

function save(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

export const useAuth = create((set) => ({
  session: load(),
  // True right after an explicit sign-out, so the gate sends the visitor home instead of to /login
  signedOut: false,

  startDemo: () => {
    const session = { kind: 'demo', email: null, expiresAt: Date.now() + DEMO_DAYS * 86400000 }
    save(session)
    set({ session, signedOut: false })
    return session
  },

  signOut: () => {
    save(null)
    set({ session: null, signedOut: true })
  },
}))

export function daysLeft(session) {
  if (!session) return 0
  return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 86400000))
}
