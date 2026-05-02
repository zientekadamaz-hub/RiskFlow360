const fs = require('fs')
const path = require('path')
const {
  addAction,
  addCause,
  addEffect,
  addFailureMode,
  collectRunRows,
  fillTextCellInRow,
  findPfmeaTable,
  getOpenPfmeaRevisionStats,
  getPfmeaConfig,
  launchRegressionPage,
  materializeFailureMode,
  openPfmea,
  savePfmeaDraft,
  selectScaleValueInRow,
  startPfmeaEdit,
} = require('./helpers')

const RUN_ID = `TREE_${Date.now()}`

function ensure(condition, message, context = {}) {
  if (!condition) {
    const error = new Error(message)
    error.context = context
    throw error
  }
}

async function maybeScreenshot(page, label) {
  const dir = path.join(process.cwd(), 'test-results')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const screenshotPath = path.join(dir, `${RUN_ID}-${label}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  return screenshotPath
}

async function pickCleanSeedRow(table) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()

  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const hasAddButton = (await row.getByRole('button', { name: /Add failure mode row/i }).count()) > 0
    if (!hasAddButton) continue

    const text = (await row.innerText()).replace(/\s+/g, ' ').trim()
    if (/TREE_|MERGE_|FMORD_|DBG_/i.test(text)) continue

    return row
  }

  return null
}

async function main() {
  const config = getPfmeaConfig()
  const { browser, page } = await launchRegressionPage()
  let step = 'launch'

  try {
    step = 'open-pfmea'
    await openPfmea(page, config)
    step = 'start-edit'
    const editState = await startPfmeaEdit(page)
    step = 'find-table'
    const table = await findPfmeaTable(page)

    const rowsWithAddButton = table
      .locator('tbody tr')
      .filter({ has: table.locator('button[title="Add failure mode row"]') })
    const hasAddableRow = (await rowsWithAddButton.count()) > 0
    const cleanSeedRow = hasAddableRow ? await pickCleanSeedRow(table) : null
    const seedRow = cleanSeedRow ?? (hasAddableRow ? rowsWithAddButton.first() : table.locator('tbody tr').first())
    await seedRow.waitFor({ state: 'visible', timeout: 30000 })

    const fmText = `${RUN_ID}_FM_1`
    step = 'add-failure-mode-1'
    const fmRow = hasAddableRow
      ? await addFailureMode(table, seedRow, fmText)
      : await materializeFailureMode(table, seedRow, fmText)

    step = 'fill-first-branch-effect'
    await fillTextCellInRow(page, fmRow, 'effect', `${RUN_ID}_E_1_1`)
    step = 'fill-first-branch-severity'
    await selectScaleValueInRow(page, fmRow, 'severity', 9)
    step = 'fill-first-branch-cause'
    await fillTextCellInRow(page, fmRow, 'cause', `${RUN_ID}_C_1_1_1`)
    step = 'fill-first-branch-occurrence'
    await selectScaleValueInRow(page, fmRow, 'occurrence', 3)
    step = 'fill-first-branch-prev'
    await fillTextCellInRow(page, fmRow, 'current_prevention', `${RUN_ID}_P_1_1_1`)
    step = 'fill-first-branch-det-text'
    await fillTextCellInRow(page, fmRow, 'current_detection', `${RUN_ID}_D_1_1_1`)
    step = 'fill-first-branch-det'
    await selectScaleValueInRow(page, fmRow, 'detection', 9)
    await page.waitForTimeout(1000)
    step = 'fill-first-branch-action'
    await fillTextCellInRow(page, fmRow, 'recommended_action', `${RUN_ID}_A_1_1_1_1`)

    step = 'add-second-action'
    await addAction(page, table, fmRow, `${RUN_ID}_A_1_1_1_2`)

    step = 'add-second-cause'
    await addCause(
      page,
      table,
      fmRow,
      `${RUN_ID}_C_1_1_2`,
      9,
      `${RUN_ID}_P_1_1_2`,
      `${RUN_ID}_D_1_1_2`,
      6
    )

    step = 'add-second-effect'
    const effect2Row = await addEffect(page, table, fmRow, `${RUN_ID}_E_1_2`, 7)
    step = 'fill-second-branch-cause'
    await fillTextCellInRow(page, effect2Row, 'cause', `${RUN_ID}_C_1_2_1`)
    step = 'fill-second-branch-occurrence'
    await selectScaleValueInRow(page, effect2Row, 'occurrence', 5)
    step = 'fill-second-branch-prev'
    await fillTextCellInRow(page, effect2Row, 'current_prevention', `${RUN_ID}_P_1_2_1`)
    step = 'fill-second-branch-det-text'
    await fillTextCellInRow(page, effect2Row, 'current_detection', `${RUN_ID}_D_1_2_1`)
    step = 'fill-second-branch-det'
    await selectScaleValueInRow(page, effect2Row, 'detection', 7)
    await page.waitForTimeout(1000)
    step = 'fill-second-branch-action'
    await fillTextCellInRow(page, effect2Row, 'recommended_action', `${RUN_ID}_A_1_2_1_1`)

    step = 'collect-before-save'
    await page.waitForTimeout(1000)
    const beforeSaveRows = await collectRunRows(table, RUN_ID)
    const beforeScreenshot = await maybeScreenshot(page, 'before-save')

    step = 'save-draft'
    await savePfmeaDraft(page, `PFMEA tree save regression ${RUN_ID}`)
    step = 'reload-after-save'
    await page.goto(`${config.baseUrl}/pfmea?project=${config.projectId}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    step = 'find-table-after-save'
    const tableAfter = await findPfmeaTable(page)
    await page.waitForTimeout(1500)
    step = 'collect-after-save'
    const afterSaveRows = await collectRunRows(tableAfter, RUN_ID)
    const afterScreenshot = await maybeScreenshot(page, 'after-save')

    const beforeTexts = beforeSaveRows.map((row) => row.compactText ?? row.text.replace(/\s+/g, ''))
    const afterTexts = afterSaveRows.map((row) => row.compactText ?? row.text.replace(/\s+/g, ''))
    ensure(beforeSaveRows.length === afterSaveRows.length, 'Row count changed after save', {
      beforeCount: beforeSaveRows.length,
      afterCount: afterSaveRows.length,
    })
    ensure(JSON.stringify(beforeTexts) === JSON.stringify(afterTexts), 'PFMEA hierarchy changed after save', {
      beforeTexts,
      afterTexts,
    })
    const openRevisionStats = await getOpenPfmeaRevisionStats(config)
    ensure(openRevisionStats.rowCount > 0, 'Current OPEN PFMEA revision is empty after save', openRevisionStats)

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: RUN_ID,
          editState,
          beforeCount: beforeSaveRows.length,
          afterCount: afterSaveRows.length,
          openRevisionStats,
          beforeScreenshot,
          afterScreenshot,
        },
        null,
        2
      )
    )
  } catch (error) {
    const highlightedMissing = await page
      .locator('td.flashMissing')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          cellKey: node.getAttribute('data-pfmea-col'),
          text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        }))
      )
      .catch(() => [])
    const failureScreenshot = await maybeScreenshot(page, `failure-${step.replace(/[^a-z0-9]+/gi, '-')}`).catch(() => null)
    error.context = {
      ...(error.context ?? {}),
      step,
      highlightedMissing,
      failureScreenshot,
    }
    throw error
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, context: error.context ?? null }, null, 2))
  process.exit(1)
})
