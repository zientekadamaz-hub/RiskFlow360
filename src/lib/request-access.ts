export type RequestAccessPayload = {
  companyName: string
  requesterEmail: string
  firstName: string | null
  lastName: string | null
  requestedInvites: number | null
  companyWebsite: string
}

type ValidationResult =
  | { ok: true; data: RequestAccessPayload }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COMPANY_NAME_MAX = 120
const PERSON_NAME_MAX = 80
const COMPANY_WEBSITE_MAX = 200
const REQUESTED_INVITES_MAX = 250

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function validateRequestAccessPayload(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'Nieprawidlowe dane formularza.' }
  }

  const payload = value as Record<string, unknown>
  const companyName = typeof payload.companyName === 'string' ? payload.companyName.trim() : ''
  const requesterEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const requestedInvitesValue = payload.requestedInvites
  const companyWebsite = typeof payload.companyWebsite === 'string' ? payload.companyWebsite.trim() : ''

  if (companyName.length < 2) {
    return { ok: false, error: 'Podaj nazwe firmy.' }
  }

  if (companyName.length > COMPANY_NAME_MAX) {
    return { ok: false, error: 'Nazwa firmy jest zbyt dluga.' }
  }

  if (!EMAIL_RE.test(requesterEmail)) {
    return { ok: false, error: 'Podaj poprawny adres e-mail.' }
  }

  const firstName = normalizeOptionalText(payload.firstName)
  if (firstName && firstName.length > PERSON_NAME_MAX) {
    return { ok: false, error: 'Imie jest zbyt dlugie.' }
  }

  const lastName = normalizeOptionalText(payload.lastName)
  if (lastName && lastName.length > PERSON_NAME_MAX) {
    return { ok: false, error: 'Nazwisko jest zbyt dlugie.' }
  }

  if (companyWebsite.length > COMPANY_WEBSITE_MAX) {
    return { ok: false, error: 'Pole strony internetowej jest zbyt dlugie.' }
  }

  let requestedInvites: number | null = null
  if (requestedInvitesValue !== '' && requestedInvitesValue != null) {
    const numericValue = Number(requestedInvitesValue)
    if (!Number.isFinite(numericValue) || numericValue < 1) {
      return { ok: false, error: 'Liczba zaproszen musi byc dodatnia.' }
    }
    if (numericValue > REQUESTED_INVITES_MAX) {
      return { ok: false, error: 'Liczba zaproszen jest zbyt duza.' }
    }
    requestedInvites = Math.floor(numericValue)
  }

  return {
    ok: true,
    data: {
      companyName,
      requesterEmail,
      firstName,
      lastName,
      requestedInvites,
      companyWebsite,
    },
  }
}
