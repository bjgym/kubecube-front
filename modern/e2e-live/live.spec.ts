import { mkdir } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'

const userName = process.env.KUBECUBE_LIVE_USER || 'admin'
const password = process.env.KUBECUBE_LIVE_PASSWORD || ''
test.skip(!password, 'Set KUBECUBE_LIVE_PASSWORD to run the live KubeCube suite')

async function screenshot(page: Page, name: string) {
  await mkdir('artifacts/live', { recursive: true })
  await page.screenshot({ path: `artifacts/live/${name}.png`, fullPage: true })
}

async function loginAs(page: Page, name: string, secret: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/public/#/login')
      await page.waitForTimeout(300)
      await page.getByPlaceholder('请输入账号').fill(name)
      await page.getByPlaceholder('请输入密码').fill(secret)
      await page.getByRole('button', { name: /登\s*录/ }).click()
      await expect(page).not.toHaveURL(/#\/login/, { timeout: 45_000 })
      await page.waitForTimeout(1500)
      return
    } catch (error) {
      if (attempt === 2) throw error
      await page.waitForTimeout(1000)
    }
  }
}

async function login(page: Page) {
  await loginAs(page, userName, password)
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
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '副本', exact: true }).click()
  await expect(page.getByText('当前版本', { exact: true }).first()).toBeVisible({ timeout: 90_000 })
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
  await page
    .getByRole('link', { name: /coredns/, exact: true })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /coredns/, exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('镜像', { exact: true }).first()).toBeVisible()
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
    ['/public/#/platform/bootstrap', '快速开始'],
  ]
  for (const [path, heading] of pages) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 90_000 })
  }
  await expect(page.getByText('操作审计', { exact: true })).toHaveCount(0)
  await page.goto('/public/#/platform/AlertmanagerConfig')
  await expect(page.getByRole('heading', { name: '您没有访问此页面的权限', exact: true })).toBeVisible({ timeout: 90_000 })
  await page.goto('/public/#/platform/cluster/pivot-cluster/info')
  await expect(page.getByRole('heading', { name: /pivot-cluster/ })).toBeVisible({ timeout: 90_000 })
  await page.goto('/public/#/platform/cluster/pivot-cluster/node')
  await expect(page.locator('.el-table').first()).toBeVisible({ timeout: 90_000 })
  await page.goto('/public/#/platform/cluster/pivot-cluster/storageclass')
  await expect(page.locator('.el-table').first()).toBeVisible({ timeout: 90_000 })
  await screenshot(page, '07-live-platform-admin')
})

async function ensureLiveUser(page: Page, name: string, secret: string) {
  const created = await page.request.post('/api/v1/cube/user', {
    data: { metadata: { name }, spec: { displayName: name, password: secret } },
  })
  if (created.ok()) return
  const body = await created.text()
  if (!body.includes('exists')) throw new Error(`create ${name} failed: ${created.status()} ${body}`)
  const updated = await page.request.put(`/api/v1/cube/user/${name}`, { data: { spec: { password: secret } } })
  if (!updated.ok()) throw new Error(`reset ${name} failed: ${updated.status()}`)
}

async function ensureLiveBinding(page: Page, user: string, namespace: string, role: string, tenant: string, project?: string) {
  await page.request.delete('/api/v1/cube/authorization/bindings', { params: { name: `${user}-in-${namespace}`, namespace } })
  const labels: Record<string, string> = { 'kubecube.io/rbac': 'true', 'kubecube.io/tenant': tenant }
  if (project) labels['kubecube.io/project'] = project
  const response = await page.request.post('/api/v1/cube/authorization/bindings', {
    data: {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { name: `${user}-in-${namespace}`, namespace, labels, annotations: { 'kubecube.io/sync': 'true' } },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: role },
      subjects: [{ kind: 'User', name: user }],
    },
  })
  expect(response.ok()).toBeTruthy()
}

