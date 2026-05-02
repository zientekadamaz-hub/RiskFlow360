const { getPlaywright } = require('../_shared/playwright')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const {
  activateInvitationInFreshContext,
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

  const organizationName = buildUniqueOrganizationName('org', run)
  const championEmail = buildUniqueEmail('champion', run)
  const engineerEmail = buildUniqueEmail('engineer', run)
  const championPassword = buildPassword('champion')
  const engineerPassword = buildPassword('engineer')

  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const adminContext = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const adminPage = await adminContext.newPage()
  let championContext = null
  let engineerContext = null

  try {
    const championInviteUrl = await createOrganizationWithChampion(adminPage, {
      baseUrl,
      adminEmail,
      adminPassword,
      organizationName,
      championEmail,
      championFirstName: 'Test',
      championLastName: 'Champion',
    })

    const championActivation = await activateInvitationInFreshContext(browser, {
      inviteUrl: championInviteUrl,
      password: championPassword,
      expectedEmail: championEmail,
    })

    championContext = championActivation.context
    const championPage = championActivation.page

    const engineerInviteUrl = await createUserInvitation(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      inviteeEmail: engineerEmail,
      inviteeFirstName: 'Test',
      inviteeLastName: 'Engineer',
      role: 'engineer',
    })

    const engineerActivation = await activateInvitationInFreshContext(browser, {
      inviteUrl: engineerInviteUrl,
      password: engineerPassword,
      expectedEmail: engineerEmail,
    })

    engineerContext = engineerActivation.context
    const engineerPage = engineerActivation.page
    await assertSettingsAccessDenied(engineerPage, baseUrl)

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: run,
          baseUrl,
          organizationName,
          championEmail,
          engineerEmail,
          championInviteUrl,
          engineerInviteUrl,
          championFinalUrl: championPage.url(),
          engineerFinalUrl: engineerPage.url(),
        },
        null,
        2
      )
    )
  } finally {
    await engineerContext?.close().catch(() => {})
    await championContext?.close().catch(() => {})
    await adminContext.close().catch(() => {})
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2))
  process.exit(1)
})
