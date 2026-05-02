import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { validateRequestAccessPayload } from '@/lib/request-access'
import { RequestAccessConflictError, submitAccessRequest } from '@/lib/request-access-service'

const supabaseAdminless = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 415 })
  }

  const body = await request.json().catch(() => null)
  const parsed = validateRequestAccessPayload(body)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  if (parsed.data.companyWebsite) {
    return NextResponse.json({ ok: true })
  }

  try {
    await submitAccessRequest(supabaseAdminless, parsed.data)
  } catch (error) {
    if (error instanceof RequestAccessConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json(
      {
        error: 'Request could not be saved right now. Please try again later.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
