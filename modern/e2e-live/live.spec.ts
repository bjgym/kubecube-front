import { mkdir } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'

const userName = process.env.KUBECUBE_LIVE_USER || 'admin'
const password = process.env.KUBECUBE_LIVE_PASSWORD || ''
test.skip(!password, 'Set KUBECUBE_LIVE_PASSWORD to run the live KubeCube suite')

async function screenshot(page: Page, name: string) {
  await mkdir('artifacts/live', { recursive: true })
  await page.screenshot({ path: `artifacts/live/${name}.png`, fullPage: true })
}

async function login(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/public/#/login')
    await page.getByPlaceholder('请输入账号').fill(userName)
    await page.getByPlaceholder('请输入密码').fill(password)
    await page.getByRole('button', { name: /登\s*录/ }).click()
    try {
      await expect(page).not.toHaveURL(/#\/login/, { timeout: 45_000 })
      return
    } catch (error) {
      if (attempt === 1) throw error
    }
  }
}

test('live login and cross-cluster namespace overview', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/namespace')
  await expect(page.getByRole('heading', { name: '全部空间', exact: true })).toBeVisible()
  await expect(page.getByText('pivot-cluster', { exact: false }).first()).toBeVisible()
  await expect(page.locator('.namespace-card').filter({ hasText: 'member-arm64-6002' }).first()).toBeVisible()
  const card = page.locator('.namespace-card').filter({ hasText: 'kubecube-system' }).filter({ hasText: 'pivot-cluster' }).first()
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: '进入控制台', exact: true }).click()
  await expect(page).toHaveURL(/cluster=pivot-cluster/)
  await expect(page).toHaveURL(/namespace=kubecube-system/)
  await screenshot(page, '01-live-namespace')
})

test('live deployment list, detail and YAML editor', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/deployments/list?cluster=pivot-cluster&namespace=kubecube-system')
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'audit', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'kubecube', exact: true })).toBeVisible()
  await screenshot(page, '02-live-deployments')
  await page.getByRole('link', { name: 'audit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'audit', exact: true })).toBeVisible()
  await expect(page.getByText('基本信息', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'YAML', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.monaco-editor').first()).toBeVisible()
  await screenshot(page, '03-live-yaml')
})

test('live member-cluster pod list and detail', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/pods/list?cluster=member-arm64-6002&namespace=kube-system')
  await expect(page.getByRole('heading', { name: 'Pods', exact: true })).toBeVisible({ timeout: 90_000 })
  const pod = page.getByRole('link', { name: /coredns-6554b8b87f-/ }).first()
  await expect(pod).toBeVisible()
  await screenshot(page, '04-live-member-pods')
  await pod.click()
  await expect(page.getByRole('heading', { name: /coredns-6554b8b87f-/ })).toBeVisible()
  await expect(page.getByText('容器', { exact: true }).first()).toBeVisible()
  await screenshot(page, '05-live-pod-detail')
})
