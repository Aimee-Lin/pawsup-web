import { createClient } from '@supabase/supabase-js'

function legacyClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
  return url && key ? createClient(url, key) : null
}

export const supabase = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim() ? null : legacyClient()
