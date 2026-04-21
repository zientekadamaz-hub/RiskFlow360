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

async function fillEffectCauseAndActionOnCurrentRow(page, row, { effect, sev, cause, occ, prev, detText, detVal, action }) {
  await fillTextCellInRow(page, row, 'effect', effect)
  await selectScaleValueInRow(page, row, 'severity', sev)
  await fillTextCellInRow(page, row, 'cause', cause)
  await selectScaleValueInRow(page, row, 'occurrence', occ)
  await fillTextCellInRow(page, row, 'current_prevention', prev)
  await fillTextCellInRow(page, row, 'current_detection', detText)
  await selectScaleValueInRow(page, row, 'detection', detVal)
  await fillTextCellInRow(page, row, 'recommended_action', action)
}

async function fillCauseAndActionOnCurrentRow(page, row, { cause, occ, prev, detText, detVal, action }) {
  await fillTextCellInRow(page, row, 'cause', cause)
  await selectScaleValueInRow(page, row, 'occurrence', occ)
  await fillTextCellInRow(page, row, 'current_prevention', prev)
  await fillTextCellInRow(page, row, 'current_detection', detText)
  await selectScaleValueInRow(page, row, 'detection', detVal)
  await fillTextCellInRow(page, row, 'recommended_action', action)
}

async function main() {
  const config = getPfmeaConfig()
  const { browser, page } = await launchRegressionPage()

  try {
    await openPfmea(page, config)
    const editState = await startPfmeaEdit(page)
    const table = await findPfmeaTable(page)

    const rowsWithAddButton = table
      .locator('tbody tr')
      .filter({ has: table.locator('button[title="Add failure mode row"]') })
    const hasAddableRow = (await rowsWithAddButton.count()) > 0
    const seedRow = hasAddableRow ? rowsWithAddButton.first() : table.locator('tbody tr').first()
    await seedRow.waitFor({ state: 'visible', timeout: 30000 })

    const fmText = `${RUN_ID}_FM_1`
    const fmRow = hasAddableRow
      ? await addFailureMode(table, seedRow, fmText)
      : await materializeFailureMode(table, seedRow, fmText)

    await fillEffectCauseAndActionOnCurrentRow(page, fmRow, {
      effect: `${RUN_ID}_E_1_1`,
      sev: 9,
      cause: `${RUN_ID}_C_1_1_1`,
      occ: 3,
      prev: `${RUN_ID}_P_1_1_1`,
      detText: `${RUN_ID}_D_1_1_1`,
      detVal: 9,
      action: `${RUN_ID}_A_1_1_1_1`,
    })

    await addAction(page, table, fmRow, `${RUN_ID}_A_1_1_1_2`)

    const cause2Row = await addCause(
      page,
      table,
      fmRow,
      `${RUN_ID}_C_1_1_2`,
      9,
      `${RUN_ID}_P_1_1_2`,
      `${RUN_ID}_D_1_1_2`,
      6
    )

    const effect2Row = await addEffect(page, table, fmRow, `${RUN_ID}_E_1_2`, 7)
    await fillCauseAndActionOnCurrentRow(page, effect2Row, {
      cause: `${RUN_ID}_C_1_2_1`,
      occ: 5,
      prev: `${RUN_ID}_P_1_2_1`,
      detText: `${RUN_ID}_D_1_2_1`,
      detVal: 7,
      action: `${RUN_ID}_A_1_2_1_1`,
    })

    await page.waitForTimeout(1000)
    const beforeSaveRows = await collectRunRows(table, RUN_ID)
    const beforeScreenshot = await maybeScreenshot(page, 'before-save')

    await savePfmeaDraft(page, `PFMEA tree save regression ${RUN_ID}`)
    await page.goto(`${config.baseUrl}/pfmea?project=${config.projectId}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    const tableAfter = await findPfmeaTable(page)
    await page.waitForTimeout(1500)
    const afterSaveRows = await collectRunRows(tableAfter, RUN_ID)
    const afterScreenshot = await maybeScreenshot(page, 'after-save')

    const beforeTexts = beforeSaveRows.map((row) => row.text)
    const afterTexts = afterSaveRows.map((row) => row.text)
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
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message, context: error.context ?? null }, null, 2))
  process.exit(1)
})
