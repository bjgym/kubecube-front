# V2.0.0
## Feature
- rebuild the console with Vue 3, TypeScript, Vite, Pinia and Element Plus while preserving the existing KubeCube API, session, route and workspace-context contracts
- unify responsive application navigation, workspace selection, resource lists and details, forms, monitoring, logs, YAML editing and browser terminals under one design system
- add backend-independent UI preview data and unit coverage for Kubernetes API paths, YAML processing, scope query inheritance and readable resource status
- render monitoring from Dashboard CR variables, rows and graph/table/singleStat panels, falling back explicitly to built-in metrics when a definition is unavailable
- keep Logseer search on its `_search` contract and model log tasks through the dedicated v2 API rather than a Kubernetes CRD, including task-scoped log filters
- preserve unedited workload, Service, Ingress, Secret and rule fields during guided edits; rolling updates change images only, and default image-pull Secrets stay protected
- provide structured workload editing for multi-container/init containers, ports, environment sources, volumes, mounts, probes, affinity, tolerations, strategies, Job/CronJob settings and StatefulSet volume claim templates
- provide structured Service multi-port/headless/external-IP/session-affinity editing and Ingress multi-host/path/TLS editing without dropping unknown fields
- provide typed Secret editors for TLS and dockerconfigjson, full NetworkPolicy ingress/egress peers and ports, and LogConfig labels, multiline, exclusions and retention
- provide multi-group PrometheusRule editing plus AlertmanagerConfig receiver channels for WeCom, email and webhook, including the `kubecube_io_owner` route matcher and labels
- add type-aware resource overviews, Pod container entry points, container mounts/probes/commands, PVC mounted Pods, Deployment current/history Pod filtering, event/Condition auto-refresh and replica scaling from the detail page
- add direct RoleBinding/ClusterRoleBinding subjects to the role page, audit time sorting, node role/instance-type/GPU facts, namespace quota used/hard limits, quota capacity hints and inline quota/member steps in the quick-start wizard
- add a structured global Alertmanager route/receiver editor while retaining the full YAML mode
- validate the console against a live KubeCube 1.8.2 deployment and fix the contracts it exposed: `/clusters/namespaces` returns cluster names rather than cluster objects, direct `#/namespace` loads initialize scope, and a deployment without the monitoring feature enters the console through the deployment list instead of the monitoring dashboard
- keep namespace overview loading within the browser's connection budget: metrics are skipped when monitoring is disabled, resource counts are silent and capped at two concurrent namespaces, and API calls allow 30 seconds for slower clusters
## Build
- build the modern application with Node.js 24 in the container image; remove the node-sass, native-compilation and host-platform build-argument requirements, so plain `docker build` and buildx both work
- expose the modern build, development server, lint and tests through the repository-root npm commands; retain separate legacy commands for migration comparison
- override DOMPurify to the patched 3.4.17 release for the Monaco dependency tree


# V1.3.1
## Feature
- the terminal renders the server's out-of-band `toast` hint — the note that a `kubectl get` table is only a summary — on its own coloured line, in both socket handlers (CloudShell and the container exec dialog). The message contract already reserved the channel; the client had no case for it
## Build
- build the bundle inside the image, so `docker build` no longer needs a prior `npm run build`; the builder is pinned to Node 12.18, the npm registry moves off the retired taobao mirror, and `KUBECUBE_BRAND_NAME` is a build argument
## Bug fix
- the project's namespace selector asks for `project-<name>`, following the platform's ownership label value, which cannot carry the `:` it used to
- a new cluster's network type defaults to `cilium`, matching the backend and the CNI the installer installs, and Cilium joins the network type list. Calico stays in the list: a member cluster is free to run it, and the dialog still falls back to a free text field for anything unlisted

# V1.3.0
## Bug fix
- limiting cluster operations
- alertmanagerConfig operating button cannot click issue
- add logseer switch check
- cluster params missing when control page refresh
## Features
- replace UI components
- adapt to a new logging module
### Dependencies
- [KubeCube v1.8.2](https://github.com/kubecube-io/KubeCube/tree/v1.8.2)
- [WebConsole v1.3.0](https://github.com/kubecube-io/kubecube-webconsole/tree/v1.3.0)
# V1.2.0
## Bug fix
### Platform management
- Fix cluster allocable resources in the tenant quota adjustment page
### Resource management
- Fix create userKey issue
## Features
### Resource management
- Support dry run action for yaml edit
- remove monitor title
- Support configuration for ingress domain suffix
### Dependencies
- [KubeCube v1.2.0](https://github.com/kubecube-io/KubeCube/tree/v1.2.0)
- [WebConsole v1.2.0](https://github.com/kubecube-io/kubecube-webconsole/tree/v1.2.0) 

# V1.1.1
## Bug fix
### Resource management
- Fix imagePullSecrets format 

# V1.0.2
## Bug fix
### Platform management
- Fix project list refresh issue

### Resource management
- Fix kubecube config file download issue
- Fix vaildate rules

# V1.0.1

## Features

### Platform management
- Support tenant, project and member pagenation
- Disable delete pivot-cluster, change node appending link
### Resource management
- Query monitor variables with timing
- Yaml Viewer bugfix

### Dependencies
- [KubeCube v1.0.0](https://github.com/kubecube-io/KubeCube/tree/v1.0.0)
- [WebConsole v1.0.0](https://github.com/kubecube-io/kubecube-webconsole/tree/v1.0.0) 

### Appendix
- Extract [JChart](https://www.npmjs.com/package/@joskii/jchart)


# V1.0.0

## Features

### Platform management
- Support component monitor
- Support global alarm config

### Dependencies
- [KubeCube v1.0.0](https://github.com/kubecube-io/KubeCube/tree/v1.0.0)
- [WebConsole v1.0.0](https://github.com/kubecube-io/kubecube-webconsole/tree/v1.0.0) 

### Appendix
- Extract [JChart](https://www.npmjs.com/package/@joskii/jchart)

# V1.0.0-rc0

## Features

### Platform management
- Support user management
- Support role management
- Support tenant management
- Support tenant quota management
- Support cluster management
- Support namespace management
- Support audit

### Resource management
- Support resource monitor
- Support workload management
- Support service management
- Support storage management
- Support configs management
- Support yaml configs
- Support crd management
- Support cloud shell
- Support log config and search
- Support alarm config