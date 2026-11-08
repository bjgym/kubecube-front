import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.error('Browser pageerror:', error.message))
})

async function screenshot(page: Page, name: string) {
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true })
}

async function login(page: Page) {
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('Admin@12345')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 })
}

test('login and cross-cluster workspace overview', async ({ page }) => {
  await page.goto('/public/#/login')
  await expect(page.getByRole('heading', { name: '登录您的账户' })).toBeVisible()
  await screenshot(page, '01-login')
  await login(page)
  await page.goto('/public/#/namespace')
  await expect(page.getByRole('heading', { name: '全部空间', exact: true })).toBeVisible()
  await expect(page.getByText('online-shop').first()).toBeVisible()
  await screenshot(page, '02-namespace')
})

test('workspace, resource console and platform areas stay reachable from the sidebar', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/namespace')
  await expect(page.getByRole('heading', { name: '全部空间', exact: true })).toBeVisible()
  const areas = page.locator('.app-sidebar__areas')
  await expect(areas.locator('.el-menu-item.is-active')).toHaveText('工作空间')
  await expect(page.locator('.app-header__area > span')).toHaveText('工作空间')

  await areas.getByText('资源控制台', { exact: true }).click()
  await expect(page).toHaveURL(/#\/control\/dashboard/)
  await expect(areas.locator('.el-menu-item.is-active')).toHaveText('资源控制台')
  await expect(page.locator('.app-header__area > span')).toHaveText('资源控制台')
  await expect(page.locator('.app-sidebar').getByText('资源监控', { exact: true })).toBeVisible()

  await areas.getByText('工作空间', { exact: true }).click()
  await expect(page).toHaveURL(/#\/namespace/)
  await areas.getByText('运维管理', { exact: true }).click()
  await expect(page).toHaveURL(/#\/platform\/user\/list/)
  await expect(areas.locator('.el-menu-item.is-active')).toHaveText('运维管理')
  await expect(page.locator('.app-header__right').getByRole('button', { name: /工作空间|运维管理/ })).toHaveCount(0)

  await areas.getByText('资源控制台', { exact: true }).click()
  await expect(page).toHaveURL(/#\/control\/dashboard/)
  await expect(page.locator('.app-header__area > span')).toHaveText('资源控制台')
})

test('login ignores an external redirect target', async ({ page }) => {
  await page.goto('/public/#/login?redirect=//evil.example.com/steal')
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('Admin@12345')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 })
  await expect(page).not.toHaveURL(/evil\.example\.com/)
})

test('SSO callback failure keeps the login page usable', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sso', 'mock')
    localStorage.setItem('kubecube-mock-oauth', 'fail')
  })
  await page.goto('/public/#/login?code=invalid-ticket')
  await expect(page.getByText(/单点登录|票据无效/).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByPlaceholder('请输入账号')).toBeVisible()
})

test('identity initialization failure can be retried', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kubecube-mock-identity', 'fail'))
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('Admin@12345')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page.getByText(/身份初始化|暂时失败/).first()).toBeVisible({ timeout: 20_000 })
  await page.evaluate(() => localStorage.removeItem('kubecube-mock-identity'))
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 20_000 })
})

test('password reset validates the current password and sets a new one', async ({ page }) => {
  await page.goto('/public/#/login')
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入账号').fill('admin')
  await dialog.getByPlaceholder('请输入当前密码').fill('Admin@12345')
  await dialog.getByPlaceholder('请输入新密码').fill('Admin@12345!')
  await dialog.getByPlaceholder('请再次输入').fill('Admin@12345!')
  await dialog.getByRole('button', { name: '确认重置', exact: true }).click()
  await expect(page.getByText(/密码.*成功|重置成功/).first()).toBeVisible()
})

test('a 401 response clears the session and returns to login', async ({ page }) => {
  await login(page)
  await page.evaluate(() => localStorage.setItem('kubecube-mock-401', '1'))
  await page.goto(
    '/public/#/control/deployments/list?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page).toHaveURL(/#\/login/, { timeout: 20_000 })
})

test('stream mode pauses and resumes automatic refresh', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/lens/stream?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '实时日志流', exact: true })).toBeVisible()
  await expect(page.getByText('自动刷新已开启', { exact: true })).toBeVisible()
  await page.locator('.el-switch').first().click()
  await expect(page.getByText('自动刷新已暂停', { exact: true })).toBeVisible()
})

