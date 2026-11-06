import { expect, test } from '@playwright/test'

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
})
