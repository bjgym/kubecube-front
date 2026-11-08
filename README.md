# KubeCube Frontend

[![License](http://img.shields.io/badge/license-apache%20v2-blue.svg)](https://github.com/kubecube-io/kubecube/blob/main/LICENSE)

KubeCube Frontend is the web console for KubeCube: multi-cluster and multi-tenant
Kubernetes resource management, platform administration, observability, YAML authoring,
log search and browser terminals.

The application is a Vue 3 + TypeScript + Vite single-page app. The former Vue 2
implementation has been removed; this repository now builds and ships only the Vue 3
console.

## Architecture

- Vue 3, TypeScript, Vite, Vue Router and Pinia
- Element Plus with shared CSS design tokens, compact/comfortable density and responsive
  layouts
- Typed API modules that preserve the KubeCube API, session and workspace contracts
- ECharts, Monaco Editor and xterm.js loaded behind lazy boundaries
- A single page-policy table for routing and navigation authorization
- Vitest unit tests, Playwright mock/visual E2E and a Live backend suite

## Requirements

- Node.js 22.12 or later
- A KubeCube deployment for real API access

## Install and run

```shell
npm ci
npm run dev
```

Open `http://localhost:4330/public/`. The development server uses hash-based routes and
serves the application under `/public/`.

Copy `.env.example` to `.env.local` to change API proxy targets. The available targets
are the Cube API, monitoring, Logseer, WebConsole and audit services.

For a backend-independent UI preview, set the following in `.env.local`:

```dotenv
VITE_USE_MOCK=true
```

Mock mode is for interface verification only. It does not validate Kubernetes behavior,
permissions or backend compatibility.

## Verify

```shell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run the Chromium end-to-end suite:

```shell
npx playwright install chromium
npm run test:e2e
```

The suite starts a mock-backed development server when one is not already running and
covers login, workspace selection, cross-cluster scope, resource lists and details,
workload/Service/Ingress/Secret/NetworkPolicy/AlertmanagerConfig guided editors,
container and PVC details, Monaco YAML editing and importing, platform administration,
role bindings, audit sorting, quota capacity hints, Dashboard CR panels, Logseer task
filtering and mobile overflow.

The Live suite exercises the same UI against a running KubeCube API. Start the console
with a live target (for example through an SSH tunnel), then set the account explicitly:

```shell
KUBECUBE_LIVE_BASE_URL=http://127.0.0.1:30080 \
KUBECUBE_LIVE_USER=admin \
KUBECUBE_LIVE_PASSWORD='<password>' \
npm run test:e2e:live
```

`VITE_USE_MOCK` must be `false` and the API proxy targets must point at the KubeCube
endpoint used by the console. The Live suite is not part of the mock `test:e2e` run and
does not ship credentials.

## Container image

The bundle is built inside the image, so a local production build is not required:

```shell
docker build -t kubecube/frontend:dev .
```

`make image` builds for the current architecture. `make image-multi-arch` uses
`Dockerfile.multiarch` to build and push an amd64+arm64 manifest. Set the product name at
build time when needed:

```shell
docker build -t kubecube/frontend:dev --build-arg VITE_BRAND_NAME="My Cloud" .
```

The image is a static bundle behind stock nginx on port 80. The Helm chart is the only
supported deployment path: it supplies the nginx reverse proxy, `/healthz`, cache policy
and the NodePort Service. See [deploy/README.md](deploy/README.md) for the build, install
and verification contract.

## License

Copyright 2021 KubeCube Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
