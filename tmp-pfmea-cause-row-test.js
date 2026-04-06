const { chromium } = require('C:/Users/zieada/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'b9887505-30a8-4440-b10d-ee1101480b8c'
const PFMEA_URL = `${BASE_URL}/pfmea?project=${PROJECT_ID}`
const EMAIL = 'zientek.adam.az@gmail.com'
const PASSWORD = 'Riskflow360!'
const RUN_ID = `AUTO_${Date.now()}`

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

async function startEdit(page) {
  if (await page.getByRole('button', { name: /^Discard draft$/i }).count()) {
    await page.waitForTimeout(800)
    return
  }
  const editButton = page.getByRole('button', { name: /edit pfmea|take over pfmea/i }).first()
  if (!(await editButton.count())) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 2000)
    throw new Error(`Edit PFMEA button not found. URL=${page.url()} BODY=${bodyText}`)
  }
  await editButton.click()
  await page.waitForTimeout(1200)
}

async function findTable(page) {
  const table = page.locator('table').last()
  await table.waitFor({ state: 'visible', timeout: 30000 })
  return table
}

async function captureRows(table) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const data = []
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const text = (await row.innerText()).replace(/\s+/g, ' ').trim()
    data.push({ index: i, text, cellCount: await row.locator('td').count() })
  }
  return data
}

async function addInlineRow(page, table, titlePattern, marker) {
  const rows = table.locator('tbody tr')
  const beforeRows = await captureRows(table)
  const rowCount = beforeRows.length

  for (let i = 0; i < rowCount; i += 1) {
    const row = rows.nth(i)
    const addBtn = row.getByRole('button', { name: titlePattern }).first()
    if (!(await addBtn.count())) continue

    await row.hover()
    await page.waitForTimeout(250)
    await addBtn.click({ force: true })
    await page.waitForTimeout(700)

    const rowsAfterInsert = table.locator('tbody tr')
    const afterCount = await rowsAfterInsert.count()
    for (let j = i + 1; j < afterCount; j += 1) {
      const candidate = rowsAfterInsert.nth(j)
      const editor = candidate.locator('textarea.pfmeaEditor, input.pfmeaEditor:not([type="date"])').first()
      if (!(await editor.count())) continue
      await editor.fill(marker)
      await page.waitForTimeout(250)
      await candidate.locator('td.editable').last().click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(900)
      return { ok: true, anchorIndex: i, insertedIndex: j, marker, beforeCount: beforeRows.length, afterCount }
    }
    const afterRows = await captureRows(table)
    return {
      ok: false,
      reason: `Inserted row for ${titlePattern} not found after clicking add button.`,
      anchorIndex: i,
      marker,
      beforeCount: beforeRows.length,
      afterCount: afterRows.length,
      rowDelta: afterRows.length - beforeRows.length,
      nearbyRows: afterRows.slice(Math.max(0, i - 1), Math.min(afterRows.length, i + 4)),
    }
  }

  return { ok: false, reason: `No row with add button ${titlePattern} found.`, marker, beforeCount: beforeRows.length, afterCount: beforeRows.length, rowDelta: 0 }
}

async function saveDraft(page) {
  await page.getByRole('button', { name: /^Save$/i }).first().click()
  await page.waitForTimeout(400)

  await page.getByText('Save PFMEA').waitFor({ state: 'visible', timeout: 10000 })
  const modal = page.locator('div').filter({ has: page.getByText('Save PFMEA', { exact: true }) }).last()
  const descField = modal.locator('textarea').first()
  await descField.fill(`Automated PFMEA layout repro ${RUN_ID}`)
  await page.waitForTimeout(200)

  const modalSave = modal.getByRole('button', { name: /^Save$/i }).first()
  await modalSave.click({ force: true })
  await page.waitForTimeout(2500)
  return {
    modalStillVisible: await page.getByText('Save PFMEA').count(),
    saveBusyVisible: await page.getByText(/Saving\.\.\./i).count(),
    bodySnippet: (await page.locator('body').innerText()).slice(0, 1500),
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1200 } })

  try {
    await ensureLoggedIn(page)
    await startEdit(page)

    const table = await findTable(page)
    const before = await captureRows(table)

    const actions = []
    actions.push(await addInlineRow(page, table, /Add failure mode row/i, `${RUN_ID}_FM`))
    actions.push(await addInlineRow(page, table, /Add effect row/i, `${RUN_ID}_EFF`))
    actions.push(await addInlineRow(page, table, /Add cause row/i, `${RUN_ID}_CAUSE`))

    const afterAdds = await captureRows(table)
    const screenshotPath = `test-results/pfmea-layout-${RUN_ID}.png`
    await page.screenshot({ path: screenshotPath, fullPage: true })

    const saveResult = await saveDraft(page).catch((error) => ({
      error: error.message,
      bodySnippet: '',
      modalStillVisible: -1,
      saveBusyVisible: -1,
    }))
    const afterSave = await captureRows(table)

    const markers = actions.map((x) => x.marker).filter(Boolean)
    const markerPresence = Object.fromEntries(
      markers.map((marker) => [
        marker,
        {
          afterAdds: afterAdds.some((row) => row.text.includes(marker)),
          afterSave: afterSave.some((row) => row.text.includes(marker)),
        },
      ])
    )

    console.log(
      JSON.stringify(
        {
          url: page.url(),
          beforeCount: before.length,
          afterAddsCount: afterAdds.length,
          afterSaveCount: afterSave.length,
          actions,
          markerPresence,
          rowDeltaAdds: afterAdds.length - before.length,
          rowDeltaSave: afterSave.length - afterAdds.length,
          sampleAfterAdds: afterAdds.slice(0, 12),
          sampleAfterSave: afterSave.slice(0, 12),
          screenshotPath,
          saveResult,
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
