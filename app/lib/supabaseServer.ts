// src/app/lib/supabaseServer.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { toSessionCookieOptions } from './supabaseSessionCookies'

export async function supabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, toSessionCookieOptions(options))
          })
        } catch {
          // ok w Server Components (set bywa blokowany)
        }
      },
    }
  })
}
