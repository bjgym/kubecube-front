import { expect, test, type Page } from '@playwright/test'

const userName = process.env.KUBECUBE_LIVE_USER || 'admin'
const password = process.env.KUBECUBE_LIVE_PASSWORD || ''
test.skip(!password, 'Set KUBECUBE_LIVE_PASSWORD to run the live KubeCube suite')

async function login(page: Page) {
  await page.goto('/public/#/login')
  await page.getByPlaceholder('请输入账号').fill(userName)
  await page.getByPlaceholder('请输入密码').fill(password)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).not.toHaveURL(/#\/login/, { timeout: 45_000 })
  await page.waitForTimeout(1500)
}

const cluster = 'pivot-cluster'
const namespace = 'default'
const collection = (group: string, version: string, plural: string, ns = namespace) =>
  `/api/v1/cube/proxy/clusters/${cluster}${group ? `/apis/${group}/${version}` : `/api/${version}`}/namespaces/${ns}/${plural}`

function deployment(name: string) {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: name } },
      template: { metadata: { labels: { app: name } }, spec: { containers: [{ name: 'web', image: 'nginx:1.27' }] } },
    },
  }
}

function workload(kind: 'StatefulSet' | 'DaemonSet', name: string) {
  return {
    apiVersion: 'apps/v1',
    kind,
    metadata: { name, namespace },
    spec: {
      ...(kind === 'StatefulSet' ? { serviceName: name, replicas: 1 } : {}),
      selector: { matchLabels: { app: name } },
      template: { metadata: { labels: { app: name } }, spec: { containers: [{ name: 'web', image: 'nginx:1.27' }] } },
    },
  }
}

function job(name: string) {
  return {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { name, namespace },
    spec: {
      template: {
        metadata: { labels: { app: name } },
        spec: { restartPolicy: 'Never', containers: [{ name: 'job', image: 'busybox:1.36', command: ['true'] }] },
      },
    },
  }
}

function cronJob(name: string) {
  return {
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: { name, namespace },
    spec: {
      schedule: '0 3 * * *',
      jobTemplate: {
        spec: {
          template: {
            metadata: { labels: { app: name } },
            spec: { restartPolicy: 'Never', containers: [{ name: 'job', image: 'busybox:1.36', command: ['true'] }] },
          },
        },
      },
    },
  }
}

const resources: Array<{ name: string; path: string; body: unknown }> = [
  { name: 'live-api-deploy', path: collection('apps', 'v1', 'deployments'), body: deployment('live-api-deploy') },
  { name: 'live-api-sts', path: collection('apps', 'v1', 'statefulsets'), body: workload('StatefulSet', 'live-api-sts') },
  { name: 'live-api-ds', path: collection('apps', 'v1', 'daemonsets'), body: workload('DaemonSet', 'live-api-ds') },
  { name: 'live-api-job', path: collection('batch', 'v1', 'jobs'), body: job('live-api-job') },
  { name: 'live-api-cron', path: collection('batch', 'v1', 'cronjobs'), body: cronJob('live-api-cron') },
  {
    name: 'live-api-svc',
    path: collection('', 'v1', 'services'),
    body: {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'live-api-svc', namespace },
      spec: { selector: { app: 'live-api-deploy' }, ports: [{ port: 80, targetPort: 80 }] },
    },
  },
  {
    name: 'live-api-ing',
    path: collection('networking.k8s.io', 'v1', 'ingresses'),
    body: {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: 'live-api-ing', namespace },
      spec: {
        rules: [
          {
            host: 'live-api.example.com',
            http: { paths: [{ path: '/', pathType: 'Prefix', backend: { service: { name: 'live-api-svc', port: { number: 80 } } } }] },
          },
        ],
      },
    },
  },
  {
    name: 'live-api-cm',
    path: collection('', 'v1', 'configmaps'),
    body: { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'live-api-cm', namespace }, data: { key: 'value' } },
  },
  {
    name: 'live-api-secret',
    path: collection('', 'v1', 'secrets'),
    body: { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'live-api-secret', namespace }, stringData: { token: 'value' } },
  },
  {
    name: 'live-api-pvc',
    path: collection('', 'v1', 'persistentvolumeclaims'),
    body: {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: { name: 'live-api-pvc', namespace },
      spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } },
    },
  },
  {
    name: 'live-api-np',
    path: collection('networking.k8s.io', 'v1', 'networkpolicies'),
    body: {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { name: 'live-api-np', namespace },
      spec: { podSelector: { matchLabels: { app: 'live-api-deploy' } }, policyTypes: ['Ingress'], ingress: [{}] },
    },
  },
]

