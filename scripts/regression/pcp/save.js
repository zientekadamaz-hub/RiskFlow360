const { createClient } = require('@supabase/supabase-js')
const { ensureLoggedIn } = require('../_shared/browserAuth')
const { getBaseUrl, getRequiredEnv, loadLocalEnv } = require('../_shared/env')
const { getPlaywright } = require('../_shared/playwright')

function getRegressionConfig() {
  loadLocalEnv()
  return {
    baseUrl: getBaseUrl(),
    email: getRequiredEnv('REGRESSION_EMAIL'),
    password: getRequiredEnv('REGRESSION_PASSWORD'),
    projectId: process.env.PCP_REGRESSION_PROJECT_ID?.trim() || getRequiredEnv('PFMEA_REGRESSION_PROJECT_ID'),
    supabaseUrl: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  }
}

function pcpCell(row, index) {
  return row.locator('td').nth(index)
}

async function waitForStableRowCount(page, table, timeoutMs = 10000, stableMs = 500) {
  const deadline = Date.now() + timeoutMs
  let lastCount = -1
  let stableSince = 0

  while (Date.now() < deadline) {
    const count = await table.locator('tbody tr').count()
    if (count > 0 && count === lastCount) {
      if (!stableSince) stableSince = Date.now()
      if (Date.now() - stableSince >= stableMs) return count
    } else {
      stableSince = 0
      lastCount = count
    }
    await page.waitForTimeout(150)
  }

  throw new Error('PCP table did not stabilize in time.')
}

async function discardExistingDraftIfNeeded(page) {
  const discardButton = page.getByRole('button', { name: /^Discard draft$/i }).first()
  if (!(await discardButton.count())) return
  await discardButton.waitFor({ state: 'visible', timeout: 10000 })
  await discardButton.click()
  await page.waitForTimeout(1200)
}

async function startFreshPcpDraft(page) {
  await discardExistingDraftIfNeeded(page)

  const takeoverButton = page.getByRole('button', { name: /take over pcp/i }).first()
  if (await takeoverButton.count()) {
    throw new Error('PCP is locked by another user. Refusing to take over during regression.')
  }

  const editButton = page.getByRole('button', { name: /^Edit PCP$/i }).first()
  await editButton.waitFor({ state: 'visible', timeout: 30000 })
  await editButton.click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /^Save PCP$/i }).first().waitFor({ state: 'visible', timeout: 10000 })
}

async function updateTextCell(page, table, rowIndex, cellIndex, value) {
  await waitForStableRowCount(page, table)
  const row = table.locator('tbody tr').nth(rowIndex)
  const cell = pcpCell(row, cellIndex)
  await cell.waitFor({ state: 'visible', timeout: 10000 })
  await cell.scrollIntoViewIfNeeded()
  await cell.click({ force: true })

  const editor = cell.locator('.pfmeaEditor').first()
  await editor.waitFor({ state: 'visible', timeout: 10000 })
  await editor.fill(value)

  await page.mouse.click(24, 24)
  await editor.waitFor({ state: 'detached', timeout: 10000 }).catch(async () => {
    await editor.blur()
    await editor.waitFor({ state: 'detached', timeout: 10000 })
  })

  await cell.getByText(value, { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
}

async function savePcp(page, description) {
  const launchSaveButton = page.getByRole('button', { name: /^Save PCP$/i }).first()
  await launchSaveButton.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.some((button) => button.textContent?.trim() === 'Save PCP' && !button.hasAttribute('disabled'))
    },
    null,
    { timeout: 10000 }
  )
  await launchSaveButton.click()

  const modalTitle = page.getByText('Save PCP').last()
  await modalTitle.waitFor({ state: 'visible', timeout: 10000 })

  const textarea = page.locator('textarea').last()
  await textarea.waitFor({ state: 'visible', timeout: 10000 })
  await textarea.fill(description)

  const modal = modalTitle.locator('xpath=ancestor::div[1]')
  await modal.getByRole('button', { name: /^Save$/i }).first().click({ force: true })
  await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {})
  await page.getByRole('button', { name: /^Edit PCP$/i }).first().waitFor({ state: 'visible', timeout: 30000 })
}

async function getOpenPcpRows(config, controlMethodMarker, sampleSizeMarker) {
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

  const openRevisionId = (projectRes.data?.current_open_revision_id ?? '').trim()
  if (!openRevisionId) {
    return {
      openRevisionId: null,
      openRevisionLabel: projectRes.data?.open_revision_label ?? null,
      rows: [],
    }
  }

  const rowsRes = await supabase
    .from('control_plan_rows')
    .select('id,control_method,sample_size')
    .eq('revision_id', openRevisionId)
    .eq('control_method', controlMethodMarker)
    .eq('sample_size', sampleSizeMarker)

  if (rowsRes.error) throw rowsRes.error

  return {
    openRevisionId,
    openRevisionLabel: projectRes.data?.open_revision_label ?? null,
    rows: rowsRes.data ?? [],
  }
}

async function main() {
  const config = getRegressionConfig()
  const { chromium } = getPlaywright()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1300 } })
  const runToken = `PCPSAVE_${Date.now()}`
  const controlMethodMarker = `${runToken}_CTRL`
  const sampleSizeMarker = `${runToken}_SAMPLE`
  let step = 'boot'

  try {
    step = 'login'
    await ensureLoggedIn(page, {
      baseUrl: config.baseUrl,
      targetPath: `/pcp?project=${config.projectId}`,
      email: config.email,
      password: config.password,
    })

    step = 'open-table'
    const table = page.locator('table').first()
    await table.waitFor({ state: 'visible', timeout: 30000 })

    step = 'start-draft'
    await startFreshPcpDraft(page)
    await waitForStableRowCount(page, table)

    step = 'pick-row'
    await table.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })

    step = 'edit-control-method'
    await updateTextCell(page, table, 0, 11, controlMethodMarker)

    step = 'edit-sample-size'
    await updateTextCell(page, table, 0, 12, sampleSizeMarker)

    step = 'save'
    await savePcp(page, `${runToken} save verification`)

    step = 'reload'
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await table.waitFor({ state: 'visible', timeout: 30000 })

    step = 'verify-ui'
    const markerRow = table.locator('tbody tr').filter({ hasText: controlMethodMarker }).first()
    await markerRow.waitFor({ state: 'visible', timeout: 10000 })
    await markerRow.filter({ hasText: sampleSizeMarker }).first().waitFor({ state: 'visible', timeout: 10000 })

    step = 'verify-db'
    const dbState = await getOpenPcpRows(config, controlMethodMarker, sampleSizeMarker)
    if ((dbState.rows?.length ?? 0) === 0) {
      throw new Error(`Saved PCP values were not found in open revision ${dbState.openRevisionLabel ?? dbState.openRevisionId ?? 'unknown'}.`)
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectId: config.projectId,
          openRevisionId: dbState.openRevisionId,
          openRevisionLabel: dbState.openRevisionLabel,
          savedRowCount: dbState.rows.length,
          controlMethodMarker,
          sampleSizeMarker,
        },
        null,
        2
      )
    )
  } catch (error) {
    await page.screenshot({ path: 'pcp-save-regression-failure.png', fullPage: true }).catch(() => {})
    console.error(
      JSON.stringify(
        {
          ok: false,
          step,
          message: error.message,
          screenshot: 'pcp-save-regression-failure.png',
          url: page.url(),
        },
        null,
        2
      )
    )
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, step: 'fatal', message: error.message }, null, 2))
  process.exit(1)
})
