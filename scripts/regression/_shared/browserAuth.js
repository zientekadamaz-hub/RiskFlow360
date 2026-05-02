const { buildTargetUrl } = require('./env')

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isLoginPage(url) {
  return /\/login(?:\?|$)/.test(url)
}

function isHomePage(url, baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  return url === `${normalizedBase}/`
}

function targetReached(url, targetPath) {
  return new RegExp(escapeRegExp(targetPath) + '(?:[?#]|$)').test(url)
}

async function hasLoginForm(page) {
  const emailInput = page.locator('input[name="email"]').first()
  const passwordInput = page.locator('input[name="password"]').first()
  return (await emailInput.count()) > 0 && (await passwordInput.count()) > 0
}

async function hasAuthenticatedShell(page) {
  if (await page.getByRole('button', { name: /^Log out$/i }).count()) return true
  if (await page.getByRole('link', { name: /^Projects$/i }).count()) return true
  return false
}

async function setReactInputValue(page, selector, value) {
  await page.evaluate(
    ({ inputSelector, inputValue }) => {
      const el = document.querySelector(inputSelector)
      if (!(el instanceof HTMLInputElement)) throw new Error(`Missing input ${inputSelector}`)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!setter) throw new Error(`Missing native value setter for ${inputSelector}`)
      setter.call(el, inputValue)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    { inputSelector: selector, inputValue: value }
  )
}

async function ensureLoggedIn(page, { baseUrl, targetPath, email, password }) {
  const targetUrl = buildTargetUrl(baseUrl, targetPath)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  if (targetReached(page.url(), targetPath)) return

  if (isHomePage(page.url(), baseUrl) && (await hasAuthenticatedShell(page))) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    if (targetReached(page.url(), targetPath)) return
  }

  if (!isLoginPage(page.url()) && !(await hasLoginForm(page))) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`User did not reach ${targetPath} and is not on login page. URL=${page.url()}\n\n${bodyText}`)
  }

  const loginUrl = buildTargetUrl(baseUrl, `/login?next=${encodeURIComponent(targetPath)}`)
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  const emailInput = page.locator('input[name="email"]').first()
  const passwordInput = page.locator('input[name="password"]').first()

  if (!(await emailInput.count()) || !(await passwordInput.count())) {
    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

    if (targetReached(page.url(), targetPath)) {
      return
    }
  }

  if (!(await emailInput.count()) || !(await passwordInput.count())) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`Login form did not become available for ${targetPath}. URL=${page.url()}\n\n${bodyText}`)
  }

  await setReactInputValue(page, 'input[name="email"]', email)
  await setReactInputValue(page, 'input[name="password"]', password)

  await page.locator('form').first().getByRole('button', { name: /^Log in$/i }).click()
  await page.waitForURL(new RegExp(escapeRegExp(targetPath)), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  if (!targetReached(page.url(), targetPath)) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`UI login did not reach ${targetPath}. URL=${page.url()}\n\n${bodyText}`)
  }
}

module.exports = {
  ensureLoggedIn,
}
