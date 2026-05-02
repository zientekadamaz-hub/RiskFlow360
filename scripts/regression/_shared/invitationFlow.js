const { buildTargetUrl } = require('./env')
const { ensureLoggedIn } = require('./browserAuth')

async function fillByLabelOrPlaceholder(page, options) {
  const { label, placeholder, value } = options

  if (label) {
    const labeled = page.getByLabel(label, { exact: false }).first()
    if (await labeled.count()) {
      await labeled.fill(value)
      return
    }
  }

  if (placeholder) {
    const byPlaceholder = page.getByPlaceholder(placeholder, { exact: false }).first()
    if (await byPlaceholder.count()) {
      await byPlaceholder.fill(value)
      return
    }
  }

  throw new Error(`Could not find input for ${label || placeholder}`)
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
}

async function getInvitationRoleOptions(page) {
  const roleSelect = page.locator('select.inviteSelect').first()
  await roleSelect.waitFor({ state: 'visible', timeout: 30000 })
  return roleSelect.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || '').trim().toUpperCase())
  )
}

async function assertInvitationRoleAbsent(page, roleLabel) {
  const options = await getInvitationRoleOptions(page)
  if (options.includes(roleLabel.trim().toUpperCase())) {
    throw new Error(`Invitation role ${roleLabel} should be hidden, but is still available.`)
  }
}

async function assertInvitationRolePresent(page, roleLabel) {
  const options = await getInvitationRoleOptions(page)
  if (!options.includes(roleLabel.trim().toUpperCase())) {
    throw new Error(`Invitation role ${roleLabel} should be available, but is missing.`)
  }
}

async function createOrganizationWithChampion(page, options) {
  const {
    baseUrl,
    adminEmail,
    adminPassword,
    organizationName,
    championEmail,
    championFirstName,
    championLastName,
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/settings/organizations',
    email: adminEmail,
    password: adminPassword,
  })

  await page.getByText('Create organization', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

  await fillByLabelOrPlaceholder(page, {
    label: 'Organization name',
    placeholder: 'New organization',
    value: organizationName,
  })
  await fillByLabelOrPlaceholder(page, {
    label: 'Champion email',
    placeholder: 'champion@example.com',
    value: championEmail,
  })
  await fillByLabelOrPlaceholder(page, {
    label: 'Champion first name',
    placeholder: 'First name',
    value: championFirstName,
  })
  await fillByLabelOrPlaceholder(page, {
    label: 'Champion last name',
    placeholder: 'Last name',
    value: championLastName,
  })

  await page.getByRole('button', { name: /^Create organization$/i }).click()

  const linkLabel = page.getByText('Champion invitation link ready', { exact: false }).first()
  await linkLabel.waitFor({ state: 'visible', timeout: 30000 })

  const inviteInput = page.locator('input[readonly]').filter({ hasText: '' }).last()
  const inviteUrl = await inviteInput.inputValue()
  if (!inviteUrl || !/^https?:\/\//i.test(inviteUrl)) {
    throw new Error('Champion invitation URL was not rendered after organization creation.')
  }

  return inviteUrl
}

