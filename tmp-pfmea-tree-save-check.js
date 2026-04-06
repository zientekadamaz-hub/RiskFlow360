const { chromium } = require('C:/Users/zieada/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'b9887505-30a8-4440-b10d-ee1101480b8c'
const PFMEA_URL = `${BASE_URL}/pfmea?project=${PROJECT_ID}`
const EMAIL = 'zientek.adam.az@gmail.com'
const PASSWORD = 'Riskflow360!'
const RUN_ID = 'TREE_1775162071653'

async function ensureLoggedIn(page) {
  await page.goto(PFMEA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  if (!/\/login(?:\?|$)|^http:\/\/localhost:3000\/$/.test(page.url())) return
  await page.goto(`${BASE_URL}/login?next=${encodeURIComponent(`/pfmea?project=${PROJECT_ID}`)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const emailInput = page.locator('input[name="email"]')
  const passwordInput = page.locator('input[name="password"]')
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 })
  await emailInput.click()
  await emailInput.fill('')
  await emailInput.type(EMAIL, { delay: 25 })
  await passwordInput.click()
  await passwordInput.fill('')
  await passwordInput.type(PASSWORD, { delay: 25 })
  const emailValue = await emailInput.inputValue()
  const passwordValue = await passwordInput.inputValue()
  if (emailValue !== EMAIL || passwordValue !== PASSWORD) {
    throw new Error(`Login form values not applied correctly. email="${emailValue}" passwordLength=${passwordValue.length}`)
  }
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL(new RegExp(`/pfmea\\?project=${PROJECT_ID.replace(/-/g, '\\-')}`), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
}

async function findTable(page) {
  const table = page.locator('table').last()
  await table.waitFor({ state: 'visible', timeout: 30000 })
  return table
}

async function collectRunRows(table, runId) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const result = []
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const text = (await row.innerText()).replace(/\s+/g, ' ').trim()
    if (!text.includes(runId)) continue
    result.push({ index: i, text })
  }
  return result
}

async function touchRunRow(page, table, runId) {
  const targetMarker = `${runId}_A_1_1_1_1`
  const row = table.locator('tbody tr').filter({ hasText: targetMarker }).first()
  await row.waitFor({ state: 'visible', timeout: 30000 })
  const cell = row.locator('td.editable:not(.scaleSelectCell)').first()
  await cell.click({ force: true })
  const editor = page.locator('.pfmeaEditor').last()
  await editor.waitFor({ state: 'visible', timeout: 10000 })
  const updatedValue = `${targetMarker}_SAVED`
  await editor.fill(updatedValue)
  await editor.evaluate((el) => el.blur())
  await page.waitForTimeout(500)
  return { targetMarker, updatedValue }
}

async function openSaveModal(page) {
  const saveButtons = page.getByRole('button', { name: /^Save$/i })
  const count = await saveButtons.count()
  const candidates = []
  for (let i = 0; i < count; i += 1) {
    const btn = saveButtons.nth(i)
    const disabled = await btn.isDisabled().catch(() => false)
    const box = await btn.boundingBox().catch(() => null)
    candidates.push({ i, disabled, box })
  }

  const topButton = saveButtons.first()
  await topButton.scrollIntoViewIfNeeded().catch(() => {})
  await topButton.click({ force: true }).catch(() => {})
  await page.waitForTimeout(1000)

  if (await page.getByText('Save PFMEA', { exact: true }).count()) {
    return { opened: true, candidates }
  }

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((el) => el.textContent?.trim() === 'Save')
    if (btn) btn.click()
  })
  await page.waitForTimeout(1000)

  return {
    opened: await page.getByText('Save PFMEA', { exact: true }).count() > 0,
    candidates,
  }
}

async function saveDraft(page) {
  const openResult = await openSaveModal(page)
  if (!openResult.opened) return { opened: false, openResult }

  const modal = page.locator('div').filter({ has: page.getByText('Save PFMEA', { exact: true }) }).last()
  const descField = modal.locator('textarea').first()
  const modalVisible = await modal.isVisible().catch(() => false)
  const textareaVisible = await descField.isVisible().catch(() => false)
  if (!textareaVisible) {
    const screenshotPath = `test-results/${RUN_ID}-save-modal-debug.png`
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
    return {
      opened: true,
      modalVisible,
      textareaVisible,
      screenshotPath,
      openResult,
      bodySnippet: (await page.locator('body').innerText()).slice(0, 1500),
    }
  }
  await descField.fill(`PFMEA tree save check ${RUN_ID}`)
  const modalSave = modal.getByRole('button', { name: /^Save$/i }).first()
  await modalSave.click({ force: true })
  await page.waitForTimeout(4000)
  return { opened: true, modalVisible, textareaVisible, openResult }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1300 } })
  try {
    await ensureLoggedIn(page)
    const table = await findTable(page)
    const touchResult = await touchRunRow(page, table, RUN_ID)
    const beforeSaveRows = await collectRunRows(table, RUN_ID)
    const beforePath = `test-results/${RUN_ID}-save-check-before.png`
    await page.screenshot({ path: beforePath, fullPage: true })

    const saveResult = await saveDraft(page)

    await page.goto(PFMEA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    const tableAfter = await findTable(page)
    const afterSaveRows = await collectRunRows(tableAfter, RUN_ID)
    const afterPath = `test-results/${RUN_ID}-save-check-after.png`
    await page.screenshot({ path: afterPath, fullPage: true })

    const beforeOrder = beforeSaveRows.map((row) => row.text)
    const afterOrder = afterSaveRows.map((row) => row.text)

    console.log(JSON.stringify({
      runId: RUN_ID,
      beforeCount: beforeSaveRows.length,
      afterCount: afterSaveRows.length,
      sameOrder: JSON.stringify(beforeOrder) === JSON.stringify(afterOrder),
      firstDiffIndex: beforeOrder.findIndex((text, index) => afterOrder[index] !== text),
      touchResult,
      saveResult,
      beforePreview: beforeSaveRows.slice(0, 20),
      afterPreview: afterSaveRows.slice(0, 20),
      beforePath,
      afterPath,
      finalUrl: page.url(),
    }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
