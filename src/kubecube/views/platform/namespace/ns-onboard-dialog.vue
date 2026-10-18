<template>
  <el-dialog
    title="纳管空间"
    :visible.sync="show"
    @close="close"
    width="900px"
    :close-on-click-modal="false"
  >
    <kube-pipe
      v-if="show"
      graph="tenant > project"
      @pipestatechange="pipeLoading = $event"
    >
      <el-form ref="form" :model="model" label-position="right" label-width="120px">
        <el-form-item label="集群">
          <el-input :value="model.cluster" disabled/>
        </el-form-item>
        <el-form-item label="空间名称">
          <el-input :value="model.namespace" disabled/>
        </el-form-item>
        <el-form-item
          label="租户"
          prop="tenant"
          :rules="[
            validators.required(),
          ]"
        >
          <tenantSelect v-model="model.tenant"/>
        </el-form-item>
        <el-form-item
          label="关联项目"
          prop="project"
          :rules="[
            validators.required(),
          ]"
        >
          <project-select
            v-model="model.project"
            auth="writable"
            no-empty
            :tenant="model.tenant && model.tenant.value"
          />
        </el-form-item>
        <!-- The namespace joins the project's tree, so what it holds becomes the
             project's: the members of the project and of its tenant reach it, its
             quota chain admits it, and the project's deletion takes it. -->
        <div v-if="model.project" style="margin: 0 0 20px 120px; color: #FF4D4F;">
          <div>纳管后，空间「{{ model.namespace }}」将加入项目「{{ projectName }}」的资源树：</div>
          <div>该空间中已有的资源将纳入该项目及其租户的权限与配额管理；</div>
          <div>删除项目时，该空间会随项目一起被删除。</div>
        </div>
        <x-request
          v-if="model.cluster && model.tenant && model.project"
          ref="request"
          :service="quotaService"
          :params="params"
          :processor="resolver"
        >
          <template slot-scope="{ loading }">
            <el-form-item label="计算资源">
              <i v-if="loading" class="el-icon-loading" style="font-size: 24px"/>
              <hardQuota
                v-else
                v-model="model.resource"
                prefixProp="resource"
                :availables="availables"
              />
            </el-form-item>
            <el-form-item
              label="存储资源"
              prop="resource.spec.hard.storage"
              :rules="[
                validators.required(),
                validators.consistofNumber(),
                validators.numberBetween(0, availables.storage),
              ]"
            >
              <el-input
                v-model="model.resource.spec.hard.storage"
                style="width: 200px"
              />
              <span style="line-height:32px;margin-left:8px">GiB</span>
            </el-form-item>
          </template>
        </x-request>
      </el-form>
    </kube-pipe>
    <div slot="footer">
      <el-button @click="close">取 消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting">确 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import BigNumber from 'bignumber.js';
import { Modal } from '@micro-app/common/mixins';
import {
    toPlainObject as toResourceQuotaPlainObject,
    toK8SObject as toResourceQuotaK8SObject,
} from 'kubecube/k8s-resources/resourceQuota/index.js';
import {
    toPlainObject as toCubeResourceQoutaPlainObject,
} from 'kubecube/k8s-resources/cubeResourceQuota/index.js';
import {
    toK8SObject as toSubnamespaceK8SObject,
} from 'kubecube/k8s-resources/subnamespace';
import tenantSelect from 'kubecube/elComponent/global/tenant-select.vue';
import projectSelect from 'kubecube/elComponent/global/project-select.vue';
import clusterService from 'kubecube/services/cluster';
import scopeService from 'kubecube/services/scope';
import hardQuota from './el-ns-quota-table.vue';
import * as validators from 'kubecube/utils/validators';

export default {
    components: {
        tenantSelect,
        projectSelect,
        hardQuota,
    },
    mixins: [ Modal ],
    data() {
        return {
            model: {
                cluster: '',
                namespace: '',
                tenant: null,
                project: null,
                resource: toResourceQuotaPlainObject(),
            },
            quotaService: scopeService.getCubeQuotaResourceInstance,
            pipeLoading: false,
            availables: {
                cpu: 0,
                limitsCpu: 0,
                memory: 0,
                limitsMemory: 0,
                gpu: 0,
                storage: 0,
            },
            validators,
            submitting: false,
        };
    },
    computed: {
        projectName() {
            return this.model.project.text || this.model.project.value;
        },
        params() {
            // The CubeResourceQuota is addressed by its name alone: the CR lives
            // in the pivot cluster and its name is `<member cluster>.<tenant>`.
            return {
                pathParams: {
                    name: `${this.model.cluster}.${this.model.tenant.value}`,
                },
            };
        },
    },
    methods: {
        // The unmanaged namespaces the console shows are the ones the platform
        // does not own, so there is nothing to prefill: the namespace and its
        // cluster are what the row already says, and the tenant and project are
        // what the administrator is choosing.
        open(item) {
            this.show = true;
            this.model.cluster = item.cluster;
            this.model.namespace = item.namespace;
        },
        resolver(cubeQuotaResponse) {
            const quota = toCubeResourceQoutaPlainObject(cubeQuotaResponse);
            // The space has no quota of its own yet, so the whole remaining quota
            // of the tenant is available to it.
            Object.assign(this.availables, {
                cpu: +new BigNumber(quota.status.hard.cpu).minus(quota.status.used.cpu),
                limitsCpu: +new BigNumber(quota.status.hard.limitsCpu).minus(quota.status.used.limitsCpu),
                memory: +new BigNumber(quota.status.hard.memory).minus(quota.status.used.memory),
                limitsMemory: +new BigNumber(quota.status.hard.limitsMemory).minus(quota.status.used.limitsMemory),
                gpu: +new BigNumber(quota.status.hard.gpu).minus(quota.status.used.gpu),
                storage: +new BigNumber(quota.status.hard.storage).minus(quota.status.used.storage),
            });
        },
        async submit() {
            try {
                await this.$refs.form.validate();
            } catch (error) {
                console.log(error);
                return;
            }
            try {
                this.submitting = true;
                const { cluster, namespace } = this.model;
                const tenant = this.model.tenant.value;
                const project = this.model.project.value;

                // The backend reads only the name and the two labels out of the
                // space, so it is built the way the create path builds it: the
                // namespace is named here instead of created, which is the whole
                // difference between onboarding and creating a space.
                const space = toSubnamespaceK8SObject({
                    namespace,
                    tenant,
                    project,
                    scope: this.model.project.spec.namespace,
                });

                await clusterService.onboardNamespace({
                    data: {
                        cluster,
                        space,
                        resourceQuota: toResourceQuotaK8SObject({
                            cluster, namespace, tenant, project,
                        }, this.model.resource),
                    },
                });
                this.show = false;
                this.$emit('refresh');
            } catch (error) {
                console.log(error);
            }
            this.submitting = false;
        },
    },
};
</script>

<style module>
.question::after {
    font-size: 16px;
    color: #FF4D4F;
    icon-font: url('kubecube/assets/question.svg');
    cursor: pointer;
}
.unit {
    width: 40px;
}
</style>
