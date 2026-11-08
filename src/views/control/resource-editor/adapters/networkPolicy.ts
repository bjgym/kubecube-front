import { type ResourceConfig } from '@/config/resources'
import { mergeNetworkPolicySpec, networkPolicyToForm, newNetworkPolicyForm, type NetworkPolicyForm } from '@/domain/network-policy'
import type { KubeResource } from '@/types/api'
import { buildBaseResource, newResourceFormBase, resourceFormBase, validateResourceName } from '../shared'
import type { ResourceFormAdapter, ResourceFormBase } from '../types'

export interface NetworkPolicyEditorForm extends ResourceFormBase {
  network: NetworkPolicyForm
}

/** NetworkPolicy is edited from the cluster network tab and is not part of the workload resource registry. */
export const networkPolicyResourceConfig: ResourceConfig = {
  key: 'networkpolicies',
  plural: 'networkpolicies',
  kind: 'NetworkPolicy',
  group: 'networking.k8s.io',
  version: 'v1',
  namespaced: true,
  title: '网络策略',
  shortTitle: 'NetworkPolicy',
  description: '管理 Pod 网络访问策略',
  canCreate: true,
  canEdit: true,
  columns: [],
  tabs: ['info'],
}

function createEmptyForm(): NetworkPolicyEditorForm {
  return { ...newResourceFormBase(), network: newNetworkPolicyForm() }
}

function fillForm(resource: KubeResource): NetworkPolicyEditorForm {
  return {
    ...resourceFormBase(resource),
    network: networkPolicyToForm(resource.spec as Record<string, any> | undefined),
  }
}

function validate(form: NetworkPolicyEditorForm): string[] {
  return validateResourceName(form.name)
}

function buildResource(form: NetworkPolicyEditorForm, existing?: KubeResource): KubeResource {
  const base = buildBaseResource(networkPolicyResourceConfig, form, existing)
  base.spec = mergeNetworkPolicySpec((base.spec || {}) as Record<string, any>, form.network)
  return base
}

export const networkPolicyFormAdapter: ResourceFormAdapter<NetworkPolicyEditorForm> = {
  key: 'networkpolicies',
  createEmptyForm,
  fillForm,
  validate,
  buildResource,
}
