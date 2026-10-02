// delete-account · permanently removes the signed-in user from Vectes.
//
// Browsers cannot delete Supabase Auth users, so this function does it with the
// service role after checking the caller's own session. Every table references
// auth.users with ON DELETE CASCADE, so profiles, accounts, trades, cash flows and
// EA tokens go with it. Deployed with JWT verification on (the default).

import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://aristoclesofstgo.github.io', 'http://localhost:4173', 'http://localhost:5173']

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Use POST' }), { status: 405, headers })

  // Who is asking: resolve the user from their own access token
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { data, error } = jwt ? await admin.auth.getUser(jwt) : { data: null, error: true }
  if (error || !data?.user) return new Response(JSON.stringify({ ok: false, error: 'Not signed in' }), { status: 401, headers })

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
  if (deleteError) return new Response(JSON.stringify({ ok: false, error: 'Could not delete the account' }), { status: 500, headers })

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
})
