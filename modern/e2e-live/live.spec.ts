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
      await page.waitForTimeout(800)
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

test('live pod log cursor loads a real backend page', async ({ page }) => {
  await login(page)
  const response = await page.request.get(
    '/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/kubecube-system/pods?labelSelector=kubecube.io%2Fapp%3Daudit',
  )
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { items?: Array<{ metadata?: { name?: string } }> }
  const podName = body.items?.[0]?.metadata?.name
  expect(podName).toBeTruthy()
  await page.goto(`/public/#/control/pods/${podName}/log?cluster=pivot-cluster&namespace=kubecube-system`)
  await expect(page.getByRole('heading', { name: podName!, exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.log-viewer pre')).not.toHaveText('', { timeout: 90_000 })
  const older = page.getByRole('button', { name: '加载更早', exact: true })
  if (await older.isEnabled()) {
    await older.click()
    await expect(page.locator('.log-viewer__header')).toContainText('已加载', { timeout: 90_000 })
  }
  await screenshot(page, '06-live-pod-log')
})

test('live platform administration pages load real data', async ({ page }) => {
  await login(page)
  const pages = [
    ['/public/#/platform/user/list', '用户管理'],
    ['/public/#/platform/role/platform', '角色管理'],
    ['/public/#/platform/tenant/tenant', '租户与项目'],
    ['/public/#/platform/quota', '租户配额'],
    ['/public/#/platform/nsquota', '空间管理'],
    ['/public/#/platform/cluster/list', '集群管理'],
  ]
  for (const [path, heading] of pages) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 90_000 })
  }
  await screenshot(page, '07-live-platform-admin')
})

test('live ConfigMap create and delete round trip', async ({ page }) => {
  await login(page)
  const name = 'live-console-check'
  const apiPath = `/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/kubecube-system/configmaps/${name}`
  await page.request.delete(apiPath)
  await page.goto('/public/#/control/configmaps/create?cluster=pivot-cluster&namespace=kubecube-system')
  await expect(page.getByRole('heading', { name: '创建 ConfigMap', exact: true })).toBeVisible({ timeout: 90_000 })
  await page.getByPlaceholder('例如：order-service').fill(name)
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByPlaceholder('键 / 文件名').fill('console-check')
  await page.getByPlaceholder('值或文件内容').fill('created-by-live-test')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '确认创建', exact: true }).first().click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '管理资源', exact: true }).click()
  await page.getByRole('menuitem', { name: '删除资源', exact: true }).click()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  await expect(page).toHaveURL(/control\/configmaps\/list/, { timeout: 90_000 })
})

test('live Service keeps its workload selector while editing a port', async ({ page }) => {
  await login(page)
  const servicePath = '/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/kubecube-system/services'
  const name = 'live-audit-svc'
  await page.request.delete(`${servicePath}/${name}`)
  await page.goto('/public/#/control/services/create?cluster=pivot-cluster&namespace=kubecube-system')
  await expect(page.getByRole('heading', { name: '创建 Service', exact: true })).toBeVisible({ timeout: 90_000 })
  await page.getByPlaceholder('例如：order-service').fill(name)
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  const workloadSelect = page.locator('.el-form-item').filter({ hasText: '目标工作负载' }).locator('.el-select')
  await workloadSelect.click()
  await page.getByRole('option', { name: 'Deployment / audit', exact: true }).click()
  const portRow = page.locator('.service-port-row').first()
  await portRow.locator('input').nth(2).fill('8888')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '确认创建', exact: true }).first().click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole('heading', { name: '服务关联', exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Endpoints', { exact: true })).toBeVisible()
  await expect(page.getByText('关联 Pods', { exact: false })).toBeVisible()

  const created = await page.request.get(`${servicePath}/${name}`)
  expect(created.ok()).toBeTruthy()
  expect((await created.json()).spec.selector).toEqual({ 'kubecube.io/app': 'audit' })

  await page.getByRole('button', { name: '管理资源', exact: true }).click()
  await page.getByRole('menuitem', { name: '设置资源', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置 Service', exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByPlaceholder('例如：order-service')).toHaveValue(name, { timeout: 90_000 })
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.locator('.service-port-row').first().locator('input').nth(2).fill('8889')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '保存并应用', exact: true }).first().click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 120_000 })

  const updated = await page.request.get(`${servicePath}/${name}`)
  expect(updated.ok()).toBeTruthy()
  const updatedBody = await updated.json()
  expect(updatedBody.spec.selector).toEqual({ 'kubecube.io/app': 'audit' })
  expect(updatedBody.spec.ports?.[0]?.targetPort).toBe(8889)

  let endpointCount = 0
  for (let attempt = 0; attempt < 10 && endpointCount === 0; attempt++) {
    const endpoints = await page.request.get(
      '/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/kubecube-system/endpoints/live-audit-svc',
    )
    if (endpoints.ok()) endpointCount = ((await endpoints.json()).subsets || []).length
    if (!endpointCount) await page.waitForTimeout(1000)
  }
  expect(endpointCount).toBeGreaterThan(0)
  await page.request.delete(`${servicePath}/${name}`)
})
