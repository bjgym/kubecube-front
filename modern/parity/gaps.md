# Known parity gaps

These surfaces are not yet complete under the acceptance rules. They are kept out of
`matrix.md` until the modern entry and evidence exist.

| Area            | Gap                                                                                                                                                             | Next action                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Dashboard table | Column mapping and `selectshowable` are covered; row-level resource links are not                                                                               | Add link templates from Dashboard styles and verify them against a live dashboard |
| Live coverage   | Login, namespace, workloads, pod, log, Service, ConfigMap, Ingress, Secret, PVC, NetworkPolicy and four-role identities are live-verified                       | Add live UI menu checks for tenant/project/normal roles and remaining writes      |
| Monitoring live | The live cluster has no Prometheus CRDs and no Logseer service; dashboard, log search, LogConfig, PrometheusRule and AlertmanagerConfig cannot be live-verified | Install monitoring/logseer or point the proxy at reachable services               |
| OpenAPI keys    | KubeCube cannot list `keys.user.kubecube.io` (RBAC forbidden), so key creation hangs and cannot be live-verified                                                | Fix the chart's Key CRD RBAC and retry the contract test                          |
| Visual          | Login, user table, tenant dialog and mobile namespace baselines exist; terminal and log-search surfaces lack baselines                                          | Extend visual snapshots to terminal and log-search surfaces                       |
