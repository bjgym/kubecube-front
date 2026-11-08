# Deploying the modern console

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

## Local UI preview

Use `npm run dev` for UI work and `VITE_USE_MOCK=true` for a backend-independent
preview. A local Docker run of the image serves only static files and cannot proxy
the KubeCube APIs; use the chart deployment for end-to-end checks.
