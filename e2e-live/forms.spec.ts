import { expect, test, type Page } from '@playwright/test'

const userName = process.env.KUBECUBE_LIVE_USER || 'admin'
const password = process.env.KUBECUBE_LIVE_PASSWORD || ''
test.skip(!password, 'Set KUBECUBE_LIVE_PASSWORD to run the live KubeCube suite')

const scope = 'tenant=digital-retail&project=online-business&cluster=pivot-cluster&namespace=default'

async function login(page: Page) {
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill(userName)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 45_000 })
  await page.waitForTimeout(1500)
}

test('live structured create forms render against the real backend', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  const forms = [
    { path: 'deployments/create', heading: '创建 Deployment' },
    { path: 'ingresses/create', heading: '创建 Ingress' },
    { path: 'secrets/create', heading: '创建 Secret' },
    { path: 'persistentvolumeclaims/create', heading: '创建 PVC' },
  ]
  for (const form of forms) {
    await page.goto(`/public/#/control/${form.path}?${scope}`)
    await expect(page.getByRole('heading', { name: form.heading, exact: true })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole('textbox').first()).toBeVisible()
  }
  await page.goto('/public/#/platform/cluster/pivot-cluster/network/create?namespace=default')
  await expect(page.getByRole('heading', { name: '创建 NetworkPolicy', exact: true })).toBeVisible({ timeout: 90_000 })
})