test('deployment list, detail and YAML editor', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/deployments/list')
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'shop-web', exact: true })).toBeVisible()
  await screenshot(page, '03-deployments')
  await page.getByRole('link', { name: 'shop-web', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'shop-web', exact: true })).toBeVisible()
  await expect(page.getByText('基本信息', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'YAML', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.monaco-editor').first()).toBeVisible()
  await screenshot(page, '04-yaml-detail')
})

test('YAML composer opens without losing workspace context', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/deployments/list?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible()
  await page.getByText('YAML 编排', { exact: true }).first().click()
  await expect(page.getByRole('dialog')).toContainText('production-shanghai')
  await expect(page.getByRole('dialog')).toContainText('online-shop')
  await expect(page.getByRole('button', { name: '预检测', exact: true })).toBeEnabled()
})

test('mobile login and workspace have no document-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/public/#/login')
  await expect(page.getByRole('heading', { name: '登录您的账户' })).toBeVisible()
  await screenshot(page, '05-mobile-login')
  await login(page)
  await page.goto('/public/#/namespace')
  await expect(page.getByRole('heading', { name: '全部空间', exact: true })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await screenshot(page, '06-mobile-namespace')
})

test('mobile sidebar exposes console areas and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.goto('/public/#/namespace')
  await page.getByRole('button', { name: '打开导航', exact: true }).click()
  const sidebar = page.locator('.app-sidebar')
  await expect(sidebar).toBeVisible()
  await expect(sidebar.locator('.app-sidebar__areas').getByText('资源控制台', { exact: true })).toBeVisible()
  await sidebar.locator('.app-sidebar__areas').getByText('资源控制台', { exact: true }).click()
  await expect(page).toHaveURL(/#\/control\/dashboard/)
  await expect(sidebar).not.toBeVisible()
})

test('platform administration pages render real mock-backed data', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible()
  await expect(page.getByText('zhang.wei').first()).toBeVisible()
  await page.goto('/public/#/platform/cluster/list')
  await expect(page.getByRole('heading', { name: '集群管理', exact: true })).toBeVisible()
  await expect(page.getByText('production-shanghai').first()).toBeVisible()
  await screenshot(page, '07-platform-clusters')
  await page.goto('/public/#/platform/role/platform')
  await expect(page.getByRole('heading', { name: '角色管理', exact: true })).toBeVisible()
  await expect(page.getByText('平台管理员').first()).toBeVisible()
  await page.goto('/public/#/platform/audit')
  await expect(page.getByRole('heading', { name: '操作审计', exact: true })).toBeVisible()
  await expect(page.getByText('shop-web').first()).toBeVisible()
})

test('dashboard CR variables and panel types are rendered', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/dashboard')
  await expect(page.getByRole('heading', { name: /资源监控$/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: '核心指标', exact: true })).toBeVisible()
  await expect(page.getByText('CPU 使用趋势', { exact: true }).first()).toBeVisible()
  await expect(page.locator('.dashboard-variable').first()).toBeVisible()
  await expect(page.locator('.dashboard-panel .chart-element').first()).toBeVisible()
  await page.getByRole('button', { name: '维度选择', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('CPU 使用', { exact: true }).first().click()
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'CPU 使用', exact: true, level: 3 })).toHaveCount(0)
  await page.getByRole('button', { name: '维度选择', exact: true }).click()
  await page.getByRole('dialog').getByText('CPU 使用', { exact: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click()
  await screenshot(page, '08-dashboard-cr')
})

test('YAML composer imports an existing resource', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/control/deployments/list')
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible()
  await page.getByText('YAML 编排', { exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '从已有资源导入', exact: true }).click()
  const importDialog = page.getByRole('dialog', { name: '从已有资源导入' })
  await expect(importDialog).toBeVisible()
  await importDialog.locator('.import-select').first().click()
  await page.getByRole('option', { name: 'ConfigMaps', exact: true }).click()
  await importDialog.locator('.import-select').nth(1).click()
  await page.getByRole('option', { name: 'shop-web-config', exact: true }).click()
  await importDialog.getByRole('button', { name: '导入到编辑器', exact: true }).click()
  await expect(importDialog).not.toBeVisible()
  await expect(page.locator('.composer-dialog .monaco-editor .view-lines')).toContainText('shop-web-config')
})

