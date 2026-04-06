const fs = require('fs')
const path = require('path')
const {
  addFailureMode,
  collectRunRows,
  findPfmeaTable,
  getPfmeaConfig,
  launchRegressionPage,
  materializeFailureMode,
  openPfmea,
  savePfmeaDraft,
  startPfmeaEdit,
} = require('./helpers')

const RUN_ID = `FMORD_${Date.now()}`

function ensure(condition, message, context = {}) {
  if (!condition) {
    const error = new Error(message)
    error.context = context
    throw error
  }
}

function indexOfMarker(rows, marker) {
  return rows.findIndex((row) => row.text.includes(marker))
}

async function maybeScreenshot(page, label) {
  const dir = path.join(process.cwd(), 'test-results')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const screenshotPath = path.join(dir, `${RUN_ID}-${label}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  return screenshotPath
}

async function main() {
  const config = getPfmeaConfig()
  const { browser, page } = await launchRegressionPage()

  try {
    await openPfmea(page, config)
    const editState = await startPfmeaEdit(page)
    const table = await findPfmeaTable(page)

    const fm1Text = `${RUN_ID}_FM_1`
    const fm2Text = `${RUN_ID}_FM_2`
    const fm3Text = `${RUN_ID}_FM_3`
    const fm2bText = `${RUN_ID}_FM_2B`
    const fm1bText = `${RUN_ID}_FM_1B`
    const fm2cText = `${RUN_ID}_FM_2C`
    const fm3bText = `${RUN_ID}_FM_3B`
    const fm1cText = `${RUN_ID}_FM_1C`

    const rowsWithAddButton = table
      .locator('tbody tr')
      .filter({ has: table.locator('button[title="Add failure mode row"]') })
    const hasAddableRow = (await rowsWithAddButton.count()) > 0
    const seedRow = hasAddableRow ? rowsWithAddButton.first() : table.locator('tbody tr').first()
    await seedRow.waitFor({ state: 'visible', timeout: 30000 })

    const fm1 = hasAddableRow
      ? await addFailureMode(table, seedRow, fm1Text)
      : await materializeFailureMode(table, seedRow, fm1Text)
    const fm2 = await addFailureMode(table, fm1, fm2Text)
    const fm3 = await addFailureMode(table, fm2, fm3Text)

    await addFailureMode(table, table.locator('tbody tr').filter({ hasText: fm2Text }).first(), fm2bText)
    await addFailureMode(table, table.locator('tbody tr').filter({ hasText: fm1Text }).first(), fm1bText)
    await addFailureMode(table, table.locator('tbody tr').filter({ hasText: fm2Text }).first(), fm2cText)
    await addFailureMode(table, table.locator('tbody tr').filter({ hasText: fm3Text }).first(), fm3bText)
    await addFailureMode(table, table.locator('tbody tr').filter({ hasText: fm1bText }).first(), fm1cText)

    const finalRows = await collectRunRows(table, RUN_ID)
    const orderScreenshot = await maybeScreenshot(page, 'final-order')

    ensure(indexOfMarker(finalRows, fm2bText) < indexOfMarker(finalRows, fm3Text), 'FM_2B should appear before FM_3', { finalRows })
    ensure(indexOfMarker(finalRows, fm1bText) < indexOfMarker(finalRows, fm2Text), 'FM_1B should appear before FM_2', { finalRows })
    ensure(
      indexOfMarker(finalRows, fm2Text) < indexOfMarker(finalRows, fm2cText) &&
        indexOfMarker(finalRows, fm2cText) < indexOfMarker(finalRows, fm2bText),
      'FM_2C should appear between FM_2 and FM_2B',
      { finalRows }
    )
    ensure(indexOfMarker(finalRows, fm3Text) < indexOfMarker(finalRows, fm3bText), 'FM_3B should appear after FM_3', { finalRows })
    ensure(
      indexOfMarker(finalRows, fm1bText) < indexOfMarker(finalRows, fm1cText) &&
        indexOfMarker(finalRows, fm1cText) < indexOfMarker(finalRows, fm2Text),
      'FM_1C should appear between FM_1B and FM_2',
      { finalRows }
    )

    await savePfmeaDraft(page, `PFMEA failure mode order regression ${RUN_ID}`)
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    const tableAfterSave = await findPfmeaTable(page)
    const afterSaveRows = await collectRunRows(tableAfterSave, RUN_ID)
    const saveScreenshot = await maybeScreenshot(page, 'after-save')

    const beforeTexts = finalRows.map((row) => row.text)
    const afterTexts = afterSaveRows.map((row) => row.text)
    ensure(
      JSON.stringify(beforeTexts) === JSON.stringify(afterTexts),
      'Failure mode row order changed after save',
      { beforeTexts, afterTexts }
    )

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId: RUN_ID,
          editState,
          orderScreenshot,
          saveScreenshot,
          finalRows,
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
