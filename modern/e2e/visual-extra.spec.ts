import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('Admin@12345')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 })
  await page.waitForTimeout(500)
}

test.describe('visual regression extras', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('log search desktop baseline', async ({ page }) => {
    await login(page)
    await page.goto(
      '/public/#/control/lens/normal?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
    )
    await expect(page.getByRole('heading', { name: '日志搜索', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '查询', exact: true }).click()
    await expect(page.locator('.log-table').getByText('upstream request timeout', { exact: false }).first()).toBeVisible()
    await expect(page).toHaveScreenshot('log-search-desktop.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('container terminal drawer baseline', async ({ page }) => {
    await login(page)
    await page.goto(
      '/public/#/control/pods/shop-web-00-x7d9f/info?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
    )
    await expect(page.getByRole('heading', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'app', exact: true }).click()
    await page.getByRole('button', { name: '打开终端', exact: true }).click()
    await expect(page.getByText('容器终端', { exact: true }).first()).toBeVisible()
    await expect(page).toHaveScreenshot('terminal-drawer.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })
})
