import { supabase } from './supabase.js'

// Data access for the Journal tab. Row-level security scopes every query to the
// signed-in user, so no user filter is needed here.

export const INGEST_HOST = 'https://kxzzwenckumkcqymflrx.supabase.co'
export const EA_DOWNLOAD = `${import.meta.env.BASE_URL}downloads/VectesSync.mq4`

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

export async function listAccounts() {
  return unwrap(await supabase
    .from('trading_accounts')
    .select('id, broker, account_number, currency, label, balance, equity, last_sync_at, created_at, trades(count)')
    .order('created_at'))
    .map(({ trades, ...a }) => ({ ...a, tradeCount: trades?.[0]?.count ?? 0 }))
}

export async function listTokens() {
  return unwrap(await supabase
    .from('ingest_tokens')
    .select('id, label, token_prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false }))
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// The raw token only ever exists in this browser tab; Postgres stores its hash
export async function createToken(label) {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = `vx_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
  unwrap(await supabase.from('ingest_tokens').insert({
    label: label.trim() || 'MT4',
    token_hash: await sha256Hex(token),
    token_prefix: token.slice(0, 8),
  }))
  return token
}

export async function revokeToken(id) {
  unwrap(await supabase.from('ingest_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id))
}

export async function deleteToken(id) {
  unwrap(await supabase.from('ingest_tokens').delete().eq('id', id))
}
