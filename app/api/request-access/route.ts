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

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX_PER_EMAIL_AND_IP = 5
const RATE_LIMIT_MAX_PER_IP = 20

type RateLimitBucket = {
  count: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function checkRateLimit(key: string, max: number, now = Date.now()) {
  if (rateLimitBuckets.size > 1000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey)
    }
  }

  const current = rateLimitBuckets.get(key)
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (current.count >= max) return false

  current.count += 1
  return true
}

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

  const ip = clientIp(request)
  const emailKey = parsed.data.requesterEmail.toLowerCase()
  const allowedByIp = checkRateLimit(`ip:${ip}`, RATE_LIMIT_MAX_PER_IP)
  const allowedByEmailAndIp = checkRateLimit(`email-ip:${emailKey}:${ip}`, RATE_LIMIT_MAX_PER_EMAIL_AND_IP)

  if (!allowedByIp || !allowedByEmailAndIp) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
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
