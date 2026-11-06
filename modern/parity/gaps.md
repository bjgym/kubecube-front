# Known parity gaps

These surfaces are not yet complete under the acceptance rules. They are kept out of
`matrix.md` until the modern entry and evidence exist.

| Area            | Gap                                                                                | Next action                                                                     |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Dashboard table | Column mapping, links and `selectshowable` are incomplete                          | Normalize table options from the Dashboard CR                                   |
| Members         | Member user picker only loads the first 100 accounts; bindings are the source      | Add paginated account search while keeping RoleBinding subjects authoritative   |
| Auth            | No E2E for SSO callback failure or identity 500 retry                              | Add those scenarios; illegal redirect and concurrent 401s are covered           |
| Live coverage   | Login, namespace, workload, pod, log, Service and platform reads are live-verified | Add four-role and write-path live scenarios                                     |
| Visual          | No desktop/mobile visual regression suite                                          | Add Playwright screenshot comparisons for tables, dialogs, selects and terminal |