test('log search filters by log task against the Logseer endpoint', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/lens/normal?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '日志搜索', exact: true })).toBeVisible()
  await page.locator('.filter-field').filter({ hasText: '日志任务' }).locator('.el-select').click()
  await page.getByRole('option', { name: 'shop-stdout', exact: true }).click()
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.locator('.log-table').getByText('upstream request timeout', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeEnabled()
  await page.locator('.histogram-column').first().click()
  await expect(page.getByText(/自定义时段/)).toBeVisible()
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await page.getByPlaceholder('例如：订单服务错误日志').fill('错误日志')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('.saved-queries').getByText('错误日志', { exact: true })).toBeVisible()
})

test('LogConfig wizard edits matchFields and multiple inputs', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/logconfigs/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 LogConfig', exact: true })).toBeVisible()
  await page.getByPlaceholder('例如：order-service').fill('multi-input-log')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '添加匹配字段', exact: true }).click()
  await page.getByPlaceholder('匹配字段名，例如 app').fill('app')
  await page.getByPlaceholder('匹配值，多个值用逗号分隔').fill('shop-web,shop-api')
  await page.getByRole('button', { name: '添加输入源', exact: true }).click()
  await page.getByPlaceholder('输入名称').fill('sidecar-logs')
  await page.getByPlaceholder('路径，逗号分隔').fill('/var/log/sidecar/*.log')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
})

test('pod log tab renders the backend log object and honors the selected container', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/pods/shop-web-00-x7d9f/log?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
  await expect(page.locator('.log-viewer pre')).toContainText('container=app')
  await page.locator('.log-selectors .el-select').nth(1).click()
  await page.getByRole('option', { name: 'sidecar', exact: true }).click()
  await expect(page.locator('.log-viewer__header')).toContainText('容器 sidecar')
  await expect(page.locator('.log-viewer pre')).toContainText('container=sidecar')
  await expect(page.locator('.log-viewer pre')).not.toContainText('[object Object]')
  await page.getByRole('button', { name: '加载更早', exact: true }).click()
  await expect(page.locator('.log-viewer__header')).toContainText('已加载 200 行')
})

test('entering a namespace card from another cluster updates the workspace context', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/namespace')
  const card = page.locator('.namespace-card').filter({ hasText: 'shop-staging' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: '进入控制台', exact: true }).click()
  await expect(page).toHaveURL(/cluster=staging-hangzhou/)
  await expect(page).toHaveURL(/namespace=shop-staging/)
  await expect(page.locator('.scope-select--cluster .el-select__placeholder')).toContainText('预发集群 · 杭州')
  await expect(page.locator('.scope-select').filter({ hasText: '空间' }).locator('.el-select__placeholder')).toContainText('shop-staging')
})

test('tenant administrators only receive tenant-scoped platform navigation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kubecube-mock-role', 'tenant'))
  await login(page)
  await page.locator('.app-sidebar__areas').getByText('运维管理', { exact: true }).click()
  await expect(page).toHaveURL(/platform\/tenant\/tenant/)
  await expect(page.getByRole('heading', { name: '租户与项目', exact: true })).toBeVisible()
  await expect(page.getByText('用户管理', { exact: true })).toHaveCount(0)
  await expect(page.getByText('租户配额', { exact: true })).toHaveCount(0)
  await expect(page.getByText('操作审计', { exact: true })).toHaveCount(0)
  await expect(page.getByText('全局告警规则', { exact: true })).toHaveCount(0)
  await expect(page.getByText('角色管理', { exact: true })).toBeVisible()
  await expect(page.getByText('空间管理', { exact: true })).toHaveCount(1)
})

test('project administrators are denied platform-only routes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kubecube-mock-role', 'project'))
  await login(page)
  await page.goto('/public/#/platform/user/list')
  await expect(page.getByRole('heading', { name: '您没有访问此页面的权限', exact: true })).toBeVisible()
})

