import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { toSessionCookieOptions } from '@app/lib/supabaseSessionCookies'

function isPublicPath(pathname: string) {
  if (pathname === '/') return true

  const publicPrefixes = ['/login', '/request-access', '/api/auth']
  return publicPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next()

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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname
  const isPublic = isPublicPath(pathname)

  if (!session && !isPublic) {
    const homeUrl = new URL('/', req.url)
    const redirect = NextResponse.redirect(homeUrl)
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
