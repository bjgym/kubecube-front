# KubeCube-front

[![License](http://img.shields.io/badge/license-apache%20v2-blue.svg)](https://github.com/kubecube-io/kubecube/blob/main/LICENSE)

KubeCube-front is the web console for KubeCube. The application in `modern/` provides multi-cluster, multi-tenant Kubernetes resource management, platform administration, observability, YAML authoring, log search and browser terminals.

## Architecture

- Vue 3, TypeScript, Vite, Vue Router and Pinia
- Element Plus with shared CSS design tokens and responsive layouts
- Axios service modules that preserve the KubeCube API and session contracts
- ECharts, Monaco Editor and xterm.js behind isolated UI components
- Vitest unit tests and ESLint static checks

The Vue 2 implementation remains under `src/` for migration comparison. Its generated `dll/` and vendored libraries must not be edited by hand.

## Requirements

- Node.js 22.12 or later
- A KubeCube deployment for real API access

## Install and run

```shell
npm --prefix modern ci
npm run dev
```

Open `http://localhost:4330/public/`. The development server uses hash-based routes and serves the application under `/public/`.

Copy `modern/.env.example` to `modern/.env.local` to change API proxy targets. The available targets are the Cube API, monitoring, Logseer, WebConsole and audit services.

For a backend-independent UI preview, set the following in `modern/.env.local`:

```dotenv
VITE_USE_MOCK=true
```

Mock mode is for interface verification only. It does not validate Kubernetes behavior, permissions or backend compatibility.

## Verify

```shell
npm run eslint
npm run test
npm run build
```

These commands delegate to the modern application. To run the same checks directly, use `npm run lint`, `npm test` and `npm run build` from `modern/`.

Run the Chromium end-to-end suite from `modern/`:

```shell
npx playwright install chromium
npm run test:e2e
```

The suite starts a mock-backed development server when one is not already running and covers login, workspace selection, cross-cluster scope, resource lists and details, workload/Service/Ingress/Secret/NetworkPolicy/AlertmanagerConfig guided editors, container and PVC details, Monaco YAML editing and importing, platform administration, role bindings, audit sorting, quota capacity hints, Dashboard CR panels, Logseer task filtering and mobile overflow.

### Live backend suite

The live suite exercises the same UI against a running KubeCube API. Start the frontend with a live target (for example through an SSH tunnel), then set the account explicitly:

```shell
cd modern
KUBECUBE_LIVE_BASE_URL=http://127.0.0.1:4331 \
KUBECUBE_LIVE_USER=admin \
KUBECUBE_LIVE_PASSWORD='<password>' \
npm run test:e2e:live
```

`VITE_USE_MOCK` must be `false` and `VITE_CUBE_TARGET` must point at the KubeCube endpoint used by the frontend. The live suite is not part of the mock `test:e2e` run and does not ship credentials.

The legacy commands remain available as `npm run dev:legacy`, `npm run build:legacy` and `npm run eslint:legacy`; they use the old Node.js 12 toolchain and dependencies.

## Container image

The bundle is built inside the image, so a local production build is not required:

```shell
docker build -t kubecube/frontend:dev .
```

`make image` builds for the current architecture. `make image-multi-arch` uses `Dockerfile.multiarch` to build and push an amd64+arm64 manifest. Set the product name at build time when needed:

```shell
docker build -t kubecube/frontend:dev --build-arg VITE_BRAND_NAME="My Cloud" .
```

Deploy the resulting image as the frontend Deployment in the `kubecube-system` namespace.

## License

Copyright 2021 KubeCube Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
