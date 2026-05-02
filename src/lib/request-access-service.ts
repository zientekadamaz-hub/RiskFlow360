import type { SupabaseClient } from '@supabase/supabase-js'
import type { RequestAccessPayload } from '@/lib/request-access'

type SubmitAccessRequestParams = {
  companyName: string
  requesterEmail: string
  firstName: string | null
  lastName: string | null
  requestedInvites: number | null
}

export class RequestAccessConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestAccessConflictError'
  }
}

export async function submitAccessRequest(
  supabase: SupabaseClient,
  payload: RequestAccessPayload
) {
  const params: SubmitAccessRequestParams = {
    companyName: payload.companyName,
    requesterEmail: payload.requesterEmail,
    firstName: payload.firstName,
    lastName: payload.lastName,
    requestedInvites: payload.requestedInvites,
  }

  const { error } = await supabase.rpc('submit_access_request', {
    p_company_name: params.companyName,
    p_requester_email: params.requesterEmail,
    p_first_name: params.firstName,
    p_last_name: params.lastName,
    p_requested_invites: params.requestedInvites,
  })

  if (!error) {
    return
  }

  const message = error.message || 'Request could not be saved right now.'
  const normalizedMessage = message.toLowerCase()

  if (
    normalizedMessage.includes('already pending') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('recently submitted')
  ) {
    throw new RequestAccessConflictError(message)
  }

  throw error
}