test('live four-role identities from the backend', async ({ browser, page }) => {
  test.setTimeout(180_000)
  const secret = 'KubeCube@2026'
  const users = ['live-tenant-admin', 'live-project-admin', 'live-normal-user']
  await login(page)
  try {
    for (const user of users) await ensureLiveUser(page, user, secret)
    await ensureLiveBinding(page, users[0]!, 'kubecube-tenant-digital-retail', 'tenant-admin', 'digital-retail')
    await ensureLiveBinding(page, users[1]!, 'kubecube-project-online-business', 'project-admin', 'digital-retail', 'online-business')
    const expected = [
      { platformAdmin: false, tenantAdmin: true, projectAdmin: false },
      { platformAdmin: false, tenantAdmin: false, projectAdmin: true },
      { platformAdmin: false, tenantAdmin: false, projectAdmin: false },
    ]
    const baseURL = process.env.KUBECUBE_LIVE_BASE_URL || 'http://127.0.0.1:4331'
    for (const [index, user] of users.entries()) {
      const context = await browser.newContext({ baseURL })
      try {
        const loginResponse = await context.request.post('/api/v1/cube/login', {
          data: { name: user, password: secret, loginType: 'normal' },
        })
        expect(loginResponse.ok()).toBeTruthy()
        const identities = await context.request.get('/api/v1/cube/authorization/identities')
        expect(identities.ok()).toBeTruthy()
        const body = (await identities.json()) as Record<string, boolean>
        expect({ platformAdmin: body.platformAdmin, tenantAdmin: body.tenantAdmin, projectAdmin: body.projectAdmin }).toEqual(
          expected[index],
        )
      } finally {
        await context.close()
      }
    }
  } finally {
    for (const user of users) {
      await page.request.delete('/api/v1/cube/authorization/bindings', {
        params: { name: `${user}-in-kubecube-tenant-digital-retail`, namespace: 'kubecube-tenant-digital-retail' },
      })
      await page.request.delete('/api/v1/cube/authorization/bindings', {
        params: { name: `${user}-in-kubecube-project-online-business`, namespace: 'kubecube-project-online-business' },
      })
    }
  }
})

test('live four-role menus and direct URL boundaries', async ({ browser, page }) => {
  test.setTimeout(300_000)
  const secret = 'KubeCube@2026'
  const users = ['live-tenant-admin', 'live-project-admin', 'live-normal-user']
  await login(page)
  try {
    for (const user of users) await ensureLiveUser(page, user, secret)
    await ensureLiveBinding(page, users[0]!, 'kubecube-tenant-digital-retail', 'tenant-admin', 'digital-retail')
    await ensureLiveBinding(page, users[1]!, 'kubecube-project-online-business', 'project-admin', 'digital-retail', 'online-business')
    const baseURL = process.env.KUBECUBE_LIVE_BASE_URL || 'http://127.0.0.1:4331'
    const cases = [
      { user: users[0]!, path: '/public/#/platform/tenant/tenant', heading: '租户与项目' },
      { user: users[1]!, path: '/public/#/platform/role/platform', heading: '角色管理' },
      {
        user: users[2]!,
        path: '/public/#/control/deployments/list?cluster=pivot-cluster&namespace=kubecube-system',
        heading: 'Deployments',
      },
    ]
    for (const item of cases) {
      const context = await browser.newContext({ baseURL })
      const rolePage = await context.newPage()
      try {
        await loginAs(rolePage, item.user, secret)
        await rolePage.goto(item.path)
        await expect(rolePage.getByRole('heading', { name: item.heading, exact: true })).toBeVisible({ timeout: 60_000 })
        await rolePage.goto('/public/#/platform/user/list')
        await expect(rolePage.getByRole('heading', { name: '您没有访问此页面的权限', exact: true })).toBeVisible({
          timeout: 30_000,
        })
      } finally {
        await context.close()
      }
    }
  } finally {
    for (const user of users) {
      await page.request.delete('/api/v1/cube/authorization/bindings', {
        params: { name: `${user}-in-kubecube-tenant-digital-retail`, namespace: 'kubecube-tenant-digital-retail' },
      })
      await page.request.delete('/api/v1/cube/authorization/bindings', {
        params: { name: `${user}-in-kubecube-project-online-business`, namespace: 'kubecube-project-online-business' },
      })
    }
  }
})

test('live cluster switch reloads namespaces and keeps the target scope', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  await page.goto('/public/#/control/deployments/list?cluster=pivot-cluster&namespace=kubecube-system')
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible({ timeout: 90_000 })
  await page.locator('.scope-select').filter({ hasText: '集群' }).locator('.el-select').click()
  await page.getByRole('option', { name: /member-arm64-6002/ }).click()
  await expect(page).toHaveURL(/cluster=member-arm64-6002/, { timeout: 60_000 })
  await page.locator('.scope-select').filter({ hasText: '空间' }).locator('.el-select').click()
  await page.getByRole('option', { name: 'kube-system', exact: true }).click()
  await expect(page).toHaveURL(/cluster=member-arm64-6002/, { timeout: 60_000 })
  await expect(page).toHaveURL(/namespace=kube-system/, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible({ timeout: 90_000 })
})

