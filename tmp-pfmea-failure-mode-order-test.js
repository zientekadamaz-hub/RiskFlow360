const { chromium } = require('C:/Users/zieada/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const { createClient } = require('@supabase/supabase-js')
const { createBrowserClient } = require('@supabase/ssr')
const { serialize } = require('cookie')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:3000'
const PROJECT_ID = 'c6e6c193-3904-4410-b5d5-785765a9cf02'
const PFMEA_URL = `${BASE_URL}/pfmea?project=${PROJECT_ID}`
const EMAIL = 'zientek.adam.az@gmail.com'
const PASSWORD = 'Riskflow360!'
const RUN_ID = `FMORD_${Date.now()}`

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || /^\s*#/.test(line) || !line.includes('=')) continue
    const idx = line.indexOf('=')
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!key || process.env[key]) continue
    process.env[key] = value
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars.')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function getProjectName() {
  const supabase = getSupabase()
  const authRes = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authRes.error) throw authRes.error
  const projectRes = await supabase.from('projects').select('name').eq('id', PROJECT_ID).single()
  if (projectRes.error) throw projectRes.error
  return projectRes.data?.name ?? '(unknown project)'
}

async function cleanupOldRunRows() {
  const supabase = getSupabase()
  const authRes = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authRes.error) throw authRes.error

  const opsRes = await supabase.from('operations').select('id').eq('project_id', PROJECT_ID)
  if (opsRes.error) throw opsRes.error
  const operationIds = (opsRes.data ?? []).map((row) => row.id).filter(Boolean)
  if (operationIds.length === 0) return 0

  const rowsRes = await supabase
    .from('pfmea_rows')
    .select('id,failure_mode')
    .in('operation_id', operationIds)
    .like('failure_mode', 'FMORD_%')
  if (rowsRes.error) throw rowsRes.error

  const rowIds = (rowsRes.data ?? []).map((row) => row.id).filter(Boolean)
  if (rowIds.length === 0) return 0

  const deleteRes = await supabase.from('pfmea_rows').delete().in('id', rowIds).select('id')
  if (deleteRes.error) throw deleteRes.error
  return (deleteRes.data ?? []).length
}

async function getAuthCookies() {
  const cookies = []
  const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookies
      },
      setAll(nextCookies) {
        cookies.length = 0
        for (const cookie of nextCookies) cookies.push(cookie)
      },
    },
  })

  const authRes = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authRes.error) throw authRes.error
  if (cookies.length === 0) throw new Error('Supabase sign-in returned no session cookies.')
  return cookies
}

