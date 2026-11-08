import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('pageerror', (error) => console.log('PAGEERROR:', error.stack))
page.on('console', (message) => console.log('CONSOLE:', message.type(), message.text()))
page.on('requestfailed', (request) => console.log('REQUESTFAILED:', request.url(), request.failure()?.errorText))
const response = await page.goto(process.argv[2] || 'http://127.0.0.1:4330/public/#/login')
console.log('STATUS:', response?.status(), 'URL:', page.url())
await page.waitForTimeout(5000)
console.log('LOGIN_VISIBLE:', await page.getByRole('heading', { name: '登录您的账户' }).isVisible())
console.log('APP_NODES:', await page.locator('#app > *').count())
await browser.close()
