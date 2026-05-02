const { ensureLoggedIn } = require('../_shared/browserAuth')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { getPlaywright } = require('../_shared/playwright')
const { createClient } = require('@supabase/supabase-js')

function getPfmeaConfig(projectEnvName = 'PFMEA_REGRESSION_PROJECT_ID') {
  loadLocalEnv()
  return {
    baseUrl: getBaseUrl(),
    email: getRequiredEnv('REGRESSION_EMAIL'),
    password: getRequiredEnv('REGRESSION_PASSWORD'),
    projectId: getRequiredEnv(projectEnvName),
    supabaseUrl: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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

function normalizeVisibleText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactVisibleText(value) {
  return normalizeVisibleText(value).replace(/\s+/g, '')
}

function rowLocatorById(table, rowId) {
  return table.locator(`tbody tr[data-pfmea-row-id="${rowId}"]`).first()
}

async function hoverRow(row) {
  await row.scrollIntoViewIfNeeded()
  await row.hover({ force: true })
}

async function getRowIndex(row) {
  return row.evaluate((el) => {
    const parent = el.parentElement
    if (!parent) return -1
    return Array.from(parent.children).indexOf(el)
  })
}

async function getTableRowIds(table) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const ids = []
  for (let i = 0; i < count; i += 1) {
    const id = await rows.nth(i).getAttribute('data-pfmea-row-id')
    ids.push(id || `__missing__${i}`)
  }
  return ids
}

async function clickAddOnRow(row, titlePattern) {
  const table = row.locator('xpath=ancestor::table[1]')
  const beforeRowIds = await getTableRowIds(table)
  const rowIndex = await getRowIndex(row)
  await hoverRow(row)
  const addBtn = row.getByRole('button', { name: titlePattern }).first()
  const firstEditableCell = row.locator('td.editable').first()
  await firstEditableCell.waitFor({ state: 'visible', timeout: 10000 })
  await firstEditableCell.hover({ force: true })
  await addBtn.waitFor({ state: 'visible', timeout: 10000 })
  await addBtn.click({ force: true })
  await row.page().waitForTimeout(350)
  return { rowIndex, beforeRowIds }
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

async function activateInsertedCell(table, anchorRowIndex, cellKey) {
  await retryAction(async () => {
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    if (count === 0) throw new Error('PFMEA table has no rows.')

    const targetIndex = Math.min(Math.max(anchorRowIndex + 1, 0), count - 1)
    const insertedRow = rows.nth(targetIndex)
    await insertedRow.waitFor({ state: 'visible', timeout: 10000 })
    await insertedRow.scrollIntoViewIfNeeded()

    const targetCell = insertedRow.locator(`td[data-pfmea-col="${cellKey}"]`).first()
    const cell = (await targetCell.count()) > 0 ? targetCell : insertedRow.locator('td.editable').first()

    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.click({ force: true })
  })
  await table.page().waitForTimeout(250)
}

async function getActiveEditorRow(table, expectedCellKey, timeoutMs = 10000) {
  return retryAction(async () => {
    const editor = table.page().locator('.pfmeaEditor').last()
    await editor.waitFor({ state: 'visible', timeout: timeoutMs })
    const meta = await editor.evaluate((el) => {
      const cell = el.closest('td')
      const row = el.closest('tr')
      return {
        cellKey: cell?.getAttribute('data-pfmea-col') ?? null,
        rowId: row?.getAttribute('data-pfmea-row-id') ?? null,
      }
    })
    if (!meta.rowId) throw new Error('PFMEA editor opened without a row id.')
    if (expectedCellKey && meta.cellKey !== expectedCellKey) {
      throw new Error(`PFMEA editor opened in ${meta.cellKey ?? 'unknown'} instead of ${expectedCellKey}.`)
    }
    const row = rowLocatorById(table, meta.rowId)
    await row.waitFor({ state: 'visible', timeout: 10000 })
    return row
  })
}

async function getInsertedRow(table, anchorRowIndex) {
  return retryAction(async () => {
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    const targetIndex = Math.min(Math.max(anchorRowIndex + 1, 0), count - 1)
    const row = rows.nth(targetIndex)
    await row.waitFor({ state: 'visible', timeout: 10000 })
    return row
  })
}

async function getInsertedRowByDiff(table, beforeRowIds, anchorRowIndex, timeoutMs = 15000) {
  const beforeSet = new Set(beforeRowIds)
  const deadline = Date.now() + timeoutMs
  let lastSeenCount = 0

  while (Date.now() < deadline) {
    const rows = table.locator('tbody tr')
    const count = await rows.count()
    lastSeenCount = count
    const unseenRows = []

    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i)
      const rowId = await row.getAttribute('data-pfmea-row-id')
      if (rowId && !beforeSet.has(rowId)) {
        unseenRows.push({ rowId, index: i })
      }
    }

    if (unseenRows.length === 1) {
      const resolvedRow = rowLocatorById(table, unseenRows[0].rowId)
      await resolvedRow.waitFor({ state: 'visible', timeout: 10000 })
      return resolvedRow
    }

    if (unseenRows.length > 1) {
      const targetIndex = Math.min(Math.max(anchorRowIndex + 1, 0), count - 1)
      const exactTarget = unseenRows.find((item) => item.index === targetIndex)
      if (exactTarget) {
        const resolvedRow = rowLocatorById(table, exactTarget.rowId)
        await resolvedRow.waitFor({ state: 'visible', timeout: 10000 })
        return resolvedRow
      }

      const fallbackRow = rows.nth(targetIndex)
      await fallbackRow.waitFor({ state: 'visible', timeout: 10000 })
      return fallbackRow
    }

    if (count > beforeRowIds.length) {
      const targetIndex = Math.min(Math.max(anchorRowIndex + 1, 0), count - 1)
      const fallbackRow = rows.nth(targetIndex)
      await fallbackRow.waitFor({ state: 'visible', timeout: 10000 })
      return fallbackRow
    }

    await table.page().waitForTimeout(300)
  }

  throw new Error(
    `Could not identify inserted PFMEA row by row-id diff within ${timeoutMs}ms. before=${beforeRowIds.length}, after=${lastSeenCount}`
  )
}

