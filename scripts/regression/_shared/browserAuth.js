const { buildTargetUrl } = require('./env')

function isAuthRedirect(url, baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  return /\/login(?:\?|$)/.test(url) || url === `${normalizedBase}/`
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
  if (!isAuthRedirect(page.url(), baseUrl)) return

  const loginUrl = buildTargetUrl(baseUrl, `/login?next=${encodeURIComponent(targetPath)}`)
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  await setReactInputValue(page, 'input[name="email"]', email)
  await setReactInputValue(page, 'input[name="password"]', password)

  await page.locator('form').first().getByRole('button', { name: /^Log in$/i }).click()
  await page.waitForURL(new RegExp(targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  if (isAuthRedirect(page.url(), baseUrl)) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 3000)
    throw new Error(`UI login did not reach ${targetPath}. URL=${page.url()}\n\n${bodyText}`)
  }
}

module.exports = {
  ensureLoggedIn,
}
