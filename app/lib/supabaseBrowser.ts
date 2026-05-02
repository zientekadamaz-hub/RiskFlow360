// src/app/lib/supabaseBrowser.ts
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { createBrowserSessionCookieAdapter } from './supabaseSessionCookies'

export const supabase = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey, {
  cookies: createBrowserSessionCookieAdapter(),
})
