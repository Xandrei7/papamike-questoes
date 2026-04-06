import { createClient } from '@supabase/supabase-js'

// Fallback to empty string so the build never throws at compile time.
// If env vars are missing at runtime the app will show network errors,
// not a white crash screen. Set these in Vercel → Project Settings → Environment Variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
