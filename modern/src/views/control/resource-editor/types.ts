import type { KubeResource } from '@/types/api'
import { networkPolicyFormAdapter } from './adapters/networkPolicy'
import { secretFormAdapter } from './adapters/secret'
import { serviceFormAdapter } from './adapters/service'

export interface KeyValue {
  key: string
  value: string
}

/** Fields every resource editor form shares, so an adapter can build the object metadata itself. */
export interface ResourceFormBase {
  name: string
  namespace: string
  labels: KeyValue[]
}

/**
 * Per-resource conversion between the guided wizard form and a Kubernetes resource.
 *
 * `existing` is the resource currently being edited (`undefined` when creating); adapters clone it so
 * fields the wizard does not expose survive a save. `validate` returns user-facing messages; keep it
 * limited to checks the editor already enforced so the extraction stays behavior-preserving.
 */
export interface ResourceFormAdapter<Form extends ResourceFormBase> {
  key: string
  createEmptyForm(): Form
  fillForm(resource: KubeResource): Form
  validate(form: Form): string[]
  buildResource(form: Form, existing?: KubeResource): KubeResource
}

export type ResourceFormAdapterRegistry = Record<string, ResourceFormAdapter<ResourceFormBase>>

export const resourceFormAdapters: ResourceFormAdapterRegistry = {
  [serviceFormAdapter.key]: serviceFormAdapter,
  [secretFormAdapter.key]: secretFormAdapter,
  [networkPolicyFormAdapter.key]: networkPolicyFormAdapter,
}

export function getResourceFormAdapter(key: string): ResourceFormAdapter<ResourceFormBase> | undefined {
  return resourceFormAdapters[key]
}