async function waitForRowCellValue(row, cellKey, expectedValue) {
  const normalizedExpected = normalizeVisibleText(expectedValue)
  const compactExpected = compactVisibleText(expectedValue)
  await retryAction(async () => {
    const cell = row.locator(`td[data-pfmea-col="${cellKey}"]`).first()
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    const actual = normalizeVisibleText(await cell.innerText())
    const compactActual = compactVisibleText(actual)
    if (!actual.includes(normalizedExpected) && !compactActual.includes(compactExpected)) {
      throw new Error(`Expected "${normalizedExpected}" in ${cellKey}, got "${actual}"`)
    }
  })
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
    const editor = page.locator('.pfmeaEditor').last()
    try {
      await editor.waitFor({ state: 'visible', timeout: 800 })
    } catch {
      await cell.evaluate((el) => {
        if (el instanceof HTMLElement) el.click()
      })
      await editor.waitFor({ state: 'visible', timeout: 3000 })
    }
    await fillActiveEditor(page, value)
  })
}

async function addFailureMode(table, anchorRow, fmText) {
  const insertion = await clickAddOnRow(anchorRow, /Add failure mode row/i)
  let editorReady = true
  const row = await getActiveEditorRow(table, 'failure_mode').catch(async () => {
    editorReady = false
    return getInsertedRowByDiff(table, insertion.beforeRowIds, insertion.rowIndex).catch(async () => {
      await activateInsertedCell(table, insertion.rowIndex, 'failure_mode')
      return getInsertedRow(table, insertion.rowIndex)
    })
  })
  if (!editorReady) {
    const cell = row.locator('td[data-pfmea-col="failure_mode"]').first()
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.click({ force: true })
  }
  await fillActiveEditor(anchorRow.page(), fmText)
  await waitForRowCellValue(row, 'failure_mode', fmText)
  return row
}

async function materializeFailureMode(table, anchorRow, fmText) {
  await hoverRow(anchorRow)
  const editableCell = anchorRow.locator('td.editable').first()
  await editableCell.waitFor({ state: 'visible', timeout: 10000 })
  await editableCell.click({ force: true })
  await fillActiveEditor(anchorRow.page(), fmText)
  await waitForRowCellValue(anchorRow, 'failure_mode', fmText)
  return anchorRow
}

