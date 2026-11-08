import { getResourceConfig } from '@/config/resources'
import { mergeServiceSpec, type ServicePortForm } from '@/domain/service'
import type { KubeResource } from '@/types/api'
import { buildBaseResource, keyValuePairs, newResourceFormBase, resourceFormBase, validateResourceName } from '../shared'
import type { KeyValue, ResourceFormAdapter, ResourceFormBase } from '../types'

export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'

export interface ServiceForm extends ResourceFormBase {
  serviceType: ServiceType
  serviceTarget: string
  serviceExternalName: string
  serviceSelector: KeyValue[]
  servicePorts: ServicePortForm[]
  serviceHeadless: boolean
  serviceExternalIps: string
  serviceSessionAffinity: 'None' | 'ClientIP'
  serviceSessionAffinitySeconds: number
}

const serviceKind = getResourceConfig('services')!

function createEmptyForm(): ServiceForm {
  return {
    ...newResourceFormBase(),
    serviceType: 'ClusterIP',
    serviceTarget: '',
    serviceExternalName: '',
    serviceSelector: [],
    servicePorts: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
    serviceHeadless: false,
    serviceExternalIps: '',
    serviceSessionAffinity: 'None',
    serviceSessionAffinitySeconds: 10800,
  }
}

function fillForm(resource: KubeResource): ServiceForm {
  const spec = resource.spec as Record<string, any> | undefined
  return {
    ...resourceFormBase(resource),
    serviceType: String(spec?.type || 'ClusterIP') as ServiceType,
    serviceTarget: '',
    serviceExternalName: String(spec?.externalName || ''),
    serviceSelector: Object.entries((spec?.selector || {}) as Record<string, string>).map(([key, value]) => ({ key, value })),
    servicePorts: (Array.isArray(spec?.ports) ? spec.ports : []).map((port: Record<string, any>) => ({
      name: String(port.name || ''),
      port: Number(port.port || 80),
      targetPort: Number(port.targetPort || port.port || 8080),
      protocol: port.protocol || 'TCP',
      nodePort: port.nodePort ? Number(port.nodePort) : undefined,
    })),
    serviceHeadless: spec?.clusterIP === 'None',
    serviceExternalIps: (Array.isArray(spec?.externalIPs) ? spec.externalIPs : []).join(', '),
    serviceSessionAffinity: spec?.sessionAffinity === 'ClientIP' ? 'ClientIP' : 'None',
    serviceSessionAffinitySeconds: Number(spec?.sessionAffinityConfig?.clientIP?.timeoutSeconds ?? 10800),
  }
}

function validate(form: ServiceForm): string[] {
  return validateResourceName(form.name)
}

function buildResource(form: ServiceForm, existing?: KubeResource): KubeResource {
  const base = buildBaseResource(serviceKind, form, existing)
  base.spec = mergeServiceSpec((base.spec || {}) as Record<string, any>, {
    type: form.serviceType,
    ports: form.servicePorts,
    selector: keyValuePairs(form.serviceSelector),
    editing: Boolean(existing),
    headless: form.serviceHeadless,
    externalIPs: form.serviceExternalIps
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
    sessionAffinity: form.serviceSessionAffinity,
    sessionAffinitySeconds: form.serviceSessionAffinitySeconds,
    externalName: form.serviceExternalName,
  })
  return base
}

export const serviceFormAdapter: ResourceFormAdapter<ServiceForm> = {
  key: 'services',
  createEmptyForm,
  fillForm,
  validate,
  buildResource,
}
