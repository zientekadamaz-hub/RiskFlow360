import { env } from './env'

type SendInvitationEmailParams = {
  email: string
  firstName: string
  lastName: string
  organizationName: string
  role: string
  inviteUrl: string
}

type ResendSendResponse = {
  id?: string
  message?: string
  name?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatRoleLabel(role: string) {
  const normalized = role.trim().toLowerCase()
  if (!normalized) return 'member'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function buildInvitationEmail(params: SendInvitationEmailParams) {
  const fullName = `${params.firstName} ${params.lastName}`.trim() || 'there'
  const roleLabel = formatRoleLabel(params.role)
  const safeName = escapeHtml(fullName)
  const safeOrg = escapeHtml(params.organizationName)
  const safeRole = escapeHtml(roleLabel)
  const safeUrl = escapeHtml(params.inviteUrl)

  const subject = `Invitation to join ${params.organizationName} in RiskFlow 360`
  const text = [
    `Hello ${fullName},`,
    '',
    `You have been invited to join ${params.organizationName} in RiskFlow 360 as ${roleLabel}.`,
    '',
    `Accept your invitation: ${params.inviteUrl}`,
    '',
    'If you were not expecting this invitation, you can ignore this email.',
    '',
    'RiskFlow 360',
  ].join('\n')

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#171f33;padding:32px;font-family:Arial,sans-serif;color:#f8fafc;">
    <div style="max-width:620px;margin:0 auto;background:#28272f;border:1px solid rgba(255,255,255,0.16);border-radius:12px;padding:28px;">
      <div style="font-size:24px;font-weight:800;color:#d9a86c;margin-bottom:14px;">RiskFlow 360</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:12px;">You have been invited</div>
      <p style="font-size:14px;line-height:1.6;color:rgba(248,250,252,0.82);margin:0 0 16px;">
        Hello ${safeName}, you have been invited to join <strong>${safeOrg}</strong> as <strong>${safeRole}</strong>.
      </p>
      <a href="${safeUrl}" style="display:inline-block;background:rgba(217,168,108,0.18);border:1px solid rgba(217,168,108,0.45);color:#f8fafc;text-decoration:none;border-radius:8px;padding:11px 16px;font-size:14px;font-weight:700;">
        Accept invitation
      </a>
      <p style="font-size:12px;line-height:1.6;color:rgba(248,250,252,0.62);margin:18px 0 0;">
        If the button does not work, copy and paste this link into your browser:<br />
        <span style="color:#d9a86c;word-break:break-all;">${safeUrl}</span>
      </p>
      <p style="font-size:12px;line-height:1.6;color:rgba(248,250,252,0.52);margin:18px 0 0;">
        If you were not expecting this invitation, you can ignore this email.
      </p>
    </div>
  </body>
</html>`

  return { html, subject, text }
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  if (!env.resendApiKey) {
    throw new Error('Missing RESEND_API_KEY.')
  }
  if (!env.invitationFromEmail) {
    throw new Error('Missing INVITATION_FROM_EMAIL.')
  }

  const email = buildInvitationEmail(params)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.invitationFromEmail,
      to: params.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as ResendSendResponse
  if (!response.ok) {
    throw new Error(payload.message || payload.name || 'Invitation email could not be sent.')
  }

  return payload
}