test('normal users keep control access and cannot open platform pages directly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kubecube-mock-role', 'user'))
  await login(page)
  await page.goto('/public/#/platform/user/list')
  await expect(page.getByRole('heading', { name: '您没有访问此页面的权限', exact: true })).toBeVisible()
  await page.goto('/public/#/control/deployments/list')
  await expect(page.getByRole('heading', { name: 'Deployments', exact: true })).toBeVisible()
  await expect(page.locator('.app-sidebar__areas').getByText('资源控制台', { exact: true })).toBeVisible()
  await expect(page.locator('.app-sidebar__areas').getByText('运维管理', { exact: true })).toHaveCount(0)
})

test('ConfigMap wizard edits structured keys', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/configmaps/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 ConfigMap', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByPlaceholder('键 / 文件名').fill('app.properties')
  await page.getByPlaceholder('值或文件内容').fill('feature=true')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
})

test('PVC wizard loads real StorageClass options', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/persistentvolumeclaims/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 PVC', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  const storageClass = page.locator('.el-form-item').filter({ hasText: '存储类别' }).locator('.el-select')
  await storageClass.click()
  await page.getByRole('option', { name: 'local-path', exact: true }).click()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
})

test('global alert rule supports a normal condition builder', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/PrometheusRule/production-shanghai/create')
  await expect(page.getByRole('heading', { name: '创建全局告警规则', exact: true })).toBeVisible()
  await page.getByPlaceholder('例如：platform-availability').fill('platform-availability')
  await page.getByPlaceholder('例如：availability').fill('availability')
  await page.getByPlaceholder('例如：HighErrorRate').fill('HighErrorRate')
  await page.getByPlaceholder('留空表示全部对象').fill('shop-web')
  await page.getByPlaceholder('指标 record，例如：container_cpu_usage').fill('container_cpu_usage')
  await page.getByPlaceholder('阈值，例如：0.8').fill('0.8')
  await expect(page.getByText('生成表达式：(container_cpu_usage{target=~"shop-web"}) > 0.8')).toBeVisible()
  await page.getByText('表达式模式', { exact: true }).click()
  await expect(page.getByPlaceholder('请输入 PromQL 表达式')).toBeVisible()
  await page.getByText('普通模式', { exact: true }).click()
  await expect(page.getByPlaceholder('指标 record，例如：container_cpu_usage')).toHaveValue('container_cpu_usage')
})

test('workload wizard builds env volumes mounts and init containers', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/deployments/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 Deployment', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByText('容器端口', { exact: true })).toBeVisible()
  await expect(page.getByText('健康探针', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '添加变量', exact: true }).click()
  await page.getByPlaceholder('变量名，例如 DATABASE_URL').fill('DATABASE_URL')
  await page.getByPlaceholder('变量值').fill('postgres://shop-db:5432/shop')

  await page.getByRole('button', { name: '添加存储卷', exact: true }).click()
  await page.getByPlaceholder('卷名称，例如 data').fill('data')

  await page.getByRole('button', { name: '添加挂载', exact: true }).click()
  await page.locator('.mount-row .el-select').click()
  await page.getByRole('option', { name: 'data', exact: true }).click()
  await page.getByPlaceholder('挂载路径，例如 /data').fill('/data')

  await page.getByRole('button', { name: '添加 Init 容器', exact: true }).click()
  await page.locator('input[placeholder="nginx:1.27"]').last().fill('busybox:1.36')

  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await expect(page.locator('.monaco-editor .view-lines').last()).toContainText('kind: Deployment')
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await page.getByRole('tab', { name: 'app', exact: true }).click()
  await expect(page.getByPlaceholder('变量名，例如 DATABASE_URL')).toHaveValue('DATABASE_URL')
  await expect(page.getByPlaceholder('挂载路径，例如 /data')).toHaveValue('/data')
  await expect(page.getByRole('tab', { name: /Init/ })).toHaveCount(1)
})

test('CronJob jobs can drill into their pods', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/cronjobs/order-report/jobs?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '任务列表', exact: true })).toBeVisible()
  const row = page.locator('tr').filter({ hasText: 'order-report-nightly' }).first()
  await row.getByRole('button', { name: 'Pods', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('任务 order-report-nightly 的 Pods', { exact: true })).toBeVisible()
})

