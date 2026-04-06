const { ensureLoggedIn } = require('../_shared/browserAuth')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { getPlaywright } = require('../_shared/playwright')

function getRegressionProjectId() {
  const pcpProjectId = process.env.PCP_REGRESSION_PROJECT_ID?.trim()
  if (pcpProjectId) return pcpProjectId
  return getRequiredEnv('PFMEA_REGRESSION_PROJECT_ID')
}

async function main() {
  loadLocalEnv()
  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })

  try {
    const baseUrl = getBaseUrl()
    const projectId = getRegressionProjectId()
    const email = getRequiredEnv('REGRESSION_EMAIL')
    const password = getRequiredEnv('REGRESSION_PASSWORD')
    const targetPath = `/pcp?project=${projectId}`

    await ensureLoggedIn(page, { baseUrl, targetPath, email, password })
    const table = page.locator('table').last()
    await table.waitFor({ state: 'visible', timeout: 30000 })

    const discardButton = page.getByRole('button', { name: /^Discard draft$/i })
    const takeoverButton = page.getByRole('button', { name: /take over pcp/i }).first()
    if (await takeoverButton.count()) {
      throw new Error('PCP is locked by another user. Refusing to take over during regression.')
    }

    if (!(await discardButton.count())) {
      const editButton = page.getByRole('button', { name: /edit pcp/i }).first()
      await editButton.waitFor({ state: 'visible', timeout: 30000 })
      await editButton.click()
      await page.waitForTimeout(1200)
    }

    await page.getByRole('button', { name: /^Save PCP$/i }).waitFor({ state: 'visible', timeout: 10000 })
    const discardVisible = page.getByRole('button', { name: /^Discard draft$/i }).first()
    await discardVisible.waitFor({ state: 'visible', timeout: 10000 })
    await discardVisible.click()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /^Edit PCP$/i }).first().waitFor({ state: 'visible', timeout: 10000 })

    console.log(
      JSON.stringify(
        {
          ok: true,
          finalUrl: page.url(),
          projectId,
        },
        null,
        2
      )
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2))
  process.exit(1)
})
