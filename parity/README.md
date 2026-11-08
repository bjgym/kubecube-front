# Console parity baseline (historical)

This directory is the auditable migration checklist from the Vue 2 console to the
Vue 3 console. The legacy Vue 2 tree has been removed; this record is retained so the
operation coverage, request contracts and evidence stay reviewable.

## Status values

Only these values are valid in `matrix.md`:

- `Implemented` — the console entry exists, but no browser or backend evidence yet.
- `Mock verified` — unit or Mock browser evidence exists; no live backend evidence.
- `Live verified` — the operation passed against a real KubeCube backend.
- `Intentional difference` — the legacy behavior is deliberately not reproduced; the
  reason is recorded in the row.
- `Blocked` — an external dependency prevents verification; the dependency is named.

`gaps.md` records surfaces that do not yet have a console entry. A row moves into
`matrix.md` only after the entry exists.

## Evidence commands

```shell
cd kubecube-front
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:e2e:live
npm run build
```

The live suite needs `VITE_USE_MOCK=false`, a running KubeCube endpoint, and
`KUBECUBE_LIVE_PASSWORD`. Credentials are never committed.

## Rules

- A guided editor is not complete because the advanced YAML mode can express the field.
- A request row records method, path, query/body shape and response parsing.
- An edit must preserve unknown fields and fields the user did not touch.
- A legacy surface that is commented out, unreachable or broken is recorded as an
  intentional difference, not copied mechanically.
- Backend-corrected legacy bugs are not reproduced for compatibility.