test('Pod list row actions open events and expose eviction', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/pods/list?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  const row = page.locator('tr').filter({ hasText: 'shop-web-00-x7d9f' }).first()
  await expect(page.getByRole('columnheader', { name: 'CPU', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '内存', exact: true })).toBeVisible()
  await row.getByRole('button', { name: '更多操作', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: '驱逐 Pod', exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: '查看事件', exact: true }).click()
  await expect(page.getByRole('heading', { name: '资源事件', exact: true })).toBeVisible()
})

test('Pod detail can evict a pod through the management menu', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/pods/shop-web-00-x7d9f/info?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '管理资源', exact: true }).click()
  await page.getByRole('menuitem', { name: '驱逐 Pod', exact: true }).click()
  await page.getByRole('button', { name: '确认驱逐', exact: true }).click()
  await expect(page).toHaveURL(/control\/pods\/list/)
})

test('Service detail shows selector endpoints and matching pods', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/services/shop-web/info?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: 'shop-web', exact: true })).toBeVisible()
  await expect(page.getByText('app=shop-web', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('10.244.2.11', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
})

test('Service wizard keeps multiple ports and advanced fields', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/services/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 Service', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  const workloadSelect = page.locator('.el-form-item').filter({ hasText: '目标工作负载' }).locator('.el-select')
  await workloadSelect.click()
  await page.getByRole('option', { name: /Deployment \/ shop-web/ }).click()
  await expect(page.getByPlaceholder('标签键，例如 app')).toHaveValue('app')
  await page.getByRole('button', { name: '添加端口', exact: true }).click()
  await expect(page.locator('.service-port-row')).toHaveCount(2)
  await page.getByPlaceholder('203.0.113.10, 203.0.113.11').fill('203.0.113.10, 203.0.113.11')
  await expect(page.getByPlaceholder('标签键，例如 app')).toHaveValue('app')
  await expect(page.getByPlaceholder('标签值，例如 shop-web')).toHaveValue('shop-web')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.locator('.service-port-row')).toHaveCount(2)
  await expect(page.getByPlaceholder('203.0.113.10, 203.0.113.11')).toHaveValue('203.0.113.10, 203.0.113.11')
})

test('Ingress wizard supports multiple hosts paths and TLS', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/ingresses/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 Ingress', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '添加域名', exact: true }).click()
  await expect(page.locator('.ingress-rule-card')).toHaveCount(2)
  await page.locator('.ingress-rule-card').first().getByRole('button', { name: '添加路径', exact: true }).click()
  await expect(page.locator('.ingress-rule-card').first().locator('.ingress-path-row')).toHaveCount(2)
  await page.getByRole('button', { name: '添加 TLS', exact: true }).click()
  await page.getByPlaceholder('TLS Secret 名称').fill('shop-tls')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.locator('.ingress-rule-card')).toHaveCount(2)
  await expect(page.getByPlaceholder('TLS Secret 名称')).toHaveValue('shop-tls')
})

test('Secret wizard edits TLS certificate and key structurally', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/secrets/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 Secret', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.locator('.form-section .el-select').first().click()
  await page.getByRole('option', { name: 'TLS 证书', exact: true }).click()
  await page.getByPlaceholder('-----BEGIN CERTIFICATE-----').fill('CERTIFICATE-CONTENT')
  await page.getByPlaceholder('-----BEGIN PRIVATE KEY-----').fill('PRIVATE-KEY-CONTENT')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.getByPlaceholder('-----BEGIN CERTIFICATE-----')).toHaveValue('CERTIFICATE-CONTENT')
  await expect(page.getByPlaceholder('-----BEGIN PRIVATE KEY-----')).toHaveValue('PRIVATE-KEY-CONTENT')
})

