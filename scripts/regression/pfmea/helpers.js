const { ensureLoggedIn } = require('../_shared/browserAuth')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { getPlaywright } = require('../_shared/playwright')

function getPfmeaConfig(projectEnvName = 'PFMEA_REGRESSION_PROJECT_ID') {
  loadLocalEnv()
  return {
    baseUrl: getBaseUrl(),
    email: getRequiredEnv('REGRESSION_EMAIL'),
    password: getRequiredEnv('REGRESSION_PASSWORD'),
    projectId: getRequiredEnv(projectEnvName),
  }
}

async function launchRegressionPage() {
  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1300 } })
  return { browser, page }
}

async function openPfmea(page, config) {
  const targetPath = `/pfmea?project=${config.projectId}`
  await ensureLoggedIn(page, {
    baseUrl: config.baseUrl,
    targetPath,
    email: config.email,
    password: config.password,
  })
  return targetPath
}

async function startPfmeaEdit(page, options = {}) {
  const { discardExistingDraft = true } = options
  const discardButton = page.getByRole('button', { name: /^Discard draft$/i })
  if (await discardButton.count()) {
    if (!discardExistingDraft) {
      await page.waitForTimeout(1000)
      return { mode: 'existing_draft' }
    }

    await discardButton.first().waitFor({ state: 'visible', timeout: 10000 })
    await discardButton.first().click()
    const confirmYes = page.getByRole('button', { name: /^Yes$/i }).first()
    if (await confirmYes.count()) {
      await confirmYes.waitFor({ state: 'visible', timeout: 10000 })
      await confirmYes.click()
    }
    await page.waitForTimeout(1200)
  }

  const takeoverButton = page.getByRole('button', { name: /take over pfmea/i }).first()
  if (await takeoverButton.count()) {
    throw new Error('PFMEA is locked by another user. Refusing to take over during regression.')
  }

  const editButton = page.getByRole('button', { name: /edit pfmea/i }).first()
  await editButton.waitFor({ state: 'visible', timeout: 30000 })
  await editButton.click()
  await page.waitForTimeout(1200)
  return { mode: discardExistingDraft ? 'fresh_draft' : 'new_draft' }
}

async function findPfmeaTable(page) {
  const table = page.locator('table').last()
  await table.waitFor({ state: 'visible', timeout: 30000 })
  return table
}

function rowLocator(table, text) {
  return table.locator('tbody tr').filter({ hasText: text }).first()
}

async function hoverRow(row) {
  await row.scrollIntoViewIfNeeded()
  await row.hover({ force: true })
}

async function clickAddOnRow(row, titlePattern) {
  await hoverRow(row)
  const addBtn = row.getByRole('button', { name: titlePattern }).first()
  const firstEditableCell = row.locator('td.editable').first()
  await firstEditableCell.waitFor({ state: 'visible', timeout: 10000 })
  await firstEditableCell.hover({ force: true })
  await addBtn.waitFor({ state: 'visible', timeout: 10000 })
  await addBtn.click({ force: true })
  await row.page().waitForTimeout(350)
}

function getCellLocator(row, target, type) {
  if (typeof target === 'string') {
    return row.locator(`td[data-pfmea-col="${target}"]`).first()
  }

  if (type === 'scale') {
    return row.locator('td.scaleSelectCell.gray').nth(target)
  }

  return row.locator('td.editable:not(.scaleSelectCell)').nth(target)
}

async function retryAction(action, attempts = 3) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 350))
        continue
      }
    }
  }
  throw lastError
}

async function fillActiveEditor(page, value) {
  await retryAction(async () => {
    const editor = page.locator('.pfmeaEditor').last()
    await editor.waitFor({ state: 'visible', timeout: 10000 })
    await editor.fill(value)
    await editor.evaluate((el) => el.blur())
  })
  await page.waitForTimeout(400)
}

async function selectScaleValueInRow(page, row, scaleTarget, value) {
  await retryAction(async () => {
    const cell = getCellLocator(row, scaleTarget, 'scale')
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.scrollIntoViewIfNeeded()
    await cell.click({ force: true })
    const option = page
      .locator('div[data-pfmea-popup="true"] button')
      .filter({ hasText: new RegExp(`^${value}\\s*-`) })
      .first()
    await option.waitFor({ state: 'visible', timeout: 10000 })
    await option.click({ force: true })
  })
  await page.waitForTimeout(400)
}

async function fillTextCellInRow(page, row, textTarget, value) {
  await retryAction(async () => {
    const cell = getCellLocator(row, textTarget, 'text')
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.scrollIntoViewIfNeeded()
    await cell.click({ force: true })
    await fillActiveEditor(page, value)
  })
}

async function addFailureMode(table, anchorRow, fmText) {
  await clickAddOnRow(anchorRow, /Add failure mode row/i)
  await fillActiveEditor(anchorRow.page(), fmText)
  const row = rowLocator(table, fmText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  return row
}

async function materializeFailureMode(table, anchorRow, fmText) {
  await hoverRow(anchorRow)
  const editableCell = anchorRow.locator('td.editable').first()
  await editableCell.waitFor({ state: 'visible', timeout: 10000 })
  await editableCell.click({ force: true })
  await fillActiveEditor(anchorRow.page(), fmText)
  const row = rowLocator(table, fmText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  return row
}

async function addEffect(page, table, anchorRow, effectText, sev) {
  await clickAddOnRow(anchorRow, /Add effect row/i)
  await fillActiveEditor(page, effectText)
  const row = rowLocator(table, effectText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  await selectScaleValueInRow(page, row, 'severity', sev)
  return row
}

async function addCause(page, table, anchorRow, causeText, occ, prevText, detText, detVal) {
  await clickAddOnRow(anchorRow, /Add cause row/i)
  await fillActiveEditor(page, causeText)
  const row = rowLocator(table, causeText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  await selectScaleValueInRow(page, row, 'occurrence', occ)
  await fillTextCellInRow(page, row, 'current_prevention', prevText)
  await fillTextCellInRow(page, row, 'current_detection', detText)
  await selectScaleValueInRow(page, row, 'detection', detVal)
  return row
}

async function addAction(page, table, anchorRow, actionText) {
  await clickAddOnRow(anchorRow, /Add recommended action row/i)
  await fillActiveEditor(page, actionText)
  const row = rowLocator(table, actionText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  return row
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

async function savePfmeaDraft(page, description) {
  await page.getByRole('button', { name: /^Save$/i }).first().click()
  await page.waitForTimeout(400)
  await page.getByText('Save PFMEA').waitFor({ state: 'visible', timeout: 10000 })
  const descField = page.locator('textarea[placeholder="Describe changes (required)"]').last()
  await descField.waitFor({ state: 'visible', timeout: 10000 })
  await descField.fill(description)
  const modalRoot = descField.locator('xpath=ancestor::div[1]')
  await modalRoot.getByRole('button', { name: /^Save$/i }).first().click({ force: true })
  await page.waitForTimeout(3000)
}

module.exports = {
  addAction,
  addCause,
  addEffect,
  addFailureMode,
  clickAddOnRow,
  collectRunRows,
  fillActiveEditor,
  fillTextCellInRow,
  findPfmeaTable,
  getPfmeaConfig,
  hoverRow,
  launchRegressionPage,
  materializeFailureMode,
  openPfmea,
  rowLocator,
  savePfmeaDraft,
  selectScaleValueInRow,
  startPfmeaEdit,
}