async function ensureLoggedIn(page) {
  await page.goto(PFMEA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  if (!/\/login(?:\?|$)|^http:\/\/localhost:3000\/$/.test(page.url())) return

  await page.goto(`${BASE_URL}/login?next=${encodeURIComponent(`/pfmea?project=${PROJECT_ID}`)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  await page.evaluate(
    ({ email, password }) => {
      const setReactInputValue = (selector, value) => {
        const el = document.querySelector(selector)
        if (!(el instanceof HTMLInputElement)) throw new Error(`Missing input ${selector}`)
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        if (!setter) throw new Error(`Missing native value setter for ${selector}`)
        setter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }

      setReactInputValue('input[name="email"]', email)
      setReactInputValue('input[name="password"]', password)
    },
    { email: EMAIL, password: PASSWORD }
  )

  await page.locator('form').first().getByRole('button', { name: /^Log in$/i }).click()
  await page.waitForURL(new RegExp(`/pfmea\\?project=${PROJECT_ID.replace(/-/g, '\\-')}`), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  if (/\/login(?:\?|$)|^http:\/\/localhost:3000\/$/.test(page.url())) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`UI login did not reach PFMEA. URL=${page.url()}\n\n${bodyText}`)
  }
}

async function startEdit(page) {
  const discardButton = page.getByRole('button', { name: /^Discard draft$/i })
  if (await discardButton.count()) {
    await page.waitForTimeout(1000)
    return { mode: 'existing_draft' }
  }

  const takeoverButton = page.getByRole('button', { name: /take over pfmea/i }).first()
  if (await takeoverButton.count()) {
    throw new Error('PFMEA is locked by another user. Refusing to take over during test.')
  }

  const editButton = page.getByRole('button', { name: /edit pfmea/i }).first()
  if (!(await editButton.count())) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`Could not find PFMEA edit button. URL=${page.url()}\n\n${bodyText}`)
  }
  await editButton.waitFor({ state: 'visible', timeout: 30000 })
  await editButton.click()
  await page.waitForTimeout(1200)
  return { mode: 'new_draft' }
}

async function findTable(page) {
  const table = page.locator('table').last()
  await table.waitFor({ state: 'visible', timeout: 30000 })
  return table
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

async function fillActiveEditor(page, value) {
  const editor = page.locator('.pfmeaEditor').last()
  await editor.waitFor({ state: 'visible', timeout: 10000 })
  await editor.fill(value)
  await editor.evaluate((el) => el.blur())
  await page.waitForTimeout(250)
}

async function addFailureMode(row, fmText) {
  await clickAddOnRow(row, /Add failure mode row/i)
  await fillActiveEditor(row.page(), fmText)
  const table = row.locator('xpath=ancestor::table[1]')
  const created = table.locator('tbody tr').filter({ hasText: fmText }).first()
  await created.waitFor({ state: 'visible', timeout: 10000 })
  return created
}

async function materializeFailureMode(row, fmText) {
  await hoverRow(row)
  const editableCell = row.locator('td.editable').first()
  await editableCell.waitFor({ state: 'visible', timeout: 10000 })
  await editableCell.click({ force: true })
  await fillActiveEditor(row.page(), fmText)
  const table = row.locator('xpath=ancestor::table[1]')
  const created = table.locator('tbody tr').filter({ hasText: fmText }).first()
  await created.waitFor({ state: 'visible', timeout: 10000 })
  return created
}

async function collectRunRows(table) {
  const rows = table.locator('tbody tr')
  const count = await rows.count()
  const collected = []
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i)
    const text = (await row.innerText()).replace(/\s+/g, ' ').trim()
    if (!text.includes(RUN_ID)) continue
    collected.push({ index: i, text })
  }
  return collected
}

async function snapshot(page, table, label, results) {
  const order = await collectRunRows(table)
  const screenshotPath = `test-results/${RUN_ID}-${label}.png`
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  results.push({ label, order, screenshotPath })
}

async function main() {
  loadLocalEnv()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1300 } })

  try {
    const projectName = await getProjectName()
    const deletedOldRows = await cleanupOldRunRows()
    await ensureLoggedIn(page)
    const editState = await startEdit(page)
    const table = await findTable(page)

    const results = []

    const fm1Text = `${RUN_ID}_FM_1`
    const fm2Text = `${RUN_ID}_FM_2`
    const fm3Text = `${RUN_ID}_FM_3`
    const fm2bText = `${RUN_ID}_FM_2B`
    const fm1bText = `${RUN_ID}_FM_1B`
    const fm2cText = `${RUN_ID}_FM_2C`
    const fm3bText = `${RUN_ID}_FM_3B`
    const fm1cText = `${RUN_ID}_FM_1C`

    const rowsWithAddButton = table.locator('tbody tr').filter({ has: table.locator('button[title="Add failure mode row"]') })
    const hasAddableRow = (await rowsWithAddButton.count()) > 0
    const seedRow = hasAddableRow ? rowsWithAddButton.first() : table.locator('tbody tr').first()
    await seedRow.waitFor({ state: 'visible', timeout: 30000 })

    const fm1 = hasAddableRow ? await addFailureMode(seedRow, fm1Text) : await materializeFailureMode(seedRow, fm1Text)
    await snapshot(page, table, 'step-1-after-fm1', results)

    const fm2 = await addFailureMode(fm1, fm2Text)
    await snapshot(page, table, 'step-2-after-fm2', results)

    const fm3 = await addFailureMode(fm2, fm3Text)
    await snapshot(page, table, 'step-3-after-fm3', results)

    const fm2Again = table.locator('tbody tr').filter({ hasText: fm2Text }).first()
    await addFailureMode(fm2Again, fm2bText)
    await snapshot(page, table, 'step-4-click-fm2-again', results)

    const fm1Again = table.locator('tbody tr').filter({ hasText: fm1Text }).first()
    await addFailureMode(fm1Again, fm1bText)
    await snapshot(page, table, 'step-5-click-fm1-again', results)

    const fm2AgainAfterInsert = table.locator('tbody tr').filter({ hasText: fm2Text }).first()
    await addFailureMode(fm2AgainAfterInsert, fm2cText)
    await snapshot(page, table, 'step-6-click-fm2-third-time', results)

    const fm3Again = table.locator('tbody tr').filter({ hasText: fm3Text }).first()
    await addFailureMode(fm3Again, fm3bText)
    await snapshot(page, table, 'step-7-click-fm3-again', results)

    const fm1BAgain = table.locator('tbody tr').filter({ hasText: fm1bText }).first()
    await addFailureMode(fm1BAgain, fm1cText)
    await snapshot(page, table, 'step-8-click-fm1b-again', results)

    console.log(
      JSON.stringify(
        {
          projectId: PROJECT_ID,
          projectName,
          expectedProjectName: 'EPC2000',
          runId: RUN_ID,
          deletedOldRows,
          editState,
          finalUrl: page.url(),
          steps: results,
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
