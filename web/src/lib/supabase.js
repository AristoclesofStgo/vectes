import { createClient } from '@supabase/supabase-js'

// The project URL and publishable key are public by design: every table is protected by
// row-level security, so the key only lets a browser act as the signed-in user.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://kxzzwenckumkcqymflrx.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_QP3q8nJeaEj4OHxp_q5Uiw_u7Sq0uO7'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // PKCE returns ?code= in the query string, which doesn't collide with hash routing
    flowType: 'pkce',
    storageKey: 'vectes-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Where Supabase sends people back after Google or an email link: the site root, no hash
export const SITE_URL = `${window.location.origin}${import.meta.env.BASE_URL}`
