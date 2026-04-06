const {
  addFailureMode,
  findPfmeaTable,
  getPfmeaConfig,
  launchRegressionPage,
  materializeFailureMode,
  openPfmea,
  startPfmeaEdit,
} = require('./helpers')

async function main() {
  const config = getPfmeaConfig()
  const { browser, page } = await launchRegressionPage()

  try {
    await openPfmea(page, config)
    await startPfmeaEdit(page)
    const table = await findPfmeaTable(page)

    const rowsWithAddButton = table
      .locator('tbody tr')
      .filter({ has: table.locator('button[title="Add failure mode row"]') })
    const hasAddableRow = (await rowsWithAddButton.count()) > 0
    const seedRow = hasAddableRow ? rowsWithAddButton.first() : table.locator('tbody tr').first()
    const runId = `DBG_${Date.now()}`

    const row = hasAddableRow
      ? await addFailureMode(table, seedRow, `${runId}_FM_1`)
      : await materializeFailureMode(table, seedRow, `${runId}_FM_1`)

    const cells = await row.locator('td').evaluateAll((nodes) =>
      nodes.map((td, i) => ({
        i,
        cls: td.className,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim(),
      }))
    )

    const editable = await row.locator('td.editable').evaluateAll((nodes) =>
      nodes.map((td, i) => ({
        i,
        cls: td.className,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim(),
      }))
    )

    const scales = await row.locator('td.scaleSelectCell').evaluateAll((nodes) =>
      nodes.map((td, i) => ({
        i,
        cls: td.className,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim(),
      }))
    )

    const firstScale = row.locator('td.scaleSelectCell').first()
    await firstScale.click({ force: true })
    await page.waitForTimeout(700)

    const popups = await page.locator('[data-pfmea-popup="true"]').evaluateAll((nodes) =>
      nodes.map((node, i) => ({
        i,
        text: (node.innerText || '').replace(/\s+/g, ' ').trim(),
      }))
    )

    console.log(
      JSON.stringify(
        {
          runId,
          cells,
          editable,
          scales,
          popups,
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
  console.error(error)
  process.exit(1)
})
