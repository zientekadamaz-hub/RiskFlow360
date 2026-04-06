// src/app/lib/supabaseBrowser.ts
import { createBrowserClient } from '@supabase/ssr'
import { createBrowserSessionCookieAdapter } from './supabaseSessionCookies'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: createBrowserSessionCookieAdapter(),
  }
)