test('live CronJob detail drills from job to pod', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  const base = '/api/v1/cube/proxy/clusters/pivot-cluster/apis/batch/v1/namespaces/default'
  const core = '/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/default'
  const cron = 'live-ui-cron'
  const job = 'live-ui-cron-job'
  const pod = 'live-ui-cron-pod'
  await page.request.delete(`${core}/pods/${pod}`)
  await page.request.delete(`${base}/jobs/${job}`)
  await page.request.delete(`${base}/cronjobs/${cron}`)
  const createdCron = await page.request.post(`${base}/cronjobs`, {
    data: {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: { name: cron, namespace: 'default' },
      spec: {
        schedule: '0 3 * * *',
        suspend: true,
        jobTemplate: {
          spec: { template: { spec: { containers: [{ name: 'job', image: 'busybox:1.36', command: ['true'] }], restartPolicy: 'Never' } } },
        },
      },
    },
  })
  expect(createdCron.ok()).toBeTruthy()
  const cronUid = String(((await createdCron.json()) as Record<string, any>).metadata.uid)
  const createdJob = await page.request.post(`${base}/jobs`, {
    data: {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: job,
        namespace: 'default',
        ownerReferences: [{ apiVersion: 'batch/v1', kind: 'CronJob', name: cron, uid: cronUid }],
      },
      spec: { template: { spec: { containers: [{ name: 'job', image: 'busybox:1.36', command: ['true'] }], restartPolicy: 'Never' } } },
    },
  })
  expect(createdJob.ok()).toBeTruthy()
  const jobUid = String(((await createdJob.json()) as Record<string, any>).metadata.uid)
  const createdPod = await page.request.post(`${core}/pods`, {
    data: {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: pod, namespace: 'default', ownerReferences: [{ apiVersion: 'batch/v1', kind: 'Job', name: job, uid: jobUid }] },
      spec: { containers: [{ name: 'job', image: 'busybox:1.36', command: ['true'] }], restartPolicy: 'Never' },
    },
  })
  expect(createdPod.ok()).toBeTruthy()
  try {
    await page.goto(`/public/#/control/cronjobs/${cron}/info?cluster=pivot-cluster&namespace=default`)
    await expect(page.getByRole('heading', { name: cron, exact: true })).toBeVisible({ timeout: 90_000 })
    await page.getByRole('tab', { name: '任务列表', exact: true }).click()
    await expect(page.getByText(job, { exact: true }).first()).toBeVisible({ timeout: 90_000 })
    await page.locator('tr').filter({ hasText: job }).first().getByRole('button', { name: 'Pods', exact: true }).click()
    await expect(page.getByRole('dialog').getByText(`任务 ${job} 的 Pods`, { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog').getByText(pod, { exact: true }).first()).toBeVisible()
  } finally {
    await page.request.delete(`${core}/pods/${pod}`)
    await page.request.delete(`${base}/jobs/${job}`)
    await page.request.delete(`${base}/cronjobs/${cron}`)
  }
})

test('live PVC detail shows the mounted pod', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  const base = '/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/default'
  const pvc = 'live-ui-pvc'
  const pod = 'live-ui-pvc-pod'
  await page.request.delete(`${base}/pods/${pod}`)
  await page.request.delete(`${base}/persistentvolumeclaims/${pvc}`)
  const createdPvc = await page.request.post(`${base}/persistentvolumeclaims`, {
    data: {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: pvc, namespace: 'default' },
      spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } },
    },
  })
  expect(createdPvc.ok()).toBeTruthy()
  const createdPod = await page.request.post(`${base}/pods`, {
    data: {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: { name: pod, namespace: 'default' },
      spec: {
        containers: [{ name: 'app', image: 'nginx:1.27' }],
        volumes: [{ name: 'data', persistentVolumeClaim: { claimName: pvc } }],
      },
    },
  })
  expect(createdPod.ok()).toBeTruthy()
  try {
    await page.goto(`/public/#/control/persistentvolumeclaims/${pvc}/info?cluster=pivot-cluster&namespace=default`)
    await expect(page.getByRole('heading', { name: pvc, exact: true })).toBeVisible({ timeout: 90_000 })
    await page.getByRole('tab', { name: '挂载 Pod', exact: true }).click()
    await expect(page.getByText(pod, { exact: true }).first()).toBeVisible({ timeout: 90_000 })
  } finally {
    await page.request.delete(`${base}/pods/${pod}`)
    await page.request.delete(`${base}/persistentvolumeclaims/${pvc}`)
  }
})