async function addEffect(page, table, anchorRow, effectText, sev) {
  const insertion = await clickAddOnRow(anchorRow, /Add effect row/i)
  let editorReady = true
  const row = await getActiveEditorRow(table, 'effect').catch(async () => {
    editorReady = false
    return getInsertedRowByDiff(table, insertion.beforeRowIds, insertion.rowIndex).catch(async () => {
      await activateInsertedCell(table, insertion.rowIndex, 'effect')
      return getInsertedRow(table, insertion.rowIndex)
    })
  })
  if (!editorReady) {
    const cell = row.locator('td[data-pfmea-col="effect"]').first()
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.click({ force: true })
  }
  await fillActiveEditor(page, effectText)
  await waitForRowCellValue(row, 'effect', effectText)
  await selectScaleValueInRow(page, row, 'severity', sev)
  return row
}

async function addCause(page, table, anchorRow, causeText, occ, prevText, detText, detVal) {
  const insertion = await clickAddOnRow(anchorRow, /Add cause row/i)
  let editorReady = true
  const row = await getActiveEditorRow(table, 'cause').catch(async () => {
    editorReady = false
    return getInsertedRowByDiff(table, insertion.beforeRowIds, insertion.rowIndex).catch(async () => {
      await activateInsertedCell(table, insertion.rowIndex, 'cause')
      return getInsertedRow(table, insertion.rowIndex)
    })
  })
  if (!editorReady) {
    const cell = row.locator('td[data-pfmea-col="cause"]').first()
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.click({ force: true })
  }
  await fillActiveEditor(page, causeText)
  await waitForRowCellValue(row, 'cause', causeText)
  await selectScaleValueInRow(page, row, 'occurrence', occ)
  await fillTextCellInRow(page, row, 'current_prevention', prevText)
  await fillTextCellInRow(page, row, 'current_detection', detText)
  await selectScaleValueInRow(page, row, 'detection', detVal)
  return row
}

async function addAction(page, table, anchorRow, actionText) {
  const insertion = await clickAddOnRow(anchorRow, /Add recommended action row/i)
  let editorReady = true
  const row = await getActiveEditorRow(table, 'recommended_action').catch(async () => {
    editorReady = false
    return getInsertedRowByDiff(table, insertion.beforeRowIds, insertion.rowIndex).catch(async () => {
      await activateInsertedCell(table, insertion.rowIndex, 'recommended_action')
      return getInsertedRow(table, insertion.rowIndex)
    })
  })
  if (!editorReady) {
    const cell = row.locator('td[data-pfmea-col="recommended_action"]').first()
    await cell.waitFor({ state: 'visible', timeout: 10000 })
    await cell.click({ force: true })
  }
  await fillActiveEditor(page, actionText)
  await waitForRowCellValue(row, 'recommended_action', actionText)
  return row
}

async function collectRunRows(table, runId) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const result = []
  const normalizedRunId = normalizeVisibleText(runId)
  const compactRunId = compactVisibleText(runId)
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const text = normalizeVisibleText(await row.innerText())
    const compactText = compactVisibleText(text)
    if (!text.includes(normalizedRunId) && !compactText.includes(compactRunId)) continue
    result.push({ index: i, text, compactText })
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

async function getOpenPfmeaRevisionStats(config) {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const signInRes = await supabase.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  })
  if (signInRes.error) throw signInRes.error

  const projectRes = await supabase
    .from('projects_with_revision')
    .select('current_open_revision_id,open_revision_label')
    .eq('id', config.projectId)
    .maybeSingle()

  if (projectRes.error) throw projectRes.error

  const currentOpenRevisionId = (projectRes.data?.current_open_revision_id ?? '').trim()
  if (!currentOpenRevisionId) {
    return {
      currentOpenRevisionId: null,
      openRevisionLabel: projectRes.data?.open_revision_label ?? null,
      rowCount: 0,
    }
  }

  const countRes = await supabase
    .from('pfmea_rows')
    .select('id', { count: 'exact', head: true })
    .eq('revision_id', currentOpenRevisionId)

  if (countRes.error) throw countRes.error

  return {
    currentOpenRevisionId,
    openRevisionLabel: projectRes.data?.open_revision_label ?? null,
    rowCount: countRes.count ?? 0,
  }
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
  getOpenPfmeaRevisionStats,
  selectScaleValueInRow,
  startPfmeaEdit,
}
