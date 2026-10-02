import { create } from 'zustand'
import { supabase, SITE_URL } from './supabase.js'
import { buildDemoTrades } from './demoTrades.js'

// Session state for the gated tabs, backed by Supabase Auth.
// Real accounts use email + password or Google; "Try demo" is an anonymous user
// whose profile expires after DEMO_DAYS (enforced by row-level security in Postgres).

export const DEMO_DAYS = 7
const AFTER_LOGIN_KEY = 'vectes-after-login'

async function loadSession(authSession) {
  if (!authSession) return null
  const { user } = authSession
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_demo, access_until')
    .eq('id', user.id)
    .maybeSingle()
  return {
    userId: user.id,
    kind: profile?.is_demo || user.is_anonymous ? 'demo' : 'user',
    email: user.email ?? null,
    expiresAt: profile?.access_until ? Date.parse(profile.access_until) : Infinity,
  }
}

async function seedDemo() {
  const demoTrades = await buildDemoTrades()
  // Demo accounts start at 10,000 USD; the balance is what the EA would report today
  const net = demoTrades.reduce((s, t) => s + t.profit + t.swap + t.commission + t.taxes, 0)
  const { data: account, error } = await supabase
    .from('trading_accounts')
    .insert({
      broker: 'Vectes Demo Broker', account_number: '1000001', currency: 'USD', label: 'Demo account',
      server_utc_offset_minutes: 180, balance: Math.round((10000 + net) * 100) / 100,
    })
    .select('id')
    .single()
  if (error) throw error
  const trades = demoTrades.map((t) => ({ ...t, account_id: account.id }))
  const { error: tradesError } = await supabase.from('trades').insert(trades)
  if (tradesError) throw tradesError
  const funded = new Date(Date.parse(trades[0].open_time) - 86400000).toISOString()
  const { error: cashError } = await supabase.from('cash_flows').insert({
    account_id: account.id, ticket: '50000001', kind: 'balance', amount: 10000, time: funded, comment: 'Initial deposit', source: 'demo',
  })
  if (cashError) throw cashError
}

// Remember where to land after a redirect-based sign-in (Google, email link)
export function rememberDestination(path) {
  try { sessionStorage.setItem(AFTER_LOGIN_KEY, path) } catch {}
}
export function takeDestination() {
  try {
    const path = sessionStorage.getItem(AFTER_LOGIN_KEY)
    sessionStorage.removeItem(AFTER_LOGIN_KEY)
    return path
  } catch {
    return null
  }
}

export const useAuth = create((set) => ({
  status: 'loading', // 'loading' until the stored session has been checked
  session: null,
  // True right after an explicit sign-out, so the gate sends the visitor home instead of to /login
  signedOut: false,

  init: () => {
    const apply = async (authSession) => {
      const session = await loadSession(authSession)
      set((s) => ({ session, status: 'ready', signedOut: session ? false : s.signedOut }))
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, authSession) => {
      // Profile lookups are Supabase calls too; run them outside the auth callback
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => apply(authSession), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  },

  startDemo: async () => {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    await seedDemo()
    const session = await loadSession(data.session)
    set({ session, signedOut: false })
    return session
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const session = await loadSession(data.session)
    set({ session, signedOut: false })
    return session
  },

  // Returns null when the account needs email confirmation first
  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: SITE_URL } })
    if (error) throw error
    if (!data.session) return null
    const session = await loadSession(data.session)
    set({ session, signedOut: false })
    return session
  },

  // Permanently deletes the Supabase user and, by cascade, everything they stored
  deleteAccount: async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (error || !data?.ok) throw error ?? new Error('delete-account failed')
    set({ session: null, signedOut: true })
    await supabase.auth.signOut({ scope: 'local' }) // the user no longer exists server-side
  },

  signOut: async () => {
    set({ session: null, signedOut: true })
    await supabase.auth.signOut()
  },
}))

export function hasAccess(session) {
  return Boolean(session) && session.expiresAt > Date.now()
}

export function daysLeft(session) {
  if (!session || session.expiresAt === Infinity) return Infinity
  return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 86400000))
}
