const { getPlaywright } = require('../_shared/playwright')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { ensureLoggedIn } = require('../_shared/browserAuth')
const {
  activateInvitationInFreshContext,
  assertInvitationRolePresent,
  assertSettingsAccessDenied,
  createOrganizationWithChampion,
  createProject,
  createSiteWithDepartments,
  createUserInvitation,
  grantCustomerAccess,
  waitForAppReady,
} = require('../_shared/invitationFlow')
const { buildPassword, buildUniqueEmail, buildUniqueOrganizationName } = require('../_shared/testAccounts')

function runId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

async function assertGrantedRoute(page, baseUrl, path, expectedPattern) {
  await page.goto(new URL(path, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForAppReady(page)
  if (!expectedPattern.test(page.url())) {
    throw new Error(`Expected granted route ${path} to stay accessible, but landed on ${page.url()}`)
  }
}

async function assertDeniedRoute(page, baseUrl, path) {
  await page.goto(new URL(path, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForAppReady(page)
  await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 30000 }).catch(() => {})
  if (!/\/projects(?:\?|$)/.test(page.url())) {
    throw new Error(`Expected denied route ${path} to redirect to /projects, but stayed on ${page.url()}`)
  }
}

async function main() {
  loadLocalEnv()

  const baseUrl = getBaseUrl()
  const adminEmail = getRequiredEnv('REGRESSION_ADMIN_EMAIL')
  const adminPassword = getRequiredEnv('REGRESSION_ADMIN_PASSWORD')
  const run = runId()

  const organizationName = buildUniqueOrganizationName('customer-multi-org', run)
  const championEmail = buildUniqueEmail('customer-multi-champion', run)
  const customerEmail = buildUniqueEmail('customer-multi-user', run)
  const championPassword = buildPassword('champion')
  const customerPassword = buildPassword('customer')
  const siteName = `Site ${run.slice(-6)}`
  const departmentName = `Dept ${run.slice(-4)}`
  const processName = `Customer multi ${run.slice(-6)}`
  const productName = `Product ${run.slice(-5)}`

  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const adminContext = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const adminPage = await adminContext.newPage()
  let championContext = null
  let customerContext = null

  try {
    const championInviteUrl = await createOrganizationWithChampion(adminPage, {
      baseUrl,
      adminEmail,
      adminPassword,
      organizationName,
      championEmail,
      championFirstName: 'Customer',
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

    await createSiteWithDepartments(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      siteName,
      departments: [departmentName],
    })

    await createProject(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      processName,
      siteName,
      departmentName,
      productName,
    })

    const customerInviteUrl = await createUserInvitation(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      inviteeEmail: customerEmail,
      inviteeFirstName: 'Customer',
      inviteeLastName: 'Multi',
      role: 'customer',
    })

    const customerActivation = await activateInvitationInFreshContext(browser, {
      inviteUrl: customerInviteUrl,
      password: customerPassword,
      expectedEmail: customerEmail,
    })

    customerContext = customerActivation.context
    const customerPage = customerActivation.page

    await grantCustomerAccess(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      customerEmail,
      projectName: processName,
      modules: ['PFD', 'PFMEA'],
    })

    await ensureLoggedIn(customerPage, {
      baseUrl,
      targetPath: '/projects',
      email: customerEmail,
      password: customerPassword,
    })

    const projectRow = customerPage.locator('tr').filter({ hasText: processName }).first()
    await projectRow.waitFor({ state: 'visible', timeout: 30000 })

    const pfdLink = projectRow.getByRole('link', { name: /^PFD$/i }).first()
    const pfmeaLink = projectRow.getByRole('link', { name: /^PFMEA$/i }).first()
    await pfdLink.waitFor({ state: 'visible', timeout: 30000 })
    await pfmeaLink.waitFor({ state: 'visible', timeout: 30000 })
    if (await projectRow.getByRole('link', { name: /^PCP$/i }).count()) {
      throw new Error('Customer should not see PCP action without explicit grant.')
    }

    const pfdHref = await pfdLink.getAttribute('href')
    const pfmeaHref = await pfmeaLink.getAttribute('href')
    if (!pfdHref || !/\/pfd\?project=/.test(pfdHref)) {
      throw new Error('Customer PFD link is missing or malformed.')
    }
    if (!pfmeaHref || !/\/pfmea\?project=/.test(pfmeaHref)) {
      throw new Error('Customer PFMEA link is missing or malformed.')
    }

    const grantedProjectId = new URL(pfdHref, baseUrl).searchParams.get('project')
    if (!grantedProjectId) {
      throw new Error('Could not extract granted project id from multi-grant link.')
    }

    await assertSettingsAccessDenied(customerPage, baseUrl, '/settings/customer-access')
    await assertGrantedRoute(customerPage, baseUrl, pfdHref, /\/pfd\?project=/)
    await assertGrantedRoute(customerPage, baseUrl, pfmeaHref, /\/pfmea\?project=/)
    await assertDeniedRoute(customerPage, baseUrl, `/pcp?project=${encodeURIComponent(grantedProjectId)}`)

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: run,
          baseUrl,
          organizationName,
          championEmail,
          customerEmail,
          processName,
          customerGrantedModules: ['PFD', 'PFMEA'],
          championInviteUrl,
          customerInviteUrl,
          grantedProjectId,
          customerFinalUrl: customerPage.url(),
        },
        null,
        2
      )
    )
  } finally {
    await customerContext?.close().catch(() => {})
    await championContext?.close().catch(() => {})
    await adminContext.close().catch(() => {})
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2))
  process.exit(1)
})
