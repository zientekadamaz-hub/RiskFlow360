const { getPlaywright } = require('../_shared/playwright')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { ensureLoggedIn } = require('../_shared/browserAuth')
const {
  activateInvitationInFreshContext,
  assertInvitationRolePresent,
  assertSettingsAccessDenied,
  createOrganizationWithChampion,
  createUserInvitation,
} = require('../_shared/invitationFlow')
const { buildPassword, buildUniqueEmail, buildUniqueOrganizationName } = require('../_shared/testAccounts')

function runId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

async function main() {
  loadLocalEnv()

  const baseUrl = getBaseUrl()
  const adminEmail = getRequiredEnv('REGRESSION_ADMIN_EMAIL')
  const adminPassword = getRequiredEnv('REGRESSION_ADMIN_PASSWORD')
  const run = runId()

  const organizationName = buildUniqueOrganizationName('viewer-org', run)
  const championEmail = buildUniqueEmail('viewer-champion', run)
  const viewerEmail = buildUniqueEmail('viewer-user', run)
  const championPassword = buildPassword('champion')
  const viewerPassword = buildPassword('viewer')

  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const adminContext = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const adminPage = await adminContext.newPage()
  let championContext = null
  let viewerContext = null

  try {
    const championInviteUrl = await createOrganizationWithChampion(adminPage, {
      baseUrl,
      adminEmail,
      adminPassword,
      organizationName,
      championEmail,
      championFirstName: 'Viewer',
      championLastName: 'Champion',
    })

    const championActivation = await activateInvitationInFreshContext(browser, {
      inviteUrl: championInviteUrl,
      password: championPassword,
      expectedEmail: championEmail,
    })

    championContext = championActivation.context
    const championPage = championActivation.page
    await ensureLoggedIn(championPage, {
      baseUrl,
      targetPath: '/settings/invitations',
      email: championEmail,
      password: championPassword,
    })
    await assertInvitationRolePresent(championPage, 'CUSTOMER')

    const viewerInviteUrl = await createUserInvitation(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      inviteeEmail: viewerEmail,
      inviteeFirstName: 'Viewer',
      inviteeLastName: 'User',
      role: 'viewer',
    })

    const viewerActivation = await activateInvitationInFreshContext(browser, {
      inviteUrl: viewerInviteUrl,
      password: viewerPassword,
      expectedEmail: viewerEmail,
    })

    viewerContext = viewerActivation.context
    const viewerPage = viewerActivation.page
    await assertSettingsAccessDenied(viewerPage, baseUrl)

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: run,
          baseUrl,
          organizationName,
          championEmail,
          viewerEmail,
          championInviteUrl,
          viewerInviteUrl,
          championFinalUrl: championPage.url(),
          viewerFinalUrl: viewerPage.url(),
        },
        null,
        2
      )
    )
  } finally {
    await viewerContext?.close().catch(() => {})
    await championContext?.close().catch(() => {})
    await adminContext.close().catch(() => {})
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2))
  process.exit(1)
})
