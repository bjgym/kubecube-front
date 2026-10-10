import Service from './service';
import { userInterceptor } from './interceptor';
// const controlCluster = 'pivot-cluster';
import store from 'kubecube/store';
// const rbac = 'rbac.authorization.k8s.io';
const service = Service({
    baseURL: `/api/v1/cube/proxy/clusters/${store.get('scope/controlClusterList')[0].clusterName}`,
    apis: {
        // getClusterRoleBindings: {
        //     template: '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings',
        //     method: 'get',
        // },
        getRoleBindings: {
            template: '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings',
            method: 'get',
        },
        createRoleBindings: {
            template: '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings',
            method: 'post',
        },
        deleteRoleBinding: {
            template: '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings/{name}',
            method: 'delete',
        },

        // createRole 与 patchRole 曾经在这里，直接向集群写 ClusterRole 的
        // rules。规则现在只由服务端从权限目录派生，客户端提交的是 items，
        // 所以这两条路径被删掉，而不是留着等下一次被误用。
        // createScope: {
        //     template: '/apis/tenant.kubecube.io/v1/{scope}',
        //     method: 'post',
        // },
        // patchScope: {
        //     template: '/apis/tenant.kubecube.io/v1/{scope}/{name}',
        //     method: 'patch',
        //     headers: {
        //         'Content-Type': 'application/merge-patch+json',
        //     },
        // },
        // getScope: {
        //     template: '/apis/tenant.kubecube.io/v1/{scope}/{name}',
        //     method: 'post',
        // },
        // deleteScope: {
        //     template: '/apis/tenant.kubecube.io/v1/{scope}/{name}',
        //     method: 'delete',
        // },
    },
});

userInterceptor(service.axiosInstance);
export default service;
