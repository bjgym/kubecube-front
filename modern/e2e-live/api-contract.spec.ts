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

test('live resource API contracts create read delete', async ({ page }) => {
  test.setTimeout(240_000)
  await login(page)
  for (const resource of resources) {
    await deleteEventually(page, `${resource.path}/${resource.name}`)
    const created = await page.request.post(resource.path, { data: resource.body })
    expect(created.ok(), `${resource.name} create: ${created.status()} ${await created.text()}`).toBeTruthy()
    const read = await page.request.get(`${resource.path}/${resource.name}`)
    expect(read.ok(), `${resource.name} read: ${read.status()}`).toBeTruthy()
    await deleteEventually(page, `${resource.path}/${resource.name}`)
  }
})
