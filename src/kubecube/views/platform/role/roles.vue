<template>
  <u-linear-layout direction="vertical">
    <u-linear-layout direction="horizontal">
      <u-button
        icon="create"
        color="primary"
        :disabled="!isPlatform"
        @click="addRole"
      >
        添加角色
      </u-button>
    </u-linear-layout>

    <x-request
      ref="request"
      :service="service"
      :params="params"
      :processor="resolver"
    >
      <template slot-scope="{ loading, error }">
        <div :class="$style.wrapper">
          <u-loading v-if="loading" />
          <template v-else-if="error">
            获取数据失败，请
            <u-link @click="refresh">
              重试
            </u-link>
          </template>
          <template v-else>
            <div :class="$style.nav">
              <u-button
                v-for="name in identityNames"
                :key="name"
                :class="$style.navbtn"
                :color="name === curIdent.metadata.name ? 'primary' : 'normal' "
                @click="choose(name)"
              >
                {{ name }}
              </u-button>
            </div>
            <div :class="$style.content">
              <kube-tree
                v-model="rules"
                :disabled="!isPlatform || isBuiltinRole"
                :disabled-keys="ungrantable"
                title="资源权限"
              />
            </div>
            <u-button
              color="primary"
              :class="$style.modifyBtn"
              :disabled="!isPlatform || isBuiltinRole"
              @click="modifyRole"
            >
              修改
            </u-button>
          </template>
        </div>
      </template>
    </x-request>
    <role-dialog
      ref="roleDialog"
      @refresh="refresh"
    />
  </u-linear-layout>
</template>

<script>
import { get as getFunc } from 'lodash';
import { get } from 'vuex-pathify';
import userService from 'kubecube/services/user';
import {
    toTreeModel,
    toItems,
    ungrantableItems,
} from 'kubecube/k8s-resources/role';
import {
    setValueIfListNotPresent,
} from 'kubecube/utils/functional';
import roleDialog from './role-dialog.vue';
import {
    ROLES,
} from 'kubecube/utils/constance';
export default {
    metaInfo() {
        let current = '';
        switch (this.$route.params.identity) {
            case 'platform':
                current = '平台角色';
                break;
            case 'tenant':
                current = '租户角色';
                break;
            case 'project':
                current = '项目角色';
                break;
            default:
        }
        return {
            title: `${current} - kubecube`,
        };
    },
    components: {
        roleDialog,
    },
    data() {
        return {
            service: userService.getAuthRole,
            identities: [],
            curIdent: null,
            // 有哪些项可授予，来自服务端；角色持有什么只决定勾选态。
            catalogue: { items: {} },
            rules: {},
        };
    },
    computed: {
        userRole: get('scope/userRole'),
        globalLoading: get('scope/loading'),
        isPlatform() {
            return this.userRole[ROLES.PLATFORM_ADMIN];
        },
        identity() {
            return this.$route.params.identity;
        },
        params() {
            return {
                params: {
                    level: this.identity,
                },
            };
        },
        identityNames() {
            return this.identities.map(i => i.metadata.name);
        },
        isBuiltinRole() {
            return !!this.curIdent && this.curIdent.metadata.name === `${this.identity}-admin`;
        },
        ungrantable() {
            return ungrantableItems(this.catalogue, this.identity);
        },
    },
    async created() {
        await this.loadCatalogue();
    },
    methods: {
        async loadCatalogue() {
            try {
                this.catalogue = (await userService.getAuthCatalogue()) || { items: {} };
            } catch (e) {
                this.$message({
                    message: '权限目录读取失败，页面上的项可能不完整',
                    type: 'error',
                });
            }
        },
        resolver(response) {
            const data = (response.items || []);
            // 内置角色排在最前，其余按名称排序。原来那个只比较第一个参数的
            // sort 既不成立，也把"模板角色"的概念带了进来。
            const builtin = `${this.identity}-admin`;
            data.sort((a, b) => {
                if (a.metadata.name === builtin) return -1;
                if (b.metadata.name === builtin) return 1;
                return a.metadata.name.localeCompare(b.metadata.name);
            });
            this.identities = data;
            setValueIfListNotPresent({
                list: this.identities,
                path: 'metadata.name',
                current: getFunc(this.curIdent, 'metadata.name'),
            }, val => {
                this.choose(val.metadata.name);
            });
            return true;
        },
        refresh() {
            this.$refs.request.request();
        },
        async choose(name) {
            const chosen = this.identities.find(i => i.metadata.name === name);
            if (!chosen) return;
            this.curIdent = chosen;
            this.rules = toTreeModel(this.catalogue, {});
            try {
                const answer = await userService.getRoleAuthItems({ pathParams: { name } });
                this.rules = toTreeModel(this.catalogue, getFunc(answer, 'items', {}));
            } catch (e) {
                // 读不到勾选态时说明原因，而不是显示一个"全未授予"的假象。
                this.$message({
                    message: `${name} 的权限读取失败`,
                    type: 'error',
                });
            }
        },
        addRole() {
            this.$refs.roleDialog.open();
        },
        async modifyRole() {
            try {
                await userService.saveRoleAuthItems({
                    pathParams: {
                        name: this.curIdent.metadata.name,
                    },
                    data: {
                        scope: this.identity,
                        items: toItems(this.rules, this.ungrantable),
                    },
                });
                this.$message({
                    message: '角色已保存',
                    type: 'success',
                });
                this.refresh();
            } catch (e) {
                // 保存失败时保留页面上的勾选，让人改完再存。
                this.$message({
                    message: getFunc(e, 'response.data.message') || '角色保存失败',
                    type: 'error',
                });
            }
        },
    },
};
</script>

<style module>
.wrapper{
    position: relative;
    height: calc(100vh - 275px);
    display: flex;
    flex-direction: row;
    border: 1px solid #e1e8ed;
}
.nav{
    width: 190px;
    height: 100%;
    overflow: scroll;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    border-right: 1px solid #e1e8ed;
    padding: 10px;
}
.navbtn{
    width: 160px;
}
.navbtn + .navbtn{
    margin-top: 5px;
}
.content{
    position: relative;
    flex: 1;
    height: 100%;
    overflow: scroll;
    padding: 10px;
}
.modifyBtn{
    position: absolute;
    right: 20px;
    top: 20px;
}
</style>
