import { describe, expect, it } from 'vitest'
import { pvcPodsPath, resourcePath, type ResourceDefinition } from '@/api/resource'

const deployment: ResourceDefinition = { plural: 'deployments', kind: 'Deployment', group: 'apps', version: 'v1', namespaced: true }
const namespace: ResourceDefinition = { plural: 'namespaces', kind: 'Namespace', group: '', version: 'v1', namespaced: false }
const crd: ResourceDefinition = {
  plural: 'customresourcedefinitions',
  kind: 'CustomResourceDefinition',
  group: 'apiextensions.k8s.io',
  version: 'v1',
  namespaced: false,
}

describe('resourcePath', () => {
  it('builds a namespaced apps/v1 list path', () => {
    expect(resourcePath(deployment, { cluster: 'prod', namespace: 'shop' })).toBe(
      '/api/v1/cube/proxy/clusters/prod/apis/apps/v1/namespaces/shop/deployments',
    )
  })
  it('builds a named resource path and encodes path parameters', () => {
    expect(resourcePath(deployment, { cluster: 'prod/east', namespace: 'team a', name: 'web/blue' }, true)).toBe(
      '/api/v1/cube/proxy/clusters/prod%2Feast/apis/apps/v1/namespaces/team%20a/deployments/web%2Fblue',
    )
  })
  it('keeps core and CRD cluster-scoped APIs distinct', () => {
    expect(resourcePath(namespace, { cluster: 'pivot' })).toBe('/api/v1/cube/proxy/clusters/pivot/api/v1/namespaces')
    expect(resourcePath(crd, { cluster: 'pivot' })).toBe(
      '/api/v1/cube/proxy/clusters/pivot/apis/apiextensions.k8s.io/v1/customresourcedefinitions',
    )
  })
  it('builds the backend PVC workload path and encodes names', () => {
    expect(pvcPodsPath('prod/east', 'team a', 'data/claim')).toBe(
      '/api/v1/cube/extend/clusters/prod%2Feast/namespaces/team%20a/pvcworkloads/data%2Fclaim',
    )
  })
})
