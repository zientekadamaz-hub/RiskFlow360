import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { toSessionCookieOptions } from '@app/lib/supabaseSessionCookies'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...toSessionCookieOptions(options) })
          })
        },
      },
    }
  )

  await supabase.auth.signOut()
  return res
}
