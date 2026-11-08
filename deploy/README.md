# Deploying the console

The Helm chart is the only supported deployment path for the console. The image built
from this repository contains the static Vite bundle only; the chart owns the nginx
reverse proxy, health endpoint and cache policy. Do not deploy a second
`kubecube-frontend-modern` Deployment or a second NodePort Service beside the chart.

## What the chart provides

`kubecube-chart` renders, in `kubecube-system`:

- Deployment `frontend`, using `global.images.frontend` and the `nginx-config` ConfigMap;
- Service `frontend-nodeport` on NodePort `30080`;
- `nginx-config`, which serves `/public/`, proxies `/api/v1/cube`, `/api/v1/audit`,
  `/api/v1/webconsole`, `/webconsole/api/sockjs`, Prometheus and Logseer, answers
  `/healthz`, and redirects `/` to `/public/`;
- cache policy: `public/index.html` is never cached, while hashed files under
  `public/assets/` are cached for a year.

The image itself therefore needs no `/healthz`, no API proxy and no custom port. It
listens on nginx's default port `80`.

## Build

```shell
# current architecture
make image IMG=<registry>/<project>/frontend:<tag>

# amd64 + arm64 manifest (requires buildx and a registry login)
make image-multi-arch IMG=<registry>/<project>/frontend:<tag>
```

`make image-multi-arch` uses `Dockerfile.multiarch`; the TypeScript/Vite build always
runs on the build host, so no architecture-specific native compilation is involved.

## Install and verify

```shell
helm lint kubecube-chart
helm template kubecube kubecube-chart >/dev/null
helm upgrade --install kubecube kubecube-chart -n kubecube-system --create-namespace
kubectl -n kubecube-system rollout status deploy/frontend
curl -fsS http://<nodeIP>:30080/healthz
curl -fsS http://<nodeIP>:30080/public/ >/dev/null
```

Then log in through `http://<nodeIP>:30080/public/` and check the four workspace
selectors, a resource list, the container terminal and the log page. The Live
Playwright suite (`npm run test:e2e:live`) can target the same NodePort through the
`KUBECUBE_LIVE_BASE_URL` environment variable; it does not need a second deployment.

## Live verification prerequisites

The Live suite needs the platform features it exercises to be enabled:
`kubecube-monitoring` for the dashboard and alert pages, `logseer` for log search and
LogConfig, and `audit` for the audit page. The chart's `global.hotPlugEnable` values are
the source of those switches; the resulting `kubecube-feature-config` ConfigMap is
written by the platform's hotplug reconciliation.

In this verification environment the hotplug CRs are in `phase=fail` because the chart
packages they reference are missing from the hotplug package directory. Patching
`kubecube-feature-config` to `kubecube-monitoring: enabled` and `logseer: enabled` is a
**test prerequisite only**; the platform can reconcile the ConfigMap back to the
hotplug state, so it must be re-applied before a Live run. Do not treat the patch as a
durable platform configuration. The Logseer service is the test-only adapter under
`test-support/logseer-adapter`, not a production Logseer deployment.

For a local browser or Playwright run against a remote cluster, forward the chart's
Service instead of hardcoding a ClusterIP:

```shell
kubectl -n kubecube-system port-forward svc/frontend-nodeport 30080:80
# Only needed when the console is served by the Vite dev server rather than by the
# chart's nginx:
kubectl -n kubecube-system port-forward svc/webconsole 19081:9081
```

## Local UI preview

Use `npm run dev` for UI work and `VITE_USE_MOCK=true` for a backend-independent
preview. A local Docker run of the image serves only static files and cannot proxy
the KubeCube APIs; use the chart deployment for end-to-end checks.
