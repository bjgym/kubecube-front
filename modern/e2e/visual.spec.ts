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

  test('user table fits at 1280 without document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page)
    await page.goto('/public/#/platform/user/list')
    await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
    await expect(page.locator('.el-table').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page).toHaveScreenshot('users-1280.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('user table keeps row actions reachable at 768', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await login(page)
    await page.goto('/public/#/platform/user/list')
    await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '编辑信息' }).first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await expect(page).toHaveScreenshot('users-768.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('user table keeps all secondary columns at 1920', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await login(page)
    await page.goto('/public/#/platform/user/list')
    await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '上次登录 IP' })).toBeVisible()
    await expect(page).toHaveScreenshot('users-1920.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })

  test('mobile workspace drawer exposes all four scope levels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await page.goto('/public/#/namespace')
    await page.getByRole('button', { name: '切换工作空间' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('租户', { exact: true })).toBeVisible()
    await expect(drawer.getByText('项目', { exact: true })).toBeVisible()
    await expect(drawer.getByText('集群', { exact: true })).toBeVisible()
    await expect(drawer.getByText('空间', { exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot('scope-drawer-mobile.png', { animations: 'disabled', maxDiffPixelRatio: 0.01 })
  })
})
