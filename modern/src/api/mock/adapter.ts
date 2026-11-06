import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { apiKeys, auditItems, clusters, namespaces, projects, quotas, resources, roleCatalogue, roles, tenants, users } from './fixtures'
import type { KubeResource, ListResponse } from '@/types/api'

type MockConfig = Parameters<AxiosAdapter>[0]
type ObjectRecord = Record<string, unknown>

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))
const parseBody = (data: unknown) => {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data) as unknown
  } catch {
    return data
  }
}
const record = (value: unknown): ObjectRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectRecord) : {}
const clone = <T>(value: T): T => (value === undefined || value === null ? value : (JSON.parse(JSON.stringify(value)) as T))
const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value))
const resourceName = (resource: KubeResource): string => resource.metadata?.name || text(record(resource).name)
const quotaResources = (): KubeResource[] => (resources.resourcequotas ||= [])

function response<T>(config: MockConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config }
}

function fail(config: MockConfig, status: number, message: string, reason?: string): never {
  const data = { message, ...(reason ? { reason } : {}) }
  throw new AxiosError(message, String(status), config, undefined, {
    data,
    status,
    statusText: message,
    headers: {},
    config,
  })
}

function merge(target: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch)
  const result = target && typeof target === 'object' && !Array.isArray(target) ? clone(record(target)) : {}
  Object.entries(record(patch)).forEach(([key, value]) => {
    if (value === null) delete result[key]
    else result[key] = merge(result[key], value)
  })
  return result
}

function normalizeResource(input: unknown): KubeResource {
  const source = clone(record(input))
  const metadata = record(source.metadata)
  const name = text(metadata.name || source.name)
  return {
    ...source,
    metadata: {
      ...metadata,
      name,
      uid: metadata.uid || crypto.randomUUID(),
      creationTimestamp: metadata.creationTimestamp || new Date().toISOString(),
      resourceVersion: metadata.resourceVersion || String(Date.now()),
    },
  } as KubeResource
}

function touch(resource: KubeResource): KubeResource {
  resource.metadata.resourceVersion = String(Date.now())
  return resource
}

function paginate<T extends KubeResource>(items: T[], params: ObjectRecord = {}): ListResponse<T> {
  let result = [...items]
  const selector = text(params.selector)
  const search = selector.match(/metadata\.name~(.+)/)?.[1]?.toLowerCase() || text(params.query).toLowerCase()
  if (search) result = result.filter((item) => resourceName(item).toLowerCase().includes(search))
  const labelSelector = text(params.labelSelector)
  if (labelSelector) {
    const selectors = labelSelector
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    result = result.filter((item) =>
      selectors.every((selectorEntry) => {
        const match = selectorEntry.match(/^([^=]+)=(.*)$/)
        if (!match) return true
        const key = (match[1] || '').replace(/^metadata\.labels\./, '')
        return record(item.metadata.labels)[key] === match[2]
      }),
    )
  }
  const sortName = text(params.sortName)
  if (sortName) {
    result.sort((a, b) => {
      const left = sortName
        .split('.')
        .reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as ObjectRecord)[key] : undefined), a)
      const right = sortName
        .split('.')
        .reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as ObjectRecord)[key] : undefined), b)
      return String(left ?? '').localeCompare(String(right ?? ''))
    })
    if (params.sortOrder === 'desc') result.reverse()
  }
  const total = result.length
  const pageNum = Math.max(1, Number(params.pageNum) || 1)
  const pageSize = Math.max(1, Number(params.pageSize) || 10)
  return { items: result.slice((pageNum - 1) * pageSize, pageNum * pageSize), total }
}

function resourceKey(path: string): string | null {
  const keys = Object.keys(resources).sort((a, b) => b.length - a.length)
  return keys.find((key) => new RegExp(`/${key}(?:/|$)`).test(path)) || null
}

function decode(value: string | undefined): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function pathPart(path: string, pattern: RegExp): string {
  return decode(path.match(pattern)?.[1])
}

function clusterFromPath(path: string): string {
  return pathPart(path, /\/proxy\/clusters\/([^/]+)/)
}

function namespaceFromResourcePath(path: string): string {
  return pathPart(path, /\/(?:api\/[^/]+|apis\/[^/]+\/[^/]+)\/namespaces\/([^/]+)\/[^/]+/)
}

function roleIsBuiltin(role: KubeResource): boolean {
  return Boolean(record(role.spec).builtIn || record(role).aggregationRule)
}

function roleHolders(name: string): number {
  return users.reduce((count, user) => {
    const bindings = record(user.spec).scopeBindings
    return count + (Array.isArray(bindings) ? bindings.filter((binding) => record(binding).role === name).length : 0)
  }, 0)
}

function scopeBindings(user: KubeResource): ObjectRecord[] {
  const bindings = record(user.spec).scopeBindings
  return Array.isArray(bindings) ? bindings.map(record) : []
}

function writeScopeBindings(user: KubeResource, bindings: ObjectRecord[]) {
  user.spec = { ...record(user.spec), scopeBindings: bindings }
}

function bindingNamespace(binding: ObjectRecord): string {
  const scopeType = text(binding.scopeType)
  const scopeName = text(binding.scopeName)
  if (scopeType === 'project') {
    const project = projects.find((item) => resourceName(item) === scopeName)
    return text(record(project?.spec).namespace || `kubecube-project-${scopeName}`)
  }
  if (scopeType === 'tenant') {
    const tenant = tenants.find((item) => resourceName(item) === scopeName)
    return text(record(tenant?.spec).namespace || `kubecube-tenant-${scopeName}`)
  }
  return ''
}

