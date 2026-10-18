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
            <div :class="$style.actions">
              <u-button
                color="primary"
                :disabled="!isPlatform || isBuiltin"
                @click="modifyRole"
              >
                修改
              </u-button>
              <u-button
                :disabled="!canDelete"
                @click="deleteRole"
              >
                删除
              </u-button>
            </div>
            <div
              v-if="deleteHint"
              :class="$style.deleteHint"
            >
              {{ deleteHint }}
            </div>
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

// 服务层把失败的响应体本身抛了出来（service.js 的 `throw data || error`），所以
// 服务端给的原因在 e.message 上；e.response.data.message 是 axios 原始错误的
// 形状，只在异常没有经过服务层时才存在。读消息的地方都走这里，免得某一处只认
// 其中一种形状，把服务端的原因丢掉、只剩一句笼统的兜底。
function readErrorMessage(e, fallback) {
    return getFunc(e, 'message') || getFunc(e, 'response.data.message') || fallback;
}

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
            // 服务端对所选角色的回答：持有哪些项、是否内置、有多少用户绑定。
            // 删除能否点，以及为什么不能点，都由它决定，前端不再自己猜。
            roleInfo: null,
            // 读取中的角色信息还不是"读不到"，两者要分开，否则切换角色时会闪出
            // 一句读取失败。
            roleInfoLoading: false,
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
        // 服务端按 aggregationRule 判定内置角色，读到之前先用名字兜底。
        isBuiltin() {
            return this.roleInfo ? this.roleInfo.builtin : this.isBuiltinRole;
        },
        canDelete() {
            // 读不到角色信息时不放开删除，宁可不给点，也不让人点一个服务端会
            // 拒绝的按钮。
            return this.isPlatform && !this.isBuiltin && !!this.roleInfo && this.roleInfo.holders === 0;
        },
        deleteHint() {
            if (this.isBuiltin) return '';
            if (this.roleInfoLoading) return '';
            if (!this.roleInfo) return '角色信息读取失败，暂时无法删除';
            if (this.roleInfo.holders > 0) {
                return `该角色已被 ${this.roleInfo.holders} 个用户使用，无法删除`;
            }
            return '';
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
            this.roleInfo = null;
            this.roleInfoLoading = true;
            this.rules = toTreeModel(this.catalogue, {});
            try {
                const answer = await userService.getRoleAuthItems({ pathParams: { name } });
                this.roleInfo = answer;
                this.rules = toTreeModel(this.catalogue, getFunc(answer, 'items', {}));
            } catch (e) {
                // 读不到勾选态时说明原因，而不是显示一个"全未授予"的假象。
                this.$message({
                    message: `${name} 的权限读取失败`,
                    type: 'error',
                });
            } finally {
                this.roleInfoLoading = false;
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
                    message: readErrorMessage(e, '角色保存失败'),
                    type: 'error',
                });
            }
        },
        deleteRole() {
            const name = this.curIdent.metadata.name;
            this.$confirm({
                title: '删除',
                content: `确认要删除角色 ${name} 吗？删除后无法恢复。`,
                ok: async () => {
                    try {
                        await userService.deleteRoleAuthItems({
                            pathParams: { name },
                        });
                        this.$message({
                            message: '角色已删除',
                            type: 'success',
                        });
                        this.refresh();
                    } catch (e) {
                        // 删除失败时角色还在页面上，把服务端的原因说出来。
                        this.$message({
                            message: readErrorMessage(e, '角色删除失败'),
                            type: 'error',
                        });
                    }
                },
            });
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
.actions{
    position: absolute;
    right: 20px;
    top: 20px;
    display: flex;
    align-items: center;
}
.actions > * + *{
    margin-left: 10px;
}
.deleteHint{
    position: absolute;
    right: 20px;
    top: 60px;
    color: #FF4D4F;
    font-size: 12px;
}
</style>
