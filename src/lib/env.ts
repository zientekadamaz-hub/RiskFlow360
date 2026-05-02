const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? ''
const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? ''
const invitationFromEmail = process.env.INVITATION_FROM_EMAIL?.trim() ?? ''

function requireEnv(name: string, value: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeBasePath(value: string) {
  if (!value) return ''
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash
}

export const env = {
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', supabaseAnonKey),
  publicBasePath: normalizeBasePath(publicBasePath),
  publicAppUrl,
  resendApiKey,
  invitationFromEmail,
}