test('NetworkPolicy wizard builds ingress peers and ports', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/cluster/production-shanghai/network/create?namespace=online-shop')
  await expect(page.getByRole('heading', { name: '创建 NetworkPolicy', exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('目标命名空间')).toHaveValue('online-shop')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '添加 Ingress 规则', exact: true }).click()
  await page.getByRole('button', { name: '添加来源', exact: true }).click()
  await page.getByPlaceholder('标签键').fill('role')
  await page.getByPlaceholder('标签值').fill('frontend')
  await page.getByRole('button', { name: '添加端口', exact: true }).click()
  await page.getByPlaceholder('端口或端口名').fill('443')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.getByPlaceholder('标签键')).toHaveValue('role')
  await expect(page.getByPlaceholder('端口或端口名')).toHaveValue('443')
})

test('StatefulSet wizard keeps volume claim templates and affinity rules', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/statefulsets/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 StatefulSet', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '添加声明模板', exact: true }).click()
  await page.getByPlaceholder('模板名称，例如 data').fill('data')
  await page.getByPlaceholder('容量，例如 10Gi').fill('20Gi')
  const affinity = page.locator('.settings-section').filter({ hasText: '节点亲和性' })
  await affinity.getByRole('button', { name: '添加规则', exact: true }).click()
  await affinity.getByPlaceholder('标签键，例如 topology.kubernetes.io/zone').fill('topology.kubernetes.io/zone')
  await affinity.getByPlaceholder('值，多个用空格分隔').fill('east west')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.getByPlaceholder('模板名称，例如 data')).toHaveValue('data')
  await expect(affinity.getByPlaceholder('值，多个用空格分隔')).toHaveValue('east west')
})

test('AlertmanagerConfig wizard builds WeCom and Webhook receivers', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/AlertmanagerConfig/create?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '创建 AlertmanagerConfig', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '添加渠道', exact: true }).click()
  await page.getByPlaceholder('企业微信用户 ID').fill('ops-oncall')
  await page.getByRole('button', { name: '添加渠道', exact: true }).click()
  const webhook = page.locator('.alert-channel-card').nth(1)
  await webhook.locator('.el-select').first().click()
  await page.getByRole('option', { name: 'Webhook', exact: true }).click()
  await webhook.getByPlaceholder('https://hooks.example.com/alert').fill('https://hooks.example.com/alert')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await expect(page.getByRole('heading', { name: '确认资源声明', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '上一步', exact: true }).click()
  await expect(page.getByPlaceholder('企业微信用户 ID')).toHaveValue('ops-oncall')
  await expect(webhook.getByPlaceholder('https://hooks.example.com/alert')).toHaveValue('https://hooks.example.com/alert')
})

test('Global alert config supports structured receiver editing', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/AlertmanagerConfig')
  await expect(page.getByRole('heading', { name: '告警路由配置', exact: true })).toBeVisible()
  await expect(page.getByText('platform-default', { exact: true }).first()).toBeVisible()
  await page.getByPlaceholder('新接收人名称').fill('secondary-oncall')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.locator('.receiver-list').getByText('secondary-oncall', { exact: true })).toBeVisible()
  await page.getByPlaceholder('smtp.example.com:465').fill('smtp.example.com:465')
  await page.getByPlaceholder('alert@example.com').fill('alert@example.com')
  await page.getByPlaceholder('https://qyapi.weixin.qq.com/cgi-bin/').fill('https://qyapi.weixin.qq.com/cgi-bin/')
  await page.getByRole('button', { name: '保存配置', exact: true }).first().click()
  await expect(page.locator('.receiver-list').getByText('secondary-oncall', { exact: true })).toBeVisible()
  await page.getByText('YAML', { exact: true }).click()
  await expect(page.getByLabel('Alertmanager YAML 配置')).toHaveValue(/smtp_smarthost: smtp\.example\.com:465/)
  await expect(page.getByLabel('Alertmanager YAML 配置')).toHaveValue(/wecom_api_url: https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\//)
})

test('tenant creation can assign an administrator account', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/tenant/tenant')
  await page.getByRole('button', { name: '新增租户', exact: true }).first().click()
  await expect(page.getByText('管理员账号（可选）', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('combobox').last()).toBeVisible()
})

test('Quick start exposes inline member assignment', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/bootstrap')
  await page.getByRole('button', { name: /添加成员/ }).click()
  await expect(page.getByText('账号', { exact: true })).toBeVisible()
  await expect(page.getByText('角色', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '立即添加成员', exact: true })).toBeVisible()
})

