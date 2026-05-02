import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { buildLoginRedirect, isPublicPath } from '@/lib/routing'
import { toSessionCookieOptions } from '@app/lib/supabaseSessionCookies'

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
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
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  if (!session && !isPublic) {
    const redirectUrl = new URL(buildLoginRedirect(pathname, req.nextUrl.search), req.url)
    const redirect = NextResponse.redirect(redirectUrl)
    res.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\..*).*)',
  ],
}
