// mt4-ingest · receives closed trades from the Vectes Expert Advisor for MetaTrader 4.
//
// The EA authenticates with a personal token (header X-Vectes-Token) created in the
// Journal tab. Only its SHA-256 hash is stored, so the function looks the hash up with
// the service role, checks the owner's access, then upserts the account and trades.
// Deployed with --no-verify-jwt: the EA has no Supabase session, the token is the auth.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { assetForSymbol } from '../_shared/symbols.js'

const MAX_TRADES = 2000
const MAX_BODY_BYTES = 1_000_000

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, max = 64) => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== ''
  ? String(v).trim().slice(0, max)
  : null

type RawTrade = Record<string, unknown>

// MT4 times are broker-server seconds; offset = server time minus UTC, in minutes
function toTrade(t: RawTrade, offsetMinutes: number) {
  const ticket = str(t.ticket, 32)
  const symbol = str(t.symbol, 32)
  const side = t.type === 'buy' || t.type === 'sell' ? t.type : null
  const nums = ['lots', 'open_time', 'open_price', 'close_time', 'close_price', 'profit'] as const
  if (!ticket || !symbol || !side || !nums.every((k) => isNum(t[k]))) return null
  const lots = t.lots as number
  const openTime = (t.open_time as number) - offsetMinutes * 60
  const closeTime = (t.close_time as number) - offsetMinutes * 60
  if (lots <= 0 || closeTime < openTime || openTime < 946684800) return null // before 2000: not a real trade
  const priceOrNull = (v: unknown) => (isNum(v) && v > 0 ? v : null)
  return {
    ticket,
    symbol,
    asset_id: assetForSymbol(symbol),
    side,
    volume: Math.round(lots * 100) / 100,
    open_time: new Date(openTime * 1000).toISOString(),
    open_price: t.open_price as number,
    close_time: new Date(closeTime * 1000).toISOString(),
    close_price: t.close_price as number,
    stop_loss: priceOrNull(t.sl),
    take_profit: priceOrNull(t.tp),
    commission: isNum(t.commission) ? t.commission : 0,
    taxes: isNum(t.taxes) ? t.taxes : 0,
    swap: isNum(t.swap) ? t.swap : 0,
    profit: t.profit as number,
    source: 'ea',
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Use POST' })

  // ── Authenticate the token ──
  const token = req.headers.get('x-vectes-token')?.trim()
  if (!token || token.length < 20 || token.length > 200) return json(401, { ok: false, error: 'Missing or malformed token' })
  const { data: tokenRow } = await db
    .from('ingest_tokens')
    .select('id, user_id, revoked_at')
    .eq('token_hash', await sha256(token))
    .maybeSingle()
  if (!tokenRow || tokenRow.revoked_at) return json(401, { ok: false, error: 'Invalid or revoked token' })

  const { data: profile } = await db.from('profiles').select('access_until').eq('id', tokenRow.user_id).maybeSingle()
  if (!profile || (profile.access_until && Date.parse(profile.access_until) <= Date.now())) {
    return json(403, { ok: false, error: 'Vectes access has expired for this account' })
  }

  // ── Validate the payload ──
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Payload too large; send smaller batches' })
  let body: { account?: Record<string, unknown>; trades?: RawTrade[] }
  try {
    body = JSON.parse(raw)
  } catch {
    return json(400, { ok: false, error: 'Body is not valid JSON' })
  }
  const account = body.account ?? {}
  const accountNumber = str(account.number)
  const broker = str(account.broker, 120)
  const offset = account.server_offset_minutes
  if (!accountNumber || !broker) return json(400, { ok: false, error: 'account.number and account.broker are required' })
  if (!isNum(offset) || Math.abs(offset) > 14 * 60) return json(400, { ok: false, error: 'account.server_offset_minutes is invalid' })
  const rawTrades = Array.isArray(body.trades) ? body.trades : []
  if (rawTrades.length > MAX_TRADES) return json(413, { ok: false, error: `At most ${MAX_TRADES} trades per request` })

  const trades = rawTrades.map((t) => toTrade(t, offset))
  const rejected = trades.filter((t) => !t).length

  // ── Upsert account, then trades (dedup on account + ticket) ──
  const now = new Date().toISOString()
  const { data: acc, error: accError } = await db
    .from('trading_accounts')
    .upsert({
      user_id: tokenRow.user_id,
      platform: 'MT4',
      broker,
      account_number: accountNumber,
      currency: str(account.currency, 8) ?? 'USD',
      server_utc_offset_minutes: offset,
      balance: isNum(account.balance) ? account.balance : null,
      equity: isNum(account.equity) ? account.equity : null,
      last_sync_at: now,
    }, { onConflict: 'user_id,broker,account_number' })
    .select('id')
    .single()
  if (accError) return json(500, { ok: false, error: 'Could not save the account' })

  const rows = trades
    .filter((t) => t !== null)
    .map((t) => ({ ...t, user_id: tokenRow.user_id, account_id: acc.id }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('trades').upsert(rows.slice(i, i + 500), { onConflict: 'account_id,ticket' })
    if (error) return json(500, { ok: false, error: 'Could not save the trades', saved: i })
  }

  await db.from('ingest_tokens').update({ last_used_at: now }).eq('id', tokenRow.id)

  return json(200, { ok: true, account_id: acc.id, received: rawTrades.length, saved: rows.length, rejected })
})