async function createUserInvitation(page, options) {
  const {
    baseUrl,
    championEmail,
    championPassword,
    inviteeEmail,
    inviteeFirstName,
    inviteeLastName,
    role = 'engineer',
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/settings/invitations',
    email: championEmail,
    password: championPassword,
  })

  await page.getByText('Send invitation', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

  const firstNameInput = page.getByPlaceholder('First name', { exact: true }).first()
  const lastNameInput = page.getByPlaceholder('Last name', { exact: true }).first()
  const emailInput = page.getByPlaceholder('user@example.com', { exact: true }).first()

  await firstNameInput.fill(inviteeFirstName)
  await lastNameInput.fill(inviteeLastName)
  await emailInput.fill(inviteeEmail)

  const roleSelect = page.locator('select.inviteSelect').first()
  await roleSelect.selectOption(role)

  await page.getByRole('button', { name: /^Send$/i }).click()
  await page.getByText('Invitation link ready', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

  const inviteInput = page.locator('input[readonly]').filter({ hasText: '' }).last()
  const inviteUrl = await inviteInput.inputValue()
  if (!inviteUrl || !/^https?:\/\//i.test(inviteUrl)) {
    throw new Error('User invitation URL was not rendered after sending invitation.')
  }

  return inviteUrl
}

async function createSiteWithDepartments(page, options) {
  const {
    baseUrl,
    championEmail,
    championPassword,
    siteName,
    departments,
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/settings/sites-departments',
    email: championEmail,
    password: championPassword,
  })

  await page.getByRole('button', { name: /\+ Add site/i }).click()

  const siteInput = page.getByPlaceholder('Site name...', { exact: true }).first()
  const departmentsInput = page.getByPlaceholder('Add departments, separated by commas', { exact: true }).first()

  await siteInput.fill(siteName)
  await departmentsInput.fill(departments.join(', '))
  await page.getByRole('button', { name: /^Save$/i }).first().click()

  await page.getByText(siteName, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
  for (const department of departments) {
    await page.getByText(department, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
  }
}

async function createProject(page, options) {
  const {
    baseUrl,
    championEmail,
    championPassword,
    processName,
    siteName,
    departmentName,
    productName,
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/projects',
    email: championEmail,
    password: championPassword,
  })

  await page.getByRole('button', { name: /^Create project$/i }).click()

  const createRow = page.locator('tr').filter({ has: page.getByPlaceholder('Process name', { exact: true }) }).first()
  await createRow.getByPlaceholder('Process name', { exact: true }).fill(processName)

  const selects = createRow.locator('select.projectSelect')
  await selects.nth(0).selectOption({ label: siteName })
  await selects.nth(1).selectOption({ label: departmentName })

  if (productName) {
    await createRow.getByPlaceholder('Product name', { exact: true }).first().fill(productName)
  }

  await createRow.getByRole('button', { name: /^Create$/i }).click()

  const projectRow = page.locator('tr').filter({ hasText: processName }).first()
  await projectRow.waitFor({ state: 'visible', timeout: 30000 })
}

async function grantCustomerAccess(page, options) {
  const {
    baseUrl,
    championEmail,
    championPassword,
    customerEmail,
    projectName,
    modules,
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/settings/customer-access',
    email: championEmail,
    password: championPassword,
  })

  await page.getByText('Assign customer access', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

  const customerSelect = page.locator('select').nth(0)
  const projectSelect = page.locator('select').nth(1)

  const customerValue = await customerSelect.locator('option').evaluateAll(
    (nodes, targetEmail) => {
      const match = nodes.find((node) => (node.textContent || '').includes(String(targetEmail)))
      return match instanceof HTMLOptionElement ? match.value : ''
    },
    customerEmail
  )
  if (!customerValue) {
    throw new Error(`Could not find customer option for ${customerEmail}.`)
  }

  const projectValue = await projectSelect.locator('option').evaluateAll(
    (nodes, targetProject) => {
      const match = nodes.find((node) => (node.textContent || '').includes(String(targetProject)))
      return match instanceof HTMLOptionElement ? match.value : ''
    },
    projectName
  )
  if (!projectValue) {
    throw new Error(`Could not find project option for ${projectName}.`)
  }

  await customerSelect.selectOption(customerValue)
  await projectSelect.selectOption(projectValue)

  const enabledModules = new Set(modules.map((moduleName) => String(moduleName).trim().toUpperCase()))
  for (const moduleName of ['PFD', 'PFMEA', 'PCP']) {
    const checkbox = page
      .locator('label')
      .filter({ hasText: new RegExp(`^${moduleName}$`) })
      .locator('input[type="checkbox"]')
      .first()
    const shouldBeChecked = enabledModules.has(moduleName)
    const isChecked = await checkbox.isChecked()
    if (shouldBeChecked && !isChecked) {
      await checkbox.check({ force: true })
    }
    if (!shouldBeChecked && isChecked) {
      await checkbox.uncheck({ force: true })
    }
  }

  await page.getByRole('button', { name: /^Apply access$/i }).click()
  await page.getByText('Customer access updated.', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('tr').filter({ hasText: customerEmail }).filter({ hasText: projectName }).first().waitFor({ state: 'visible', timeout: 30000 })
}

async function revokeCustomerAccess(page, options) {
  const {
    baseUrl,
    championEmail,
    championPassword,
    customerEmail,
    projectName,
    moduleName,
  } = options

  await ensureLoggedIn(page, {
    baseUrl,
    targetPath: '/settings/customer-access',
    email: championEmail,
    password: championPassword,
  })

  await page.getByText('Active customer grants', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })

  const row = page
    .locator('tr')
    .filter({ hasText: customerEmail })
    .filter({ hasText: projectName })
    .filter({ hasText: moduleName })
    .first()

  await row.waitFor({ state: 'visible', timeout: 30000 })
  await row.getByRole('button', { name: /^Revoke$/i }).click()

  await page.getByText('Grant removed.', { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
  await row.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {})
}

async function activateInvitationInFreshContext(browser, options) {
  const { inviteUrl, password, expectedEmail } = options
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()

  try {
    await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await waitForAppReady(page)

    const signInOrSetPassword = page.getByRole('link', { name: /Sign in or set password/i }).first()
    if (await signInOrSetPassword.count()) {
      await signInOrSetPassword.click()
      await waitForAppReady(page)
    }

    const setPasswordAction = page.getByRole('button', { name: /^Set password$/i }).first()
    if (await setPasswordAction.count()) {
      await setPasswordAction.click()
      await waitForAppReady(page)
    } else {
      const textAction = page.getByRole('button', { name: /First access\\? Set password/i }).first()
      if (await textAction.count()) {
        await textAction.click()
        await waitForAppReady(page)
      }
    }

    if (expectedEmail) {
      await page.getByText(expectedEmail, { exact: false }).first().waitFor({ state: 'visible', timeout: 30000 })
    }

    await page.locator('input[name=\"newPassword\"]').fill(password)
    await page.locator('input[name=\"repeatPassword\"]').fill(password)
    await page.getByRole('button', { name: /^Set password$/i }).last().click()

    await page.waitForURL(/\/waiting-for-invite(?:\?|$)|\/$/, { timeout: 30000 }).catch(() => {})
    await waitForAppReady(page)

    if (/\/waiting-for-invite(?:\?|$)/.test(page.url())) {
      await page.waitForURL(/\/$/, { timeout: 30000 }).catch(() => {})
    }

    await waitForAppReady(page)

    return {
      finalUrl: page.url(),
      context,
      page,
    }
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}

async function assertSettingsAccessDenied(page, baseUrl, path = '/settings/invitations') {
  await page.goto(buildTargetUrl(baseUrl, path), { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitForAppReady(page)

  const currentUrl = page.url()
  if (/\/settings\//.test(currentUrl)) {
    throw new Error(`Expected settings access to be blocked, but user stayed on ${currentUrl}`)
  }
}

module.exports = {
  activateInvitationInFreshContext,
  assertSettingsAccessDenied,
  assertInvitationRoleAbsent,
  assertInvitationRolePresent,
  createProject,
  createSiteWithDepartments,
  createOrganizationWithChampion,
  createUserInvitation,
  fillByLabelOrPlaceholder,
  grantCustomerAccess,
  revokeCustomerAccess,
  getInvitationRoleOptions,
  waitForAppReady,
}