test('live container terminal connects through WebConsole', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  const pods = await page.request.get('/api/v1/cube/proxy/clusters/pivot-cluster/api/v1/namespaces/kubecube-system/pods?limit=100')
  expect(pods.ok()).toBeTruthy()
  const body = (await pods.json()) as { items?: Array<Record<string, unknown>> }
  const pod = (body.items || []).find((item) => String((item.metadata as Record<string, unknown>)?.name || '').startsWith('audit-')) as
    Record<string, unknown> | undefined
  expect(pod).toBeTruthy()
  const podName = String((pod!.metadata as Record<string, unknown>).name)
  const containerName = String(((pod!.spec as Record<string, unknown>).containers as Array<Record<string, unknown>>)[0]?.name)
  await page.goto(`/public/#/control/pods/${podName}/${podName}/${containerName}?cluster=pivot-cluster&namespace=kubecube-system`)
  await expect(page.getByRole('button', { name: '打开终端', exact: true })).toBeVisible({ timeout: 90_000 })
  await page.getByRole('button', { name: '打开终端', exact: true }).click()
  await expect(page.getByText('已连接', { exact: true })).toBeVisible({ timeout: 90_000 })
  await screenshot(page, '09-live-terminal')
})

test('live concurrent 401 responses redirect once', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await page.context().clearCookies()
  let loginNavigations = 0
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && frame.url().includes('/#/login')) loginNavigations++
  })
  await page.goto('/public/#/namespace')
  await expect(page).toHaveURL(/#\/login/, { timeout: 60_000 })
  await page.waitForTimeout(3000)
  expect(loginNavigations).toBe(1)
})

test('live identity failure can be retried', async ({ page }) => {
  test.setTimeout(120_000)
  let failed = false
  await page.route('**/api/v1/cube/authorization/identities*', async (route) => {
    if (!failed) {
      failed = true
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"temporary"}' })
      return
    }
    await route.continue()
  })
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill(userName)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page.getByText(/身份|失败|错误|temporary/).first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 45_000 })
})

test('live SSO callback failure keeps login usable', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/public/#/login')
  await page.evaluate(() => sessionStorage.setItem('sso', 'missing-provider'))
  await page.goto('/public/#/login?code=invalid-code')
  await expect(page.getByText(/单点登录|登录失败|认证失败|Authenticate failed/).first()).toBeVisible({ timeout: 60_000 })
  await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
})

test('live expired session redirects to login', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)
  await page.context().clearCookies()
  await page.goto('/public/#/control/deployments/list?cluster=pivot-cluster&namespace=kubecube-system')
  await expect(page).toHaveURL(/#\/login/, { timeout: 60_000 })
  await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
})

test('live logout and password reset round trip', async ({ page }) => {
  test.setTimeout(180_000)
  const userName = 'live-normal-user'
  const oldPassword = 'KubeCube@2026'
  const newPassword = 'KubeCube@2026!'
  await login(page)
  await page.getByRole('button', { name: '用户菜单', exact: true }).click()
  await page.getByText('安全退出', { exact: true }).click()
  await expect(page).toHaveURL(/#\/login/, { timeout: 30_000 })
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入账号').fill(userName)
  await dialog.getByPlaceholder('请输入当前密码').fill(oldPassword)
  await dialog.getByPlaceholder('请输入新密码').fill(newPassword)
  await dialog.getByPlaceholder('请再次输入').fill(newPassword)
  await dialog.getByRole('button', { name: '确认重置', exact: true }).click()
  await expect(page.getByText(/密码.*成功|重置成功/).first()).toBeVisible()
  const loginResponse = await page.request.post('/api/v1/cube/login', {
    data: { name: userName, password: newPassword, loginType: 'normal' },
  })
  expect(loginResponse.ok()).toBeTruthy()
  await page.request.post('/api/v1/cube/login', { data: { name: userName, password: password, loginType: 'normal' } })
  await page.request.put(`/api/v1/cube/user/${userName}`, { data: { spec: { password: oldPassword } } })
})

test('live CRD list loads from the cluster', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/crd/Cluster?cluster=pivot-cluster')
  await expect(page.getByRole('heading', { name: '自定义资源', exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.locator('.el-table').first()).toBeVisible({ timeout: 90_000 })
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
