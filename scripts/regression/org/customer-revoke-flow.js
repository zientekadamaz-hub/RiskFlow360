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
  revokeCustomerAccess,
  waitForAppReady,
} = require('../_shared/invitationFlow')
const { buildPassword, buildUniqueEmail, buildUniqueOrganizationName } = require('../_shared/testAccounts')

function runId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

async function assertModuleRouteDenied(page, baseUrl, path) {
  await page.goto(new URL(path, baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForAppReady(page)
  await page.waitForURL(/\/projects(?:\?|$)/, { timeout: 30000 }).catch(() => {})
  if (!/\/projects(?:\?|$)/.test(page.url())) {
    throw new Error(`Expected module route ${path} to redirect to /projects, but stayed on ${page.url()}`)
  }
}

async function main() {
  loadLocalEnv()

  const baseUrl = getBaseUrl()
  const adminEmail = getRequiredEnv('REGRESSION_ADMIN_EMAIL')
  const adminPassword = getRequiredEnv('REGRESSION_ADMIN_PASSWORD')
  const run = runId()

  const organizationName = buildUniqueOrganizationName('customer-revoke-org', run)
  const championEmail = buildUniqueEmail('customer-revoke-champion', run)
  const customerEmail = buildUniqueEmail('customer-revoke-user', run)
  const championPassword = buildPassword('champion')
  const customerPassword = buildPassword('customer')
  const siteName = `Site ${run.slice(-6)}`
  const departmentName = `Dept ${run.slice(-4)}`
  const processName = `Customer revoke ${run.slice(-6)}`
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
      inviteeLastName: 'Revoke',
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
      modules: ['PFD'],
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
    await pfdLink.waitFor({ state: 'visible', timeout: 30000 })
    const pfdHref = await pfdLink.getAttribute('href')
    if (!pfdHref || !/\/pfd\?project=/.test(pfdHref)) {
      throw new Error('Customer PFD link is missing before revoke.')
    }
    const grantedProjectId = new URL(pfdHref, baseUrl).searchParams.get('project')
    if (!grantedProjectId) {
      throw new Error('Could not extract granted project id before revoke.')
    }

    await revokeCustomerAccess(championPage, {
      baseUrl,
      championEmail,
      championPassword,
      customerEmail,
      projectName: processName,
      moduleName: 'PFD',
    })

    await customerPage.goto(new URL('/projects', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitForAppReady(customerPage)
    if (await customerPage.locator('tr').filter({ hasText: processName }).count()) {
      throw new Error('Customer still sees project row after revoke.')
    }
    await customerPage.getByText('No granted modules yet', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

    await assertSettingsAccessDenied(customerPage, baseUrl, '/settings/customer-access')
    await assertModuleRouteDenied(customerPage, baseUrl, `/pfd?project=${encodeURIComponent(grantedProjectId)}`)
    await assertModuleRouteDenied(customerPage, baseUrl, `/pfmea?project=${encodeURIComponent(grantedProjectId)}`)
    await assertModuleRouteDenied(customerPage, baseUrl, `/pcp?project=${encodeURIComponent(grantedProjectId)}`)

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
          championInviteUrl,
          customerInviteUrl,
          revokedModule: 'PFD',
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