async function deleteEventually(page: Page, url: string) {
  let lastStatus = 0
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await page.request.delete(url)
    lastStatus = response.status()
    if (response.ok() || response.status() === 404) return
    await page.waitForTimeout(1000)
  }
  throw new Error(`delete ${url} failed: ${lastStatus}`)
}

async function waitGone(page: Page, url: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await page.request.get(url)
    if (response.status() === 404) return
    await page.waitForTimeout(1000)
  }
}

test('live resource API contracts create read delete', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page)
  for (const resource of resources) {
    await deleteEventually(page, `${resource.path}/${resource.name}`)
    const created = await page.request.post(resource.path, { data: resource.body })
    expect(created.ok(), `${resource.name} create: ${created.status()} ${await created.text()}`).toBeTruthy()
    const read = await page.request.get(`${resource.path}/${resource.name}`)
    expect(read.ok(), `${resource.name} read: ${read.status()}`).toBeTruthy()
    await deleteEventually(page, `${resource.path}/${resource.name}`)
  }

  const control = `/api/v1/cube/proxy/clusters/${cluster}/apis/tenant.kubecube.io/v1`
  await deleteEventually(page, `${control}/tenants/live-api-tenant`)
  const tenant = await page.request.post(`${control}/tenants`, {
    data: {
      apiVersion: 'tenant.kubecube.io/v1',
      kind: 'Tenant',
      metadata: { name: 'live-api-tenant' },
      spec: { displayName: 'Live API Tenant' },
    },
  })
  expect(tenant.ok(), `tenant create: ${tenant.status()} ${await tenant.text()}`).toBeTruthy()
  expect((await page.request.get(`${control}/tenants/live-api-tenant`)).ok()).toBeTruthy()
  expect(
    (
      await page.request.patch(`${control}/tenants/live-api-tenant`, {
        headers: { 'Content-Type': 'application/merge-patch+json' },
        data: { spec: { displayName: 'Live API Tenant Updated' } },
      })
    ).ok(),
  ).toBeTruthy()
  await deleteEventually(page, `${control}/tenants/live-api-tenant`)
  await waitGone(page, `${control}/tenants/live-api-tenant`)

  const deploymentPath = collection('apps', 'v1', 'deployments')
  await deleteEventually(page, `${deploymentPath}/live-api-scale`)
  expect((await page.request.post(deploymentPath, { data: deployment('live-api-scale') })).ok()).toBeTruthy()
  expect(
    (
      await page.request.patch(`${deploymentPath}/live-api-scale`, {
        headers: { 'Content-Type': 'application/merge-patch+json' },
        data: { spec: { replicas: 2 } },
      })
    ).ok(),
  ).toBeTruthy()
  expect((await page.request.get(`${deploymentPath}/live-api-scale`)).ok()).toBeTruthy()
  expect(
    (
      await page.request.patch(`${deploymentPath}/live-api-scale`, {
        headers: { 'Content-Type': 'application/merge-patch+json' },
        data: { spec: { template: { metadata: { annotations: { 'kubecube.io/restartedAt': new Date().toISOString() } } } } },
      })
    ).ok(),
  ).toBeTruthy()
  await deleteEventually(page, `${deploymentPath}/live-api-scale`)

  const crdPath = `/api/v1/cube/proxy/clusters/${cluster}/apis/apiextensions.k8s.io/v1/customresourcedefinitions`
  await deleteEventually(page, `${crdPath}/livecrds.live.kubecube.io`)
  const crd = await page.request.post(crdPath, {
    data: {
      apiVersion: 'apiextensions.k8s.io/v1',
      kind: 'CustomResourceDefinition',
      metadata: { name: 'livecrds.live.kubecube.io' },
      spec: {
        group: 'live.kubecube.io',
        names: { plural: 'livecrds', singular: 'livecrd', kind: 'LiveCrd' },
        scope: 'Namespaced',
        versions: [
          {
            name: 'v1',
            served: true,
            storage: true,
            schema: { openAPIV3Schema: { type: 'object', 'x-kubernetes-preserve-unknown-fields': true } },
          },
        ],
      },
    },
  })
  expect(crd.ok(), `crd create: ${crd.status()} ${await crd.text()}`).toBeTruthy()
  expect((await page.request.get(`${crdPath}/livecrds.live.kubecube.io`)).ok()).toBeTruthy()
  await deleteEventually(page, `${crdPath}/livecrds.live.kubecube.io`)

  const projectTenantPath = `/api/v1/cube/proxy/clusters/${cluster}/apis/tenant.kubecube.io/v1`
  const projectTenant = await page.request.post(`${projectTenantPath}/tenants`, {
    data: {
      apiVersion: 'tenant.kubecube.io/v1',
      kind: 'Tenant',
      metadata: { name: 'live-api-project-tenant' },
      spec: { displayName: 'Live API Project Tenant' },
    },
  })
  expect(projectTenant.ok()).toBeTruthy()
  await page.waitForTimeout(3000)
  const project = await page.request.post(`${projectTenantPath}/projects`, {
    data: {
      apiVersion: 'tenant.kubecube.io/v1',
      kind: 'Project',
      metadata: { name: 'live-api-project', labels: { 'kubecube.io/tenant': 'live-api-project-tenant' } },
      spec: { displayName: 'Live API Project', description: 'live contract' },
    },
  })
  expect(project.ok(), `project create: ${project.status()} ${await project.text()}`).toBeTruthy()
  expect((await page.request.get(`${projectTenantPath}/projects/live-api-project`)).ok()).toBeTruthy()
  await deleteEventually(page, `${projectTenantPath}/projects/live-api-project`)
  await deleteEventually(page, `${projectTenantPath}/tenants/live-api-project-tenant`)
  await waitGone(page, `${projectTenantPath}/projects/live-api-project`)
  await waitGone(page, `${projectTenantPath}/tenants/live-api-project-tenant`)

  const quotaPath = `/api/v1/cube/proxy/clusters/${cluster}/apis/quota.kubecube.io/v1/cuberesourcequota/member-arm64-6002.t-verify`
  const quota = await page.request.get(quotaPath)
  if (quota.ok()) {
    const quotaBody = (await quota.json()) as Record<string, any>
    const originalCpu = String(quotaBody.spec?.hard?.['requests.cpu'] || '1')
    const updatedCpu = originalCpu === '2' ? '1' : '2'
    const patch = await page.request.patch(quotaPath, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      data: { spec: { hard: { 'requests.cpu': updatedCpu } } },
    })
    expect(patch.ok(), `quota patch: ${patch.status()}`).toBeTruthy()
    const read = (await (await page.request.get(quotaPath)).json()) as Record<string, any>
    expect(String(read.spec?.hard?.['requests.cpu'])).toBe(updatedCpu)
    await page.request.patch(quotaPath, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      data: { spec: { hard: { 'requests.cpu': originalCpu } } },
    })
  }

  const csv = Buffer.from(
    'name,password,displayName,email,phone\nlive-import-user,KubeCube@2026,Live Import,live-import@example.com,13800000000\n',
    'utf8',
  )
  const imported = await page.request.post('/api/v1/cube/user/users', {
    multipart: { userInfoFile: { name: 'users.csv', mimeType: 'text/csv', buffer: csv } },
  })
  expect(imported.ok(), `user import: ${imported.status()}`).toBeTruthy()
  const importResult = (await imported.json()) as { successCount?: number; failedCount?: number }
  expect(Number(importResult.successCount || 0) + Number(importResult.failedCount || 0)).toBe(1)

  const namespacePath = `/api/v1/cube/proxy/clusters/${cluster}/api/v1/namespaces`
  await deleteEventually(page, `${namespacePath}/live-quota-ns`)
  const namespace = await page.request.post(namespacePath, {
    data: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'live-quota-ns' } },
  })
  expect(namespace.ok(), `namespace create: ${namespace.status()}`).toBeTruthy()
  const quotaCollection = `${namespacePath}/live-quota-ns/resourcequotas`
  const namespaceQuota = await page.request.post(quotaCollection, {
    data: {
      apiVersion: 'v1',
      kind: 'ResourceQuota',
      metadata: { name: 'live-quota' },
      spec: { hard: { 'requests.cpu': '1', 'requests.memory': '1Gi' } },
    },
  })
  expect(namespaceQuota.ok()).toBeTruthy()
  const quotaPatch = await page.request.patch(`${quotaCollection}/live-quota`, {
    headers: { 'Content-Type': 'application/merge-patch+json' },
    data: { spec: { hard: { 'requests.cpu': '2' } } },
  })
  expect(quotaPatch.ok()).toBeTruthy()
  const namespaceQuotaRead = (await (await page.request.get(`${quotaCollection}/live-quota`)).json()) as Record<string, any>
  expect(String(namespaceQuotaRead.spec?.hard?.['requests.cpu'])).toBe('2')
  await deleteEventually(page, `${quotaCollection}/live-quota`)
  await deleteEventually(page, `${namespacePath}/live-quota-ns`)

  const monitoringNs = 'live-monitoring'
  await deleteEventually(page, `${namespacePath}/${monitoringNs}`)
  expect(
    (
      await page.request.post(namespacePath, {
        data: { apiVersion: 'v1', kind: 'Namespace', metadata: { name: monitoringNs } },
      })
    ).ok(),
  ).toBeTruthy()
  const rulePath = `/api/v1/cube/proxy/clusters/${cluster}/apis/monitoring.coreos.com/v1/namespaces/${monitoringNs}/prometheusrules`
  const rule = await page.request.post(rulePath, {
    data: {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: { name: 'live-api-rule', namespace: monitoringNs },
      spec: { groups: [{ name: 'live', rules: [{ alert: 'Live', expr: 'up == 0' }] }] },
    },
  })
  expect(rule.ok(), `prometheusrule create: ${rule.status()} ${await rule.text()}`).toBeTruthy()
  expect((await page.request.get(`${rulePath}/live-api-rule`)).ok()).toBeTruthy()
  await deleteEventually(page, `${rulePath}/live-api-rule`)
  const amPath = `/api/v1/cube/proxy/clusters/${cluster}/apis/monitoring.coreos.com/v1alpha1/namespaces/${monitoringNs}/alertmanagerconfigs`
  const am = await page.request.post(amPath, {
    data: {
      apiVersion: 'monitoring.coreos.com/v1alpha1',
      kind: 'AlertmanagerConfig',
      metadata: { name: 'live-api-am', namespace: monitoringNs },
      spec: { route: { receiver: 'default' }, receivers: [{ name: 'default' }] },
    },
  })
  expect(am.ok(), `alertmanagerconfig create: ${am.status()} ${await am.text()}`).toBeTruthy()
  expect((await page.request.get(`${amPath}/live-api-am`)).ok()).toBeTruthy()
  await deleteEventually(page, `${amPath}/live-api-am`)
  await deleteEventually(page, `${namespacePath}/${monitoringNs}`)

  const key = await page.request.post('/api/v1/cube/key/create')
  expect(key.ok(), `key create: ${key.status()}`).toBeTruthy()
  const keyBody = (await key.json()) as { accessKey?: string }
  expect(keyBody.accessKey).toBeTruthy()
  const keys = (await (await page.request.get('/api/v1/cube/key')).json()) as { items?: Array<Record<string, any>> }
  expect((keys.items || []).some((item) => item.metadata?.name === keyBody.accessKey)).toBeTruthy()
  expect((await page.request.delete('/api/v1/cube/key', { params: { accessKey: keyBody.accessKey! } })).ok()).toBeTruthy()
})
