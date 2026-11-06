import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('Admin@12345')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 })
  await page.waitForTimeout(500)
}

test.describe('visual regression', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('login page desktop baseline', async ({ page }) => {
    await page.goto('/public/#/login')
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
    await expect(page).toHaveScreenshot('login-desktop.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('login page mobile baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/public/#/login')
    await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
    await expect(page).toHaveScreenshot('login-mobile.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('user table desktop baseline', async ({ page }) => {
    await login(page)
    await page.goto('/public/#/platform/user/list')
    await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
    await expect(page.locator('.el-table').first()).toBeVisible()
    await expect(page).toHaveScreenshot('users-desktop.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('create tenant dialog baseline', async ({ page }) => {
    await login(page)
    await page.goto('/public/#/platform/tenant/tenant')
    await expect(page.getByRole('heading', { name: '租户与项目', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '新增租户', exact: true }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveScreenshot('tenant-dialog.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('namespace cards mobile baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await page.goto('/public/#/namespace')
    await expect(page.getByRole('heading', { name: '全部空间', exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot('namespace-mobile.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })
})