function removeScopeBindings(scopeType: string, scopeName: string) {
  users.forEach((user) =>
    writeScopeBindings(
      user,
      scopeBindings(user).filter((binding) => !(binding.scopeType === scopeType && binding.scopeName === scopeName)),
    ),
  )
}

function spaceView(resource: KubeResource): KubeResource {
  const labels = record(resource.metadata.labels)
  return {
    ...resource,
    namespace: resourceName(resource),
    cluster: text(record(resource).cluster),
    tenant: text(labels['kubecube.io/tenant']),
    project: text(labels['kubecube.io/project']),
    unmanaged: Boolean(record(resource).unmanaged),
  }
}

function saveSpace(body: ObjectRecord, onboard: boolean, config: MockConfig): KubeResource {
  const cluster = text(body.cluster)
  const space = record(body.space)
  const spaceMetadata = record(space.metadata)
  const name = text(spaceMetadata.name)
  const labels = record(spaceMetadata.labels)
  if (!cluster || !name || !labels['kubecube.io/tenant'] || !labels['kubecube.io/project'])
    fail(config, 400, '空间请求缺少集群、名称、租户或项目')
  const index = namespaces.findIndex((item) => resourceName(item) === name && record(item).cluster === cluster)
  if (onboard && index < 0) fail(config, 404, `空间 ${name} 不存在`, 'NotFound')
  if (!onboard && index >= 0) fail(config, 409, `空间 ${name} 已存在`)
  const existing = index >= 0 ? namespaces[index] : undefined
  const namespace = normalizeResource({
    ...record(existing),
    apiVersion: 'v1',
    kind: 'Namespace',
    cluster,
    unmanaged: false,
    metadata: {
      ...record(existing?.metadata),
      ...spaceMetadata,
      name,
      namespace: '',
      labels: { ...record(existing?.metadata.labels), ...labels },
    },
    status: { ...record(existing?.status), phase: 'Active' },
  })
  if (index >= 0) namespaces[index] = touch(namespace)
  else namespaces.push(namespace)

  const quotaBody = record(body.resourceQuota)
  if (Object.keys(quotaBody).length) {
    const quotaMetadata = record(quotaBody.metadata)
    const quotaName = text(quotaMetadata.name || `${cluster}.${labels['kubecube.io/tenant']}.${labels['kubecube.io/project']}.${name}`)
    const collection = quotaResources()
    const quotaIndex = collection.findIndex(
      (item) => resourceName(item) === quotaName && item.metadata.namespace === name && record(item).cluster === cluster,
    )
    const current = quotaIndex >= 0 ? collection[quotaIndex] : undefined
    const merged = current ? merge(current, quotaBody) : quotaBody
    const quota = normalizeResource({
      ...record(merged),
      cluster,
      metadata: { ...record(record(merged).metadata), name: quotaName, namespace: name },
    })
    if (quotaIndex >= 0) collection[quotaIndex] = touch(quota)
    else collection.push(quota)
  }
  return namespace
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"'
        index++
      } else quoted = !quoted
    } else if (char === delimiter && !quoted) {
      values.push(value.trim())
      value = ''
    } else value += char
  }
  values.push(value.trim())
  return values
}

async function importUserFile(
  body: unknown,
  config: MockConfig,
): Promise<{ successCount: number; failedCount: number; failedMessageList: string[] }> {
  let content = ''
  if (body instanceof globalThis.FormData) {
    const file = body.get('userInfoFile')
    if (file && typeof file !== 'string') content = await file.text()
  } else if (typeof body === 'string') content = body
  if (!content.trim()) fail(config, 400, '请上传包含用户数据的 CSV 文件')
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  const delimiter = (lines[0] || '').includes(';') && !(lines[0] || '').includes(',') ? ';' : ','
  const rows = lines.map((line) => parseCsvLine(line, delimiter))
  const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase())
  const indexOf = (name: string) => headers.indexOf(name.toLowerCase())
  const required = ['name', 'password', 'displayName', 'email', 'phone']
  if (required.some((name) => indexOf(name) < 0)) fail(config, 400, 'CSV 表头须包含 name、password、displayName、email、phone')
  let successCount = 0
  const failedMessageList: string[] = []
  rows.forEach((row, rowIndex) => {
    const name = row[indexOf('name')] || ''
    const password = row[indexOf('password')] || ''
    if (!name || !password) {
      failedMessageList.push(`第 ${rowIndex + 2} 行：账号或密码为空`)
      return
    }
    if (users.some((user) => resourceName(user) === name)) {
      failedMessageList.push(`${name}: 账号已存在`)
      return
    }
    const user = normalizeResource({
      name,
      metadata: { name },
      spec: {
        password,
        displayName: row[indexOf('displayName')] || name,
        email: row[indexOf('email')] || '',
        phone: row[indexOf('phone')] || '',
        loginType: 'normal',
        state: 'normal',
        scopeBindings: [],
      },
    })
    users.push(user)
    successCount++
  })
  return { successCount, failedCount: failedMessageList.length, failedMessageList }
}

