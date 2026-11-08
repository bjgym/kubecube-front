import type { ResourceDefinition } from '@/api/resource'
import type { KubeResource } from '@/types/api'
import type { KeyValue, ResourceFormBase } from './types'

export type ResourceKind = Pick<ResourceDefinition, 'kind' | 'group' | 'version'>

const RESOURCE_NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

export function newResourceFormBase(): ResourceFormBase {
  return { name: '', namespace: '', labels: [{ key: 'app', value: '' }] }
}

/** Common name/namespace/labels fill; resources without labels fall back to `app: <name>` like the wizard always did. */
export function resourceFormBase(resource: KubeResource): ResourceFormBase {
  const name = String(resource.metadata.name || '')
  const labels = Object.entries(resource.metadata.labels || {}).map(([key, value]) => ({ key, value }))
  return {
    name,
    namespace: String(resource.metadata.namespace || ''),
    labels: labels.length ? labels : [{ key: 'app', value: name }],
  }
}

export function keyValuePairs(rows: KeyValue[]): Record<string, string> {
  return Object.fromEntries(rows.filter((row) => row.key).map((row) => [row.key, row.value]))
}

export function validateResourceName(name: string): string[] {
  if (!name) return ['请输入资源名称']
  if (!RESOURCE_NAME_PATTERN.test(name)) return ['仅支持小写字母、数字和中划线，且不能以中划线开头或结尾']
  return []
}

/**
 * Builds apiVersion/kind/metadata for a resource, cloning `existing` when editing so unknown fields survive.
 * Labels are replaced when editing (the wizard owns them) and merged when creating, matching the pre-refactor editor.
 */
export function buildBaseResource(kind: ResourceKind, form: ResourceFormBase, existing?: KubeResource): KubeResource {
  const base: KubeResource = existing
    ? (JSON.parse(JSON.stringify(existing)) as KubeResource)
    : {
        apiVersion: kind.group ? `${kind.group}/${kind.version}` : kind.version,
        kind: kind.kind,
        metadata: { name: form.name, namespace: form.namespace },
      }
  base.apiVersion = kind.group ? `${kind.group}/${kind.version}` : kind.version
  base.kind = kind.kind
  base.metadata = {
    ...base.metadata,
    name: form.name,
    namespace: form.namespace,
    labels: existing ? keyValuePairs(form.labels) : { ...base.metadata.labels, ...keyValuePairs(form.labels) },
  }
  return base
}
