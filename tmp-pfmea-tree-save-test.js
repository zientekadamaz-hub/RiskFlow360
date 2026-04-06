const { chromium } = require('C:/Users/zieada/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'b9887505-30a8-4440-b10d-ee1101480b8c'
const PFMEA_URL = `${BASE_URL}/pfmea?project=${PROJECT_ID}`
const EMAIL = 'zientek.adam.az@gmail.com'
const PASSWORD = 'Riskflow360!'
const RUN_ID = `TREE_${Date.now()}`

async function ensureLoggedIn(page) {
  await page.goto(PFMEA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  if (!/\/login(?:\?|$)|^http:\/\/localhost:3000\/$/.test(page.url())) return

  await page.goto(`${BASE_URL}/login?next=${encodeURIComponent(`/pfmea?project=${PROJECT_ID}`)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const emailInput = page.locator('input[name="email"]')
  const passwordInput = page.locator('input[name="password"]')
  await emailInput.waitFor({ state: 'visible', timeout: 30000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 })
  await emailInput.fill(EMAIL)
  await passwordInput.fill(PASSWORD)
  await page.getByRole('button', { name: /log in|sign in/i }).click()
  await page.waitForURL(new RegExp(`/pfmea\\?project=${PROJECT_ID.replace(/-/g, '\\-')}`), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
}

async function startEdit(page) {
  if (await page.getByRole('button', { name: /^Discard draft$/i }).count()) {
    await page.waitForTimeout(1000)
    return
  }
  const editButton = page.getByRole('button', { name: /edit pfmea|take over pfmea/i }).first()
  await editButton.waitFor({ state: 'visible', timeout: 30000 })
  await editButton.click()
  await page.waitForTimeout(1200)
}

async function findTable(page) {
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
  await addBtn.waitFor({ state: 'visible', timeout: 10000 })
  await addBtn.click({ force: true })
  await row.page().waitForTimeout(500)
}

async function fillActiveEditor(page, value) {
  const editor = page.locator('.pfmeaEditor').last()
  await editor.waitFor({ state: 'visible', timeout: 10000 })
  await editor.fill(value)
  await editor.evaluate((el) => el.blur())
  await page.waitForTimeout(250)
}

async function selectScaleValueInRow(page, row, scaleIndex, value) {
  const cell = row.locator('td.scaleSelectCell').nth(scaleIndex)
  await cell.waitFor({ state: 'visible', timeout: 10000 })
  await cell.click({ force: true })
  const option = page.locator('div[data-pfmea-popup="true"] button').filter({ hasText: new RegExp(`^${value}\\s*-`) }).first()
  await option.waitFor({ state: 'visible', timeout: 10000 })
  await option.click({ force: true })
  await page.waitForTimeout(250)
}

async function fillTextCellInRow(page, row, textCellIndex, value) {
  const cell = row.locator('td.editable:not(.scaleSelectCell)').nth(textCellIndex)
  await cell.waitFor({ state: 'visible', timeout: 10000 })
  await cell.click({ force: true })
  await fillActiveEditor(page, value)
}

async function addFailureMode(table, anchorRow, fmText) {
  await clickAddOnRow(anchorRow, /Add failure mode row/i)
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
  await selectScaleValueInRow(page, row, 0, sev)
  return row
}

async function addCause(page, table, anchorRow, causeText, occ, prevText, detText, detVal) {
  await clickAddOnRow(anchorRow, /Add cause row/i)
  await fillActiveEditor(page, causeText)
  const row = rowLocator(table, causeText)
  await row.waitFor({ state: 'visible', timeout: 10000 })
  await selectScaleValueInRow(page, row, 0, occ)
  await fillTextCellInRow(page, row, 1, prevText)
  await fillTextCellInRow(page, row, 2, detText)
  await selectScaleValueInRow(page, row, 1, detVal)
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

async function saveDraft(page) {
  await page.getByRole('button', { name: /^Save$/i }).first().click()
  await page.waitForTimeout(400)
  await page.getByText('Save PFMEA').waitFor({ state: 'visible', timeout: 10000 })
  const modal = page.locator('div').filter({ has: page.getByText('Save PFMEA', { exact: true }) }).last()
  const descField = modal.locator('textarea').first()
  await descField.fill(`PFMEA tree save test ${RUN_ID}`)
  const modalSave = modal.getByRole('button', { name: /^Save$/i }).first()
  await modalSave.click({ force: true })
  await page.waitForTimeout(3000)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1300 } })

  try {
    await ensureLoggedIn(page)
    await startEdit(page)
    const table = await findTable(page)

    const baseRow = table.locator('tbody tr').first()
    await baseRow.waitFor({ state: 'visible', timeout: 30000 })

    const failureRows = []
    let failureAnchor = baseRow
    for (let f = 1; f <= 3; f += 1) {
      const fmText = `${RUN_ID}_FM_${f}`
      const fmRow = await addFailureMode(table, failureAnchor, fmText)
      failureRows.push({ marker: fmText, row: fmRow })
      failureAnchor = fmRow
    }

    for (let f = 0; f < failureRows.length; f += 1) {
      let effectAnchor = failureRows[f].row
      for (let e = 1; e <= 3; e += 1) {
        const effectText = `${RUN_ID}_E_${f + 1}_${e}`
        const sev = [9, 7, 4][e - 1]
        const effectRow = await addEffect(page, table, effectAnchor, effectText, sev)
        effectAnchor = effectRow

        let causeAnchor = effectRow
        for (let c = 1; c <= 3; c += 1) {
          const causeText = `${RUN_ID}_C_${f + 1}_${e}_${c}`
          const causeRow = await addCause(
            page,
            table,
            causeAnchor,
            causeText,
            [3, 5, 9][c - 1],
            `${RUN_ID}_P_${f + 1}_${e}_${c}`,
            `${RUN_ID}_D_${f + 1}_${e}_${c}`,
            [9, 7, 6][c - 1]
          )
          causeAnchor = causeRow

          let actionAnchor = causeRow
          for (let a = 1; a <= 3; a += 1) {
            const actionText = `${RUN_ID}_A_${f + 1}_${e}_${c}_${a}`
            const actionRow = await addAction(page, table, actionAnchor, actionText)
            actionAnchor = actionRow
          }
        }
      }
    }

    await page.waitForTimeout(1000)
    const beforeSaveRows = await collectRunRows(table, RUN_ID)
    const beforePath = `test-results/${RUN_ID}-before-save.png`
    await page.screenshot({ path: beforePath, fullPage: true })

    await saveDraft(page)
    await page.goto(PFMEA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    const tableAfter = await findTable(page)
    await page.waitForTimeout(1500)
    const afterSaveRows = await collectRunRows(tableAfter, RUN_ID)
    const afterPath = `test-results/${RUN_ID}-after-save.png`
    await page.screenshot({ path: afterPath, fullPage: true })

    const beforeOrder = beforeSaveRows.map((row) => row.text)
    const afterOrder = afterSaveRows.map((row) => row.text)
    const sameOrder = JSON.stringify(beforeOrder) === JSON.stringify(afterOrder)

    console.log(JSON.stringify({
      runId: RUN_ID,
      beforeCount: beforeSaveRows.length,
      afterCount: afterSaveRows.length,
      sameOrder,
      firstDiffIndex: beforeOrder.findIndex((text, index) => afterOrder[index] !== text),
      beforePreview: beforeSaveRows.slice(0, 25),
      afterPreview: afterSaveRows.slice(0, 25),
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