export const mockAdapter: AxiosAdapter = async (config) => {
  await wait()
  const url = `${config.baseURL || ''}${config.url || ''}`
  const path = (url.split('?')[0] || url).replace(/\/+$/, '') || '/'
  const method = (config.method || 'get').toUpperCase()
  const params = (config.params || {}) as ObjectRecord
  const body = parseBody(config.data)
  const data = record(body)

  if (path === '/api/v1/cube/login')
    return response(config, { metadata: { name: text(data.name) || 'admin' }, spec: { displayName: '平台管理员' } })
  if (path === '/api/v1/cube/oauth/redirect') return response(config, { metadata: { name: 'admin' }, spec: { displayName: '平台管理员' } })
  if (path === '/api/v1/cube/authorization/identities') {
    const override = typeof window === 'undefined' ? '' : window.localStorage.getItem('kubecube-mock-role')
    if (override === 'tenant') return response(config, { platformAdmin: false, tenantAdmin: true, projectAdmin: false })
    if (override === 'project') return response(config, { platformAdmin: false, tenantAdmin: false, projectAdmin: true })
    if (override === 'user') return response(config, { platformAdmin: false, tenantAdmin: false, projectAdmin: false })
    return response(config, { platformAdmin: true, tenantAdmin: true, projectAdmin: true })
  }
  if (path === '/api/v1/cube/authorization/tenants') return response(config, { items: tenants, total: tenants.length })
  if (path === '/api/v1/cube/authorization/projects')
    return response(config, {
      items: projects.filter((project) => !params.tenant || record(project.metadata.labels)['kubecube.io/tenant'] === params.tenant),
      total: projects.length,
    })
  if (path === '/api/v1/cube/authorization/resources')
    return response(config, Object.fromEntries(Object.keys(resources).map((key) => [key, true])))

  if (path === '/api/v1/cube/authorization/catalogue') {
    if (method !== 'GET') fail(config, 501, '本地 mock 不支持修改权限目录')
    return response(config, roleCatalogue)
  }
  if (path === '/api/v1/cube/authorization/clusterroles') {
    if (method !== 'GET') fail(config, 501, '本地 mock 不支持通过列表路径修改角色')
    const level = text(params.level)
    const items = roles.filter((role) => !level || record(role.metadata.labels)['kubecube.io/role'] === level)
    return response(config, { items, total: items.length })
  }
  if (path === '/api/v1/cube/authorization/roles') {
    if (method !== 'GET') fail(config, 501, '本地 mock 不支持通过角色列表路径写入角色')
    return response(config, { items: roles, total: roles.length })
  }
  const roleMatch = path.match(/^\/api\/v1\/cube\/authorization\/roles\/([^/]+)$/)
  if (roleMatch) {
    const name = decode(roleMatch[1])
    const index = roles.findIndex((role) => resourceName(role) === name)
    const current = index >= 0 ? roles[index] : undefined
    if (method === 'GET') {
      if (!current) fail(config, 404, `角色 ${name} 不存在`, 'NotFound')
      return response(config, {
        scope: record(current.metadata.labels)['kubecube.io/role'] || '',
        items: clone(record(record(current.spec).items)),
        builtin: roleIsBuiltin(current),
        holders: roleHolders(name),
      })
    }
    if (method === 'PUT') {
      const scope = text(data.scope)
      const items = record(data.items)
      if (!['platform', 'tenant', 'project'].includes(scope) || !data.items || typeof data.items !== 'object' || Array.isArray(data.items))
        fail(config, 400, '角色请求须包含有效 scope 与 items')
      const catalogue = roleCatalogue.items as Record<string, { levels: string[] }>
      for (const [item, verb] of Object.entries(items)) {
        if (!catalogue[item] || !catalogue[item].levels.includes(scope)) fail(config, 400, `权限项 ${item} 不能在 ${scope} 层级授权`)
        if (!['read', 'write', 'all'].includes(text(verb))) fail(config, 400, `权限项 ${item} 的动词无效`)
      }
      if (current && roleIsBuiltin(current)) fail(config, 403, '内置角色为只读，不能通过 mock 修改')
      const role = normalizeResource({
        ...record(current),
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: {
          ...record(current?.metadata),
          name,
          labels: { ...record(current?.metadata.labels), 'kubecube.io/rbac': 'true', 'kubecube.io/role': scope },
          annotations: { ...record(current?.metadata.annotations), 'kubecube.io/sync': 'true' },
        },
        spec: {
          ...record(current?.spec),
          displayName: record(current?.spec).displayName || name,
          description: record(current?.spec).description || '自定义角色',
          builtIn: false,
          items: clone(items),
        },
      })
      delete role.aggregationRule
      if (index >= 0) roles[index] = touch(role)
      else roles.push(role)
      return response(config, null)
    }
    if (method === 'DELETE') {
      if (!current) fail(config, 404, `角色 ${name} 不存在`, 'NotFound')
      if (roleIsBuiltin(current)) fail(config, 400, '内置角色不能删除')
      const holders = roleHolders(name)
      if (holders) fail(config, 409, `角色仍被 ${holders} 个绑定使用，不能删除`)
      roles.splice(index, 1)
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持角色 ${method} 操作`)
  }

  if (path === '/api/v1/cube/authorization/bindings') {
    if (method === 'POST') {
      const metadata = record(data.metadata)
      const labels = record(metadata.labels)
      const subjects = Array.isArray(data.subjects) ? data.subjects : []
      const userName = text(record(subjects[0]).name)
      const roleName = text(record(data.roleRef).name)
      const project = text(labels['kubecube.io/project'])
      const tenant = text(labels['kubecube.io/tenant'])
      const scopeType = project ? 'project' : tenant ? 'tenant' : 'platform'
      const scopeName = project || tenant || 'platform'
      const user = users.find((item) => resourceName(item) === userName)
      if (!user || !roleName || !roles.some((role) => resourceName(role) === roleName)) fail(config, 400, '绑定请求中的用户或角色不存在')
      const bindings = scopeBindings(user)
      if (!bindings.some((binding) => binding.scopeType === scopeType && binding.scopeName === scopeName && binding.role === roleName))
        bindings.push({ scopeType, scopeName, role: roleName })
      writeScopeBindings(user, bindings)
      return response(config, 'success')
    }
    if (method === 'DELETE') {
      const name = text(params.name || data.name)
      const namespace = text(params.namespace || data.namespace)
      if (!name || !namespace) fail(config, 400, '解绑请求缺少 name 或 namespace')
      let removed = false
      users.forEach((user) => {
        const userName = resourceName(user)
        if (name !== `${userName}-in-${namespace}`) return
        const remaining = scopeBindings(user).filter((binding) => {
          const matches = bindingNamespace(binding) === namespace
          if (matches) removed = true
          return !matches
        })
        writeScopeBindings(user, remaining)
      })
      if (!removed) fail(config, 404, '未找到对应的成员绑定', 'NotFound')
      return response(config, 'success')
    }
    fail(config, 501, `本地 mock 不支持绑定 ${method} 操作`)
  }

  if (path === '/api/v1/cube/user/pwd') {
    if (method !== 'PUT') fail(config, 501, '本地 mock 仅支持 PUT 修改密码')
    const userName = text(data.userName)
    const user = users.find((item) => resourceName(item) === userName)
    if (!user) fail(config, 404, `用户 ${userName} 不存在`, 'NotFound')
    const currentPassword = text(record(user.spec).password)
    if (currentPassword && currentPassword !== text(data.originPassword)) fail(config, 400, '原密码不正确')
    if (text(data.newPassword).length < 8) fail(config, 400, '新密码长度不能小于 8 位')
    user.spec = { ...record(user.spec), password: text(data.newPassword) }
    return response(config, null)
  }
  if (path === '/api/v1/cube/user/template') {
    if (method !== 'GET') fail(config, 501, '本地 mock 不支持写入用户模板')
    const csv = '\uFEFFname,password,displayName,email,phone\r\nZhangSan,ZhangSun12345,ZhangSan,zhangsan@163.com,17609873452\r\n'
    return response(config, new globalThis.Blob([csv], { type: 'text/csv;charset=utf-8' }))
  }
  if (path === '/api/v1/cube/user/users') {
    if (method !== 'POST') fail(config, 501, '本地 mock 仅支持 POST 批量导入用户')
    return response(config, await importUserFile(body, config))
  }
  if (path === '/api/v1/cube/user') {
    if (method === 'GET') return response(config, paginate(users, params))
    if (method === 'POST') {
      const user = normalizeResource(data)
      user.name = resourceName(user)
      const name = resourceName(user)
      if (!name) fail(config, 400, '用户账号不能为空')
      if (users.some((item) => resourceName(item) === name)) fail(config, 409, `用户 ${name} 已存在`)
      user.spec = { loginType: 'normal', state: 'normal', scopeBindings: [], ...record(user.spec) }
      users.push(user)
      return response(config, user)
    }
    fail(config, 501, `本地 mock 不支持用户列表 ${method} 操作`)
  }
  const userMatch = path.match(/^\/api\/v1\/cube\/user\/([^/]+)$/)
  if (userMatch) {
    const name = decode(userMatch[1])
    const index = users.findIndex((user) => resourceName(user) === name)
    if (index < 0) fail(config, 404, `用户 ${name} 不存在`, 'NotFound')
    if (method === 'GET') return response(config, users[index])
    if (method === 'PUT') {
      const updated = normalizeResource(merge(users[index], data))
      updated.name = name
      users[index] = touch(updated)
      return response(config, updated)
    }
    fail(config, 501, `本地 mock 不支持用户 ${method} 操作`)
  }

  if (path === '/api/v1/cube/key/create') {
    if (method !== 'POST') fail(config, 501, '本地 mock 仅支持 POST 创建密钥')
    if (apiKeys.length >= 5) fail(config, 400, '每个账号最多创建 5 个密钥')
    const accessKey = `ak_${crypto.randomUUID().replaceAll('-', '')}`
    const secretKey = crypto.randomUUID().replaceAll('-', '')
    const key = normalizeResource({
      apiVersion: 'user.kubecube.io/v1',
      kind: 'Key',
      name: '新建密钥',
      metadata: { name: accessKey, labels: { 'kubecube.io/user': 'admin' } },
      spec: { secretKey, user: 'admin' },
    })
    apiKeys.push(key)
    return response(config, { name: '新建密钥', accessKey, secretKey })
  }
  if (path === '/api/v1/cube/key') {
    if (method === 'GET') return response(config, { items: apiKeys, total: apiKeys.length })
    if (method === 'DELETE') {
      const accessKey = text(params.accessKey || data.accessKey)
      const index = apiKeys.findIndex((key) => resourceName(key) === accessKey)
      if (!accessKey) fail(config, 400, '删除密钥缺少 accessKey')
      if (index < 0) fail(config, 404, '密钥不存在', 'NotFound')
      apiKeys.splice(index, 1)
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持密钥 ${method} 操作`)
  }

  const scopeCollection = path.match(/\/apis\/tenant\.kubecube\.io\/v1\/(tenants|projects)$/)
  if (scopeCollection) {
    const scope = scopeCollection[1]
    const collection = scope === 'tenants' ? tenants : projects
    if (method === 'GET') return response(config, paginate(collection, params))
    if (method === 'POST') {
      const resource = normalizeResource(data)
      const name = resourceName(resource)
      if (!name) fail(config, 400, '资源标识不能为空')
      if (collection.some((item) => resourceName(item) === name)) fail(config, 409, `${name} 已存在`)
      resource.spec = {
        ...record(resource.spec),
        namespace: text(record(resource.spec).namespace || `kubecube-${scope === 'tenants' ? 'tenant' : 'project'}-${name}`),
      }
      collection.push(resource)
      return response(config, resource)
    }
    fail(config, 501, `本地 mock 不支持 ${scope} 集合 ${method} 操作`)
  }
  const scopeItem = path.match(/\/apis\/tenant\.kubecube\.io\/v1\/(tenants|projects)\/([^/]+)$/)
  if (scopeItem) {
    const scope = scopeItem[1]
    const name = decode(scopeItem[2])
    const collection = scope === 'tenants' ? tenants : projects
    const index = collection.findIndex((item) => resourceName(item) === name)
    if (index < 0) fail(config, 404, `${name} 不存在`, 'NotFound')
    if (method === 'GET' || method === 'POST') return response(config, collection[index])
    if (method === 'PATCH') {
      collection[index] = touch(normalizeResource(merge(collection[index], data)))
      return response(config, collection[index])
    }
    if (method === 'DELETE') {
      collection.splice(index, 1)
      removeScopeBindings(scope === 'tenants' ? 'tenant' : 'project', name)
      if (scope === 'tenants') {
        const tenantProjects = projects.filter((project) => record(project.metadata.labels)['kubecube.io/tenant'] === name)
        tenantProjects.forEach((project) => removeScopeBindings('project', resourceName(project)))
        for (let projectIndex = projects.length - 1; projectIndex >= 0; projectIndex--)
          if (record(projects[projectIndex]?.metadata.labels)['kubecube.io/tenant'] === name) projects.splice(projectIndex, 1)
      }
      for (let namespaceIndex = namespaces.length - 1; namespaceIndex >= 0; namespaceIndex--) {
        const labels = record(namespaces[namespaceIndex]?.metadata.labels)
        if (labels[scope === 'tenants' ? 'kubecube.io/tenant' : 'kubecube.io/project'] === name) namespaces.splice(namespaceIndex, 1)
      }
      resources.resourcequotas = quotaResources().filter(
        (item) => record(item.metadata.labels)[scope === 'tenants' ? 'kubecube.io/tenant' : 'kubecube.io/project'] !== name,
      )
      if (scope === 'tenants') {
        for (let quotaIndex = quotas.length - 1; quotaIndex >= 0; quotaIndex--)
          if (record(quotas[quotaIndex]?.metadata.labels)['kubecube.io/tenant'] === name) quotas.splice(quotaIndex, 1)
      }
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持 ${scope}/${name} ${method} 操作`)
  }

  const quotaCollection = path.match(/\/apis\/quota\.kubecube\.io\/v1\/cuberesourcequota$/)
  if (quotaCollection) {
    if (method === 'GET') return response(config, { items: quotas, total: quotas.length })
    if (method === 'POST') {
      const quota = normalizeResource(data)
      const name = resourceName(quota)
      if (!name) fail(config, 400, '配额名称不能为空')
      if (quotas.some((item) => resourceName(item) === name)) fail(config, 409, `配额 ${name} 已存在`)
      quota.status = { ...record(quota.status), hard: clone(record(record(quota.spec).hard)), used: record(quota.status).used || {} }
      quotas.push(quota)
      return response(config, quota)
    }
    fail(config, 501, `本地 mock 不支持租户配额集合 ${method} 操作`)
  }
  const quotaItem = path.match(/\/apis\/quota\.kubecube\.io\/v1\/cuberesourcequota\/([^/]+)$/)
  if (quotaItem) {
    const name = decode(quotaItem[1])
    const index = quotas.findIndex((item) => resourceName(item) === name)
    if (index < 0) fail(config, 404, `配额 ${name} 不存在`, 'NotFound')
    if (method === 'GET') return response(config, quotas[index])
    if (method === 'PATCH') {
      const updated = touch(normalizeResource(merge(quotas[index], data)))
      updated.status = { ...record(updated.status), hard: clone(record(record(updated.spec).hard)) }
      quotas[index] = updated
      return response(config, updated)
    }
    if (method === 'DELETE') {
      quotas.splice(index, 1)
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持租户配额 ${method} 操作`)
  }

  if (path === '/api/v1/cube/clusters/subnamespaces') {
    if (method !== 'GET') fail(config, 501, '本地 mock 不支持通过空间列表路径写入')
    const items = namespaces.map(spaceView)
    return response(config, { items, total: items.length })
  }
  if (path === '/api/v1/cube/clusters/nsquota' || path === '/api/v1/cube/clusters/nsquota/onboard') {
    if (method !== 'POST') fail(config, 501, '本地 mock 仅支持 POST 创建或纳管空间')
    return response(config, saveSpace(data, path.endsWith('/onboard'), config))
  }
  const namespaceMatch = path.match(/^\/api\/v1\/cube\/proxy\/clusters\/([^/]+)\/api\/v1\/namespaces(?:\/([^/]+))?$/)
  if (namespaceMatch) {
    const cluster = decode(namespaceMatch[1])
    const name = decode(namespaceMatch[2])
    const scoped = namespaces.filter((item) => record(item).cluster === cluster)
    if (!name) {
      if (method === 'GET') return response(config, paginate(scoped, params))
      if (method === 'POST') {
        const namespace = normalizeResource({ ...data, cluster })
        if (!resourceName(namespace)) fail(config, 400, '空间名称不能为空')
        if (scoped.some((item) => resourceName(item) === resourceName(namespace))) fail(config, 409, '空间已存在')
        namespaces.push(namespace)
        return response(config, namespace)
      }
      fail(config, 501, `本地 mock 不支持空间集合 ${method} 操作`)
    }
    const index = namespaces.findIndex((item) => record(item).cluster === cluster && resourceName(item) === name)
    if (index < 0) fail(config, 404, `空间 ${name} 不存在`, 'NotFound')
    if (method === 'GET') return response(config, namespaces[index])
    if (method === 'PUT') {
      const updated = normalizeResource({
        ...data,
        cluster,
        metadata: { ...record(namespaces[index]?.metadata), ...record(data.metadata), name },
      })
      namespaces[index] = touch(updated)
      return response(config, updated)
    }
    if (method === 'DELETE') {
      namespaces.splice(index, 1)
      resources.resourcequotas = quotaResources().filter((item) => !(record(item).cluster === cluster && item.metadata.namespace === name))
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持空间 ${method} 操作`)
  }

  if (path === '/api/v1/cube/extend/feature-config')
    return response(config, { audit: 'enabled', logseer: 'enabled', 'kubecube-monitoring': 'enabled' })
  if (path === '/api/v1/cube/extend/configmap/kubecube-auth-config') return response(config, {})
  if (path === '/api/v1/cube/clusters/info' || path === '/api/v1/cube/clusters/namespaces')
    return response(config, { items: clusters, total: clusters.length })
  if (path === '/api/v2/logseer/extends/logconfigs') {
    const cluster = text(params.cluster)
    const namespace = text(params.namespace)
    const filter = text(params.filtervalue).toLowerCase()
    const all = (resources.logconfigs || []).filter((item) => {
      const spec = record(item.spec)
      if (cluster && spec.cluster && spec.cluster !== cluster) return false
      if (namespace && item.metadata.namespace && item.metadata.namespace !== namespace) return false
      return !filter || resourceName(item).toLowerCase().includes(filter)
    })
    const offset = Math.max(0, Number(params.offset) || 0)
    const limit = Math.max(1, Number(params.limit) || 10)
    return response(config, { items: all.slice(offset, offset + limit), total: all.length })
  }
  if (path.startsWith('/api/v2/logseer/extends/clusters/') && path.includes('/logconfigs')) {
    const cluster = pathPart(path, /\/clusters\/([^/]+)/)
    const namespace = pathPart(path, /\/namespaces\/([^/]+)/)
    const name = decode(path.split('/').at(-1))
    const isCollection = name === 'logconfigs'
    const collection = (resources.logconfigs ||= [])
    if (method === 'POST' && isCollection) {
      const dto = record(data)
      const resourceNameValue = text(dto.name)
      if (!resourceNameValue) fail(config, 400, '日志任务名称不能为空')
      if (collection.some((item) => resourceName(item) === resourceNameValue && item.metadata.namespace === namespace))
        fail(config, 409, `日志任务 ${resourceNameValue} 已存在`)
      const created = normalizeResource({
        apiVersion: 'logseer.kubecube.io/v2',
        kind: 'LogConfig',
        metadata: { name: resourceNameValue, namespace },
        spec: { ...dto, cluster, namespace },
      })
      collection.push(created)
      return response(config, created)
    }
    const index = collection.findIndex((item) => resourceName(item) === name && item.metadata.namespace === namespace)
    if (method === 'GET' && !isCollection) {
      if (index < 0) fail(config, 404, `日志任务 ${name} 不存在`, 'NotFound')
      return response(config, collection[index])
    }
    if ((method === 'PUT' || method === 'PATCH') && !isCollection) {
      if (index < 0) fail(config, 404, `日志任务 ${name} 不存在`, 'NotFound')
      const dto = record(data)
      const current = collection[index]!
      const updated = touch(
        normalizeResource({
          ...current,
          metadata: { ...current.metadata, name },
          spec: { ...record(current.spec), ...dto, cluster, namespace },
        }),
      )
      collection[index] = updated
      return response(config, updated)
    }
    if (method === 'DELETE' && !isCollection) {
      if (index < 0) fail(config, 404, `日志任务 ${name} 不存在`, 'NotFound')
      collection.splice(index, 1)
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持日志任务 ${method} 操作`)
  }
  if (path === '/api/v1/cube/audit/enabled' || path === '/api/v1/audit/enabled') return response(config, true)
  if (path === '/api/v1/cube/audit') return response(config, { items: auditItems, total: auditItems.length })
  if (path === '/api/v1/audit/export') {
    const csv = [
      'id,user,action,resourceType,resourceName,status,timestamp',
      ...auditItems.map((item) =>
        [item.id, item.user, item.action, item.resourceType, item.resourceName, item.status, item.timestamp].join(','),
      ),
    ].join('\n')
    return response(config, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  }
  if (path === '/api/v1/audit') {
    const startTime = Number(params.startTime) || 0
    const endTime = Number(params.endTime) || Number.MAX_SAFE_INTEGER
    const filtered = auditItems
      .filter((item) => {
        const eventTime = Date.parse(item.timestamp) / 1000
        if (eventTime < startTime || eventTime > endTime) return false
        if (params.userName && !item.user.toLowerCase().includes(text(params.userName).toLowerCase())) return false
        if (params.sourceIpAddress && !item.sourceIp.includes(text(params.sourceIpAddress))) return false
        if (params.resourceName && !text(item.resourceName).toLowerCase().includes(text(params.resourceName).toLowerCase())) return false
        if (params.eventName && !text(item.action).toLowerCase().includes(text(params.eventName).toLowerCase())) return false
        if (params.responseStatus !== undefined && String(item.status) !== String(params.responseStatus)) return false
        return true
      })
      .sort((a, b) => (params.sortAsc === true ? 1 : -1) * (Date.parse(a.timestamp) - Date.parse(b.timestamp)))
    const page = Math.max(1, Number(params.page) || 1)
    const size = Math.max(1, Number(params.size) || 20)
    return response(config, { items: filtered.slice((page - 1) * size, page * size), total: filtered.length })
  }
  if (path.includes('/dashboards/')) {
    return response(config, {
      apiVersion: 'monitoring.kubecube.io/v1',
      kind: 'Dashboard',
      metadata: { name: path.split('/').at(-1) || 'mock-dashboard' },
      spec: {
        title: '空间资源概览',
        selectshowable: 'true',
        variables: [{ query: { name: 'instance', label: '实例', request: 'label_values(up, instance)' } }],
        rows: [
          {
            name: '核心指标',
            panels: [
              {
                singleStat: {
                  title: 'CPU 使用',
                  span: 3,
                  unit: 'cores',
                  targets: [
                    {
                      prometheus: { query: 'sum(rate(container_cpu_usage_seconds_total{instance=~"$instance"}[5m]))', legend: 'CPU 使用' },
                    },
                  ],
                },
              },
              {
                graph: {
                  title: 'CPU 使用趋势',
                  span: 9,
                  axes: { y: { unit: 'cores' } },
                  targets: [
                    {
                      prometheus: { query: 'sum(rate(container_cpu_usage_seconds_total{instance=~"$instance"}[5m]))', legend: 'CPU 使用' },
                    },
                  ],
                },
              },
              {
                table: {
                  title: '容器资源概览',
                  span: 12,
                  styles: [{ unit: 'cores', pattern: 'Value #A', alias: 'CPU' }],
                  targets: [
                    { prometheus: { query: 'sum(rate(container_cpu_usage_seconds_total{instance=~"$instance"}[5m]))', legend: 'CPU' } },
                  ],
                },
              },
            ],
          },
        ],
      },
    })
  }
  if (path === '/api/v1/series')
    return response(config, { status: 'success', data: [{ instance: 'pivot-cluster' }, { instance: 'production-shanghai' }] })
  if (path.includes('/query_range')) {
    const end = Math.floor(Date.now() / 1000)
    const values = Array.from({ length: 24 }, (_, index) => [end - (23 - index) * 300, String(45 + Math.sin(index / 2.5) * 16 + index / 3)])
    return response(config, { status: 'success', data: { resultType: 'matrix', result: [{ metric: { resource: 'CPU' }, values }] } })
  }
  if (path.includes('/query'))
    return response(config, {
      status: 'success',
      data: { resultType: 'vector', result: [{ metric: {}, value: [Date.now() / 1000, '0.68'] }] },
    })
  if (path.includes('/elasticsearch/_search'))
    return response(config, {
      items: Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 5000).toISOString(),
        level: i % 6 === 0 ? 'ERROR' : 'INFO',
        message:
          i % 6 === 0 ? 'upstream request timeout, retrying request' : `request completed status=200 duration=${12 + i}ms path=/api/orders`,
        pod: `order-service-${i % 4}`,
        container: 'app',
      })),
      total: 2458,
    })
  if (path.includes('/pvcworkloads/')) {
    const pvcName = pathPart(path, /\/pvcworkloads\/([^/]+)/)
    const pods = (resources.pods || []).filter((pod) => {
      const volumes = record(pod.spec).volumes
      return Array.isArray(volumes) && volumes.some((volume) => record(record(volume).persistentVolumeClaim).claimName === pvcName)
    })
    return response(config, { pods: pods.map((pod) => ({ ...pod, reason: 'Running' })), total: pods.length })
  }
  if (path.includes('/externalAccess/')) {
    const serviceName = pathPart(path, /\/externalAccess\/([^/]+)/)
    const service = (resources.services || []).find((item) => resourceName(item) === serviceName)
    if (!service) fail(config, 404, `Service ${serviceName} 不存在`, 'NotFound')
    const spec = record(service.spec)
    const ports = Array.isArray(spec.ports) ? spec.ports.map(record) : []
    if (method === 'GET')
      return response(
        config,
        ports.map((port) => ({
          protocol: port.protocol || 'TCP',
          servicePort: port.port,
          servicePortName: port.name,
          ...(port.nodePort ? { externalPort: port.nodePort } : {}),
        })),
      )
    if (method === 'POST') {
      const externalPorts = Array.isArray(data) ? data.map(record) : []
      spec.ports = ports.map((port) => {
        const external = externalPorts.find(
          (item) => item.protocol === (port.protocol || 'TCP') && Number(item.servicePort) === Number(port.port),
        )
        if (!external) return port
        const { nodePort: _nodePort, ...withoutNodePort } = port
        return external.externalPort ? { ...withoutNodePort, nodePort: Number(external.externalPort) } : withoutNodePort
      })
      service.spec = spec
      return response(config, data)
    }
    fail(config, 501, `本地 mock 不支持外部端口 ${method} 操作`)
  }
  if (path.includes('/logs/')) {
    const podName = decode(path.split('/').at(-1) || '')
    const pod = (resources.pods || []).find((item) => resourceName(item) === podName)
    const spec = record(pod?.spec)
    const containers = Array.isArray(spec.containers) ? spec.containers.map(record) : []
    const requested = String(record(config.params).containerName || '')
    const containerName = containers.some((item) => item.name === requested) ? requested : String(containers[0]?.name || requested || 'app')
    const previous = String(record(config.params).previous) === 'true'
    const count = Math.min(200, Math.max(1, Math.abs(Number(record(config.params).offsetFrom) || 30)))
    const timestamp = new Date().toISOString()
    return response(config, {
      info: {
        podName,
        containerName,
        fromDate: timestamp,
        toDate: timestamp,
        truncated: false,
      },
      selection: {
        referencePoint: { timestamp: 'newest', lineNum: 0 },
        offsetFrom: -count,
        offsetTo: 0,
        logFilePosition: 'end',
      },
      logs: Array.from({ length: count }, (_, index) => ({
        timestamp: new Date(1700000000000 + index * 1000).toISOString(),
        content: `INFO ${previous ? 'previous ' : ''}container=${containerName} request completed id=req_${index + 1} status=200`,
      })),
    })
  }
  if (method === 'POST' && path.endsWith('/eviction')) {
    const podName = decode(path.split('/').at(-2))
    const namespace = namespaceFromResourcePath(path)
    const pods = (resources.pods ||= [])
    const index = pods.findIndex((item) => resourceName(item) === podName && (!namespace || item.metadata.namespace === namespace))
    if (index < 0) fail(config, 404, `Pod ${podName} 不存在`, 'NotFound')
    pods.splice(index, 1)
    return response(config, { apiVersion: 'policy/v1', kind: 'Eviction', metadata: { name: podName, namespace } }, 201)
  }

  const key = resourceKey(path)
  if (key) {
    const collection = resources[key] || (resources[key] = [])
    const cluster = clusterFromPath(path)
    const namespace = namespaceFromResourcePath(path)
    const scoped = collection.filter((item) => {
      if (namespace && item.metadata.namespace !== namespace) return false
      if (key === 'resourcequotas' && cluster && record(item).cluster !== cluster) return false
      return true
    })
    const name = decode(path.split('/').pop())
    const isCollection = name === key
    const matches = (item: KubeResource) =>
      resourceName(item) === name &&
      (!namespace || item.metadata.namespace === namespace) &&
      (key !== 'resourcequotas' || !cluster || record(item).cluster === cluster)
    if (method === 'GET') {
      if (!isCollection) {
        const item = scoped.find(matches)
        if (!item) fail(config, 404, `${name} 不存在`, 'NotFound')
        return response(config, item)
      }
      return response(config, paginate(scoped, params))
    }
    if (method === 'POST' && isCollection) {
      const item = normalizeResource({
        ...data,
        ...(cluster && key === 'resourcequotas' ? { cluster } : {}),
        metadata: { ...record(data.metadata), ...(namespace ? { namespace: record(data.metadata).namespace || namespace } : {}) },
      })
      if (!resourceName(item)) fail(config, 400, `${key} 资源名称不能为空`)
      if (
        collection.some(
          (existing) =>
            resourceName(existing) === resourceName(item) &&
            (!namespace || existing.metadata.namespace === namespace) &&
            (key !== 'resourcequotas' || record(existing).cluster === cluster),
        )
      )
        fail(config, 409, `${resourceName(item)} 已存在`)
      collection.push(item)
      return response(config, item)
    }
    if ((method === 'PUT' || method === 'PATCH') && !isCollection) {
      const index = collection.findIndex(matches)
      if (index < 0) fail(config, 404, `${name} 不存在`, 'NotFound')
      const current = collection[index]
      const updated =
        method === 'PATCH'
          ? normalizeResource(merge(current, data))
          : normalizeResource({
              ...data,
              ...(cluster && key === 'resourcequotas' ? { cluster } : {}),
              metadata: {
                ...record(current?.metadata),
                ...record(data.metadata),
                name,
                uid: record(current?.metadata).uid,
                creationTimestamp: record(current?.metadata).creationTimestamp,
              },
            })
      collection[index] = touch(updated)
      return response(config, updated)
    }
    if (method === 'DELETE' && !isCollection) {
      const index = collection.findIndex(matches)
      if (index < 0) fail(config, 404, `${name} 不存在`, 'NotFound')
      collection.splice(index, 1)
      return response(config, null)
    }
    fail(config, 501, `本地 mock 不支持 ${key} 的 ${method} 写操作`)
  }

  if (method !== 'GET') fail(config, 501, `本地 mock 暂不支持 ${method} ${path}`)
  return response(config, { items: [], total: 0 })
}
