# V1.3.1
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