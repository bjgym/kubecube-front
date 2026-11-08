import { getResourceConfig } from '@/config/resources'
import type { KubeResource } from '@/types/api'
import { buildBaseResource, newResourceFormBase, resourceFormBase, validateResourceName } from '../shared'
import type { KeyValue, ResourceFormAdapter, ResourceFormBase } from '../types'

export interface SecretForm extends ResourceFormBase {
  data: KeyValue[]
  secretType: string
  tlsCrt: string
  tlsKey: string
  registryServer: string
  registryUsername: string
  registryPassword: string
  registryEmail: string
}

const secretKind = getResourceConfig('secrets')!

function decodeBase64(value: string | undefined): string {
  if (!value) return ''
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)))
  } catch {
    return ''
  }
}

function createEmptyForm(): SecretForm {
  return {
    ...newResourceFormBase(),
    data: [{ key: 'app.properties', value: 'key=value' }],
    secretType: 'Opaque',
    tlsCrt: '',
    tlsKey: '',
    registryServer: 'https://index.docker.io/v1/',
    registryUsername: '',
    registryPassword: '',
    registryEmail: '',
  }
}

function fillForm(resource: KubeResource): SecretForm {
  const stringData = (resource.stringData || {}) as Record<string, string>
  const entries = new Map(Object.keys(resource.data || {}).map((key) => [key, '']))
  Object.entries(stringData).forEach(([key, value]) => entries.set(key, value))
  const form: SecretForm = {
    ...resourceFormBase(resource),
    data: [...entries].map(([key, value]) => ({ key, value })),
    secretType: String(resource.type || 'Opaque'),
    tlsCrt: stringData['tls.crt'] || decodeBase64(resource.data?.['tls.crt']),
    tlsKey: stringData['tls.key'] || decodeBase64(resource.data?.['tls.key']),
    registryServer: 'https://index.docker.io/v1/',
    registryUsername: '',
    registryPassword: '',
    registryEmail: '',
  }
  const dockerConfig = stringData['.dockerconfigjson'] || decodeBase64(resource.data?.['.dockerconfigjson'])
  if (dockerConfig) {
    try {
      const parsed = JSON.parse(dockerConfig) as { auths?: Record<string, Record<string, string>> }
      const [server, auth] = Object.entries(parsed.auths || {})[0] || []
      if (server && auth) {
        form.registryServer = server
        form.registryUsername = auth.username || ''
        form.registryPassword = auth.password || ''
        form.registryEmail = auth.email || ''
      }
    } catch {
      form.registryServer = 'https://index.docker.io/v1/'
    }
  }
  return form
}

function validate(form: SecretForm): string[] {
  return validateResourceName(form.name)
}

function buildResource(form: SecretForm, existing?: KubeResource): KubeResource {
  const base = buildBaseResource(secretKind, form, existing)
  const existingData = (base.data || {}) as Record<string, string>
  base.type = form.secretType
  if (form.secretType === 'kubernetes.io/tls') {
    base.stringData = {
      ...(form.tlsCrt ? { 'tls.crt': form.tlsCrt } : {}),
      ...(form.tlsKey ? { 'tls.key': form.tlsKey } : {}),
    }
  } else if (form.secretType === 'kubernetes.io/dockerconfigjson') {
    if (form.registryUsername || form.registryPassword) {
      const server = form.registryServer.trim() || 'https://index.docker.io/v1/'
      base.stringData = {
        '.dockerconfigjson': JSON.stringify({
          auths: {
            [server]: {
              username: form.registryUsername,
              password: form.registryPassword,
              email: form.registryEmail || undefined,
              auth: btoa(`${form.registryUsername}:${form.registryPassword}`),
            },
          },
        }),
      }
    }
  } else {
    const desiredKeys = new Set(form.data.filter((item) => item.key).map((item) => item.key))
    base.data = Object.fromEntries(Object.entries(existingData).filter(([key]) => desiredKeys.has(key)))
    base.stringData = Object.fromEntries(
      form.data
        .filter((item) => item.key && (!Object.hasOwn(existingData, item.key) || item.value !== ''))
        .map((item) => [item.key, item.value]),
    )
  }
  return base
}

export const secretFormAdapter: ResourceFormAdapter<SecretForm> = {
  key: 'secrets',
  createEmptyForm,
  fillForm,
  validate,
  buildResource,
}
