import Service from './service';

import { userInterceptor } from './interceptor';
const userService = Service({
    baseURL: '/api/v1/cube/',
    apis: {
        login: {
            url: '/login',
            method: 'post',
        },
        gitHubLogin: {
            url: '/oauth/redirect',
            method: 'get',
        },
        getConfigmap: {
            template: '/extend/configmap/{name}',
            method: 'get',
        },
        getUserList: {
            url: '/user',
            method: 'get',
            withCredentials: true,
        },
        createUser: {
            url: '/user',
            method: 'post',
            withCredentials: true,
        },
        validateUser: {
            template: '/user/valid/{name}',
            method: 'get',
        },
        modifyUser: {
            template: '/user/{user}',
            method: 'put',
            withCredentials: true,
        },
        modifyPwd: {
            url: '/user/pwd',
            method: 'put',
        },
        getUserTemplate: {
            url: '/user/template',
            method: 'get',
            responseType: 'blob',
            headers: {
                Accept: 'application/octet-stream',
            },
        },
        batchCreateUser: {
            url: '/user/users',
            method: 'post',
        },
        getUserRole: {
            url: '/authorization/roles',
            method: 'get',
        },
        getUserIdenties: {
            url: '/authorization/identities',
            method: 'get',
        },
        getUserTenants: {
            url: '/authorization/tenants',
            method: 'get',
        },
        getUserProjects: {
            url: '/authorization/projects',
            method: 'get',
        },
        getAuthRole: {
            url: '/authorization/clusterroles',
            method: 'get',
        },
        // 权限目录：有哪些项可授予、各自可在哪些层级授予。列表来自服务端，
        // 控制台只负责渲染。
        getAuthCatalogue: {
            url: '/authorization/catalogue',
            method: 'get',
        },
        // 一个角色持有哪些项（勾选态）。写入的是 items，不是 rules。
        getRoleAuthItems: {
            template: '/authorization/roles/{name}',
            method: 'get',
        },
        saveRoleAuthItems: {
            template: '/authorization/roles/{name}',
            method: 'put',
        },
        getUserKey: {
            url: '/key',
            method: 'get',
        },
        createUserKey: {
            url: '/key/create',
            method: 'post',
        },
        removeUserKey: {
            url: '/key',
            method: 'delete',
        },
        createRoleBindings: {
            url: '/authorization/bindings',
            method: 'post',
        },
        deleteRoleBinding: {
            url: '/authorization/bindings',
            method: 'delete',
        },
        getKubeconfigs: {
            url: '/user/kubeconfigs',
            method: 'get',
            responseType: 'blob', // Important
        },

        createNSQuota: {
            method: 'post',
            url: '/clusters/nsquota',
        },

        getFeatures: {
            method: 'get',
            url: 'extend/feature-config',
        },
        getUserResourcesPermission: {
            method: 'post',
            url: '/authorization/resources',
        },
    },
});

userInterceptor(userService.axiosInstance);

export default userService;
/*
export async function login(data){
    return await userService.request({
        url: '/login',
        method: 'post',
        data,
    });
}

export async function getUserList(params) {
    return await userService.request({
        url: '/user',
        method: 'get',
        params,
        withCredentials: true,
    });
}

export async function createUser(data) {
    return await userService.request({
        url: '/user',
        method: 'post',
        data,
        withCredentials: true,
    });
}

export async function modifyUser(user, data) {
    return await userService.request({
        url: `/user/${user}`,
        method: 'put',
        data,
        withCredentials: true,
    });
}

export async function getUserTemplate() {
    const response = await userService.request({
        url: '/user/getImportTemplate',
        method: 'get',
        responseType: 'blob',
        headers: {
            'Accept': 'application/octet-stream'
        }
    });
    jsFileDownload(response.data, 'UserTemplate.csv');
}

export async function batchCreateUser(data) {
    return await userService.request({
        url: '/user/createUserByCsv',
        method: 'post',
        data,
    });
}*/