test('Quick start exposes inline tenant quota editor', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/bootstrap')
  await page.getByRole('button', { name: /配置配额/ }).click()
  await expect(page.getByText('CPU Request（Cores）', { exact: true })).toBeVisible()
  await expect(page.getByText('内存 Request（GiB）', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存租户配额', exact: true })).toBeVisible()
})

test('Namespace management shows quota used and hard limits', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/nsquota')
  await expect(page.getByRole('columnheader', { name: '配额（已用 / 上限）', exact: true })).toBeVisible()
  await expect(page.getByText('3.5 / 8 Cores')).toBeVisible()
  await expect(page.getByText('7 / 16 GiB')).toBeVisible()
})

test('Quota editor shows allocated and cluster capacity hints', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/quota')
  await page
    .getByRole('button', { name: /配置配额|调整配额/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('集群总量', { exact: false }).first()).toBeVisible()
  await expect(dialog.getByText('已分配', { exact: false }).first()).toBeVisible()
})

test('Node detail shows role, instance type and GPU facts', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/cluster/production-shanghai/worker-1/info')
  await expect(page.getByRole('heading', { name: '节点属性', exact: true })).toBeVisible()
  await expect(page.getByText('gpu.a10', { exact: true })).toBeVisible()
  await expect(page.getByText('GPU', { exact: true })).toBeVisible()
  await expect(page.getByText('节点角色', { exact: true })).toBeVisible()
})

test('Audit page toggles time sort direction', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/audit')
  await expect(page.getByText('时间按倒序排列', { exact: false })).toBeVisible()
  await page.getByRole('columnheader', { name: /时间/ }).click()
  await page.getByRole('columnheader', { name: /时间/ }).click()
  await expect(page.getByText('时间按升序排列', { exact: false })).toBeVisible()
})

test('platform role page lists direct RoleBinding subjects', async ({ page }) => {
  await login(page)
  await page.goto('/public/#/platform/role/platform')
  await expect(page.getByRole('heading', { name: '绑定主体', exact: true })).toBeVisible()
  await expect(page.getByText('platform-admin-binding', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('admin', { exact: true })).toBeVisible()
  await expect(page.getByText('metrics-reader', { exact: true })).toBeVisible()
})

test('Deployment detail separates current and historical replica pods', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/deployments/shop-web/pod?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('link', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'shop-web-06-x7d9f', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '管理资源', exact: true }).click()
  await page.getByText('调整副本数', { exact: true }).click()
  const scaleDialog = page.getByRole('dialog')
  await expect(scaleDialog.getByRole('heading', { name: '调整副本数', exact: true })).toBeVisible()
  await expect(scaleDialog.getByRole('spinbutton')).toHaveValue('6')
  await scaleDialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('.detail-content .inline-filters .el-select__placeholder').first().click()
  await page.getByRole('option', { name: '历史版本', exact: true }).click()
  await expect(page.getByRole('link', { name: 'shop-web-06-x7d9f', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'shop-web-00-x7d9f', exact: true })).toHaveCount(0)
})

test('Pod detail opens the container terminal drawer', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/pods/shop-web-00-x7d9f/info?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'app', exact: true }).click()
  await expect(page.getByRole('button', { name: '打开终端', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '打开终端', exact: true }).click()
  await expect(page.getByText('容器终端', { exact: true }).first()).toBeVisible()
})

test('Pod detail exposes containers and PVC detail lists mounted pods', async ({ page }) => {
  await login(page)
  await page.goto(
    '/public/#/control/pods/shop-web-00-x7d9f/info?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '资源概览', exact: true })).toBeVisible()
  await expect(page.getByText('Pod IP', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'sidecar', exact: true }).click()
  await expect(page.getByRole('heading', { name: '挂载卷', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '健康探针', exact: true })).toBeVisible()

  await page.goto(
    '/public/#/control/persistentvolumeclaims/postgresql-data/pod?tenant=digital-retail&project=online-business&cluster=production-shanghai&namespace=online-shop',
  )
  await expect(page.getByRole('heading', { name: '挂载 Pod', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'shop-web-00-x7d9f', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'order-service-01-x7d9f', exact: true })).toBeVisible()
})
