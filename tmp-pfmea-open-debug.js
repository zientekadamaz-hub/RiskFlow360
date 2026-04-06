const { chromium } = require('C:/Users/zieada/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1720, height: 1200 } })
  await page.goto('http://localhost:3000/pfmea?project=b9887505-30a8-4440-b10d-ee1101480b8c', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  console.log(JSON.stringify({ url: page.url(), body: (await page.locator('body').innerText()).slice(0, 2000) }, null, 2))
  await page.screenshot({ path: 'test-results/pfmea-open-debug.png', fullPage: true }).catch(() => {})
  await browser.close()
}
main().catch((error) => { console.error(error); process.exit(1) })
