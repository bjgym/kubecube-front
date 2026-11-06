# Known parity gaps

These surfaces are not yet complete under the acceptance rules. They are kept out of
`matrix.md` until the modern entry and evidence exist.

| Area                  | Gap                                                                                     | Next action                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ConfigMap             | No structured key/value editor; advanced YAML is the only entry                         | Add a ConfigMap type editor with add/edit/delete and unchanged-key preservation                    |
| PrometheusRule        | Only PromQL expression editing; no normal mode object/dimension/metric/threshold/AND/OR | Add a normal-mode rule builder and retain PromQL as advanced mode                                  |
| Global Alertmanager   | Route/receivers only; no global SMTP/WeCom settings                                     | Add structured global SMTP and WeCom fields while preserving YAML                                  |
| LogConfig             | `matchFields` and multiple `inputs` are not structured; only the first input is edited  | Add repeatable inputs and matchFields, preserving untouched inputs                                 |
| PVC                   | StorageClass is free text; Mount By/associated replicas are incomplete                  | Load StorageClass resources into a select and complete the detail facts                            |
| Pod detail            | Row-level YAML/events/delete and Pod eviction action are incomplete                     | Add per-pod actions with confirmations and failure feedback                                        |
| CronJob detail        | Job list cannot drill into a selected Job's Pods                                        | Add Job → Pod selection                                                                            |
| Pod list              | CPU/memory usage columns are absent                                                     | Add monitoring-backed usage with a disabled-monitoring fallback                                    |
| Service detail        | Related pods/Endpoints information is incomplete                                        | Add selector, Endpoints and related pod facts                                                      |
| Log search            | Histogram has no brush time selection; no favorites/export                              | Add brush-to-range, saved queries and export                                                       |
| Dashboard table       | Column mapping, links and `selectshowable` are incomplete                               | Normalize table options from the Dashboard CR                                                      |
| Tenant/project create | Administrator assignment is absent                                                      | Add admin account/role assignment on create                                                        |
| Members               | Member list is derived from the first 100 users                                         | Read RoleBindings/authorization data and paginate                                                  |
| Roles                 | No single policy table consumed by routes and navigation                                | Add one policy module and four-role tests                                                          |
| Audit                 | Menu does not consult `/api/v1/audit/enabled`                                           | Gate the audit entry on both feature and enabled endpoint                                          |
| Auth                  | No E2E for SSO callback failure, identity 500 retry or illegal redirect                 | Add those four scenarios                                                                           |
| Live coverage         | Only login, namespace, deployment, YAML and pod detail are live-verified                | Run the full parity matrix against KubeCube with four accounts                                     |
| Visual                | No desktop/mobile visual regression suite                                               | Add Playwright screenshot comparisons for tables, dialogs, selects and terminal                    |
| Images                | arm64 image was built and inspected but not started on an ARM host                      | Load the image on `parallels` and verify HTTP/static assets/brand                                  |
| Build                 | Brand arguments still exist as both `KUBECUBE_BRAND_NAME` and `VITE_BRAND_NAME`         | Make `VITE_BRAND_NAME` the single documented input and keep a compatibility alias only if required |
