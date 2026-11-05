<template>
  <div class="pod-settings">
    <section class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>Pod 存储卷</h3>
          <p>定义后可在各容器的“挂载卷”中按名称引用；不支持的卷类型会原样保留。</p>
        </div>
        <el-button text type="primary" @click="addVolume"
          ><el-icon><Plus /></el-icon>添加存储卷</el-button
        >
      </div>
      <div v-if="!model.volumes.length" class="settings-empty">暂未定义 Pod 存储卷</div>
      <div v-for="(volume, index) in model.volumes" :key="index" class="volume-card">
        <div class="volume-row">
          <el-input v-model="volume.name" placeholder="卷名称，例如 data" />
          <el-select v-model="volume.type" aria-label="存储卷类型">
            <el-option label="PVC" value="persistentVolumeClaim" />
            <el-option label="ConfigMap" value="configMap" />
            <el-option label="Secret" value="secret" />
            <el-option label="EmptyDir" value="emptyDir" />
            <el-option label="HostPath" value="hostPath" />
            <el-option v-if="volume.type === 'other'" label="其他（保留原配置）" value="other" />
          </el-select>
          <el-input
            v-if="['persistentVolumeClaim', 'configMap', 'secret', 'hostPath'].includes(volume.type)"
            v-model="volume.source"
            :placeholder="sourcePlaceholder(volume.type)"
          />
          <template v-if="volume.type === 'emptyDir'">
            <el-select v-model="volume.medium" aria-label="EmptyDir 介质">
              <el-option label="节点磁盘" value="" />
              <el-option label="内存" value="Memory" />
            </el-select>
            <el-input v-model="volume.sizeLimit" placeholder="容量限制，例如 512Mi" />
          </template>
          <el-select v-if="volume.type === 'hostPath'" v-model="volume.hostPathType" aria-label="HostPath 类型">
            <el-option value="DirectoryOrCreate" /><el-option value="Directory" /><el-option value="FileOrCreate" /><el-option
              value="File"
            /><el-option value="Socket" /><el-option value="CharDevice" /><el-option value="BlockDevice" />
          </el-select>
          <el-checkbox v-if="volume.type === 'persistentVolumeClaim'" v-model="volume.readOnly">只读</el-checkbox>
          <el-checkbox v-if="['configMap', 'secret'].includes(volume.type)" v-model="volume.optional">可选</el-checkbox>
          <el-button text type="danger" aria-label="删除存储卷" @click="model.volumes.splice(index, 1)"
            ><el-icon><Delete /></el-icon
          ></el-button>
        </div>
        <code v-if="volume.type === 'other'" class="raw-volume">{{ JSON.stringify(volume.raw) }}</code>
      </div>
    </section>

    <section v-if="configKey === 'statefulsets'" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>存储声明模板</h3>
          <p>StatefulSet 会为每个副本创建独立 PVC；在容器挂载中按模板名称引用。</p>
        </div>
        <el-button
          text
          type="primary"
          @click="model.volumeClaimTemplates.push({ name: '', storageClassName: '', storage: '10Gi', accessMode: 'ReadWriteOnce' })"
          ><el-icon><Plus /></el-icon>添加声明模板</el-button
        >
      </div>
      <div v-if="!model.volumeClaimTemplates.length" class="settings-empty">暂无存储声明模板</div>
      <div v-for="(template, index) in model.volumeClaimTemplates" :key="index" class="claim-template-row">
        <el-input v-model="template.name" placeholder="模板名称，例如 data" />
        <el-input v-model="template.storageClassName" placeholder="StorageClass" />
        <el-input v-model="template.storage" placeholder="容量，例如 10Gi" />
        <el-select v-model="template.accessMode">
          <el-option label="ReadWriteOnce" value="ReadWriteOnce" />
          <el-option label="ReadOnlyMany" value="ReadOnlyMany" />
          <el-option label="ReadWriteMany" value="ReadWriteMany" />
        </el-select>
        <el-button text type="danger" aria-label="删除声明模板" @click="model.volumeClaimTemplates.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section class="settings-section settings-grid">
      <div>
        <div class="settings-heading">
          <div>
            <h3>镜像拉取密钥</h3>
            <p>对应 Pod 的 imagePullSecrets。</p>
          </div>
        </div>
        <div class="tag-input">
          <el-tag v-for="secret in model.imagePullSecrets" :key="secret" closable @close="removeSecret(secret)">{{ secret }}</el-tag>
          <el-input v-model="secretDraft" placeholder="Secret 名称，回车添加" @keyup.enter="addSecret" />
        </div>
      </div>
      <div>
        <div class="settings-heading">
          <div>
            <h3>调度约束</h3>
            <p>节点选择器与主机网络。</p>
          </div>
        </div>
        <el-switch v-model="model.hostNetwork" active-text="使用主机网络 hostNetwork" />
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>节点选择器</h3>
          <p>Pod 只会调度到同时匹配全部标签的节点。</p>
        </div>
        <el-button text type="primary" @click="model.nodeSelector.push({ key: '', value: '' })"
          ><el-icon><Plus /></el-icon>添加选择器</el-button
        >
      </div>
      <div v-for="(selector, index) in model.nodeSelector" :key="index" class="pair-row">
        <el-input v-model="selector.key" placeholder="节点标签，例如 node-pool" />
        <el-input v-model="selector.value" placeholder="标签值，例如 gpu" />
        <el-button text type="danger" aria-label="删除节点选择器" @click="model.nodeSelector.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section v-for="group in affinityGroups" :key="group.key" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>{{ group.title }}</h3>
          <p>{{ group.description }}</p>
        </div>
        <el-button text type="primary" @click="group.terms.push(newAffinityTerm())"
          ><el-icon><Plus /></el-icon>添加规则</el-button
        >
      </div>
      <div v-if="!group.terms.length" class="settings-empty">暂无{{ group.title }}规则</div>
      <div v-for="(term, termIndex) in group.terms" :key="termIndex" class="affinity-card">
        <div class="policy-rule-head">
          <strong>规则 {{ termIndex + 1 }}</strong>
          <el-button text type="danger" @click="group.terms.splice(termIndex, 1)">删除规则</el-button>
        </div>
        <div v-for="(expression, expressionIndex) in term.expressions" :key="expressionIndex" class="affinity-row">
          <el-input v-model="expression.key" placeholder="标签键，例如 topology.kubernetes.io/zone" />
          <el-select v-model="expression.operator">
            <el-option v-for="operator in group.operators" :key="operator" :label="operator" :value="operator" />
          </el-select>
          <el-input
            v-model="expression.value"
            :disabled="['Exists', 'DoesNotExist'].includes(expression.operator)"
            placeholder="值，多个用空格分隔"
          />
          <el-button text type="danger" aria-label="删除表达式" @click="term.expressions.splice(expressionIndex, 1)"
            ><el-icon><Delete /></el-icon
          ></el-button>
        </div>
        <el-button text type="primary" @click="term.expressions.push({ key: '', operator: 'In', value: '' })">添加表达式</el-button>
        <div v-if="group.topology" class="affinity-placement">
          <label><span>拓扑域</span><el-input v-model="term.topologyKey" placeholder="kubernetes.io/hostname" /></label>
          <label><span>作用命名空间（选填）</span><el-input v-model="term.namespace" placeholder="默认当前空间" /></label>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>容忍</h3>
          <p>允许 Pod 调度到带指定污点的节点。</p>
        </div>
        <el-button text type="primary" @click="model.tolerations.push({ key: '', operator: 'Equal', value: '', effect: '' })"
          ><el-icon><Plus /></el-icon>添加容忍</el-button
        >
      </div>
      <div v-for="(toleration, index) in model.tolerations" :key="index" class="toleration-row">
        <el-input v-model="toleration.key" placeholder="污点 Key" />
        <el-select v-model="toleration.operator">
          <el-option label="Equal" value="Equal" /><el-option label="Exists" value="Exists" />
        </el-select>
        <el-input v-model="toleration.value" :disabled="toleration.operator === 'Exists'" placeholder="污点值" />
        <el-select v-model="toleration.effect">
          <el-option label="全部效果" value="" /><el-option label="NoSchedule" value="NoSchedule" /><el-option
            label="PreferNoSchedule"
            value="PreferNoSchedule"
          /><el-option label="NoExecute" value="NoExecute" />
        </el-select>
        <el-button text type="danger" aria-label="删除容忍" @click="model.tolerations.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section v-if="configKey === 'deployments'" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>更新策略</h3>
          <p>Deployment 发布时的 RollingUpdate 或 Recreate 行为。</p>
        </div>
      </div>
      <div class="strategy-grid">
        <label
          ><span>策略</span
          ><el-select v-model="model.strategyType"><el-option value="RollingUpdate" /><el-option value="Recreate" /></el-select
        ></label>
        <label v-if="model.strategyType === 'RollingUpdate'"
          ><span>最大不可用</span><el-input v-model="model.maxUnavailable" placeholder="25%"
        /></label>
        <label v-if="model.strategyType === 'RollingUpdate'"
          ><span>最大超出</span><el-input v-model="model.maxSurge" placeholder="25%"
        /></label>
      </div>
    </section>

    <section v-if="['statefulsets', 'daemonsets'].includes(configKey)" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>更新策略</h3>
          <p>控制滚动更新或手动删除 Pod 后更新。</p>
        </div>
      </div>
      <div class="strategy-grid">
        <label
          ><span>类型</span
          ><el-select v-model="model.updateType"><el-option value="RollingUpdate" /><el-option value="OnDelete" /></el-select
        ></label>
        <label v-if="configKey === 'statefulsets'"><span>分区</span><el-input-number v-model="model.partition" :min="0" /></label>
      </div>
    </section>

    <section v-if="configKey === 'jobs'" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>任务参数</h3>
          <p>控制 Job 的完成次数、并行度和失败重试。</p>
        </div>
      </div>
      <div class="strategy-grid">
        <label><span>完成次数</span><el-input-number v-model="model.jobCompletions" :min="1" /></label>
        <label><span>并行度</span><el-input-number v-model="model.jobParallelism" :min="1" /></label>
        <label><span>失败重试上限</span><el-input-number v-model="model.jobBackoffLimit" :min="0" /></label>
        <label><span>最长运行秒数</span><el-input-number v-model="model.jobActiveDeadlineSeconds" :min="1" /></label>
      </div>
    </section>

    <section v-if="configKey === 'cronjobs'" class="settings-section">
      <div class="settings-heading">
        <div>
          <h3>CronJob 策略</h3>
          <p>控制并发、暂停和历史任务保留。</p>
        </div>
      </div>
      <div class="strategy-grid">
        <label
          ><span>并发策略</span
          ><el-select v-model="model.cronConcurrencyPolicy"
            ><el-option value="Allow" /><el-option value="Forbid" /><el-option value="Replace" /></el-select
        ></label>
        <label><span>历史成功保留</span><el-input-number v-model="model.cronSuccessfulHistoryLimit" :min="0" /></label>
        <label><span>历史失败保留</span><el-input-number v-model="model.cronFailedHistoryLimit" :min="0" /></label>
        <label class="inline-switch"><el-switch v-model="model.cronSuspend" />暂停调度</label>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { newAffinityTerm, type PodVolumeForm, type VolumeType, type WorkloadPodForm } from '@/domain/workload'

defineProps<{ configKey: string }>()
const model = defineModel<WorkloadPodForm>({ required: true })
const secretDraft = ref('')
const affinityGroups = computed(() => [
  {
    key: 'nodeAffinity',
    title: '节点亲和性',
    description: '要求 Pod 只能调度到匹配节点标签的节点。',
    topology: false,
    operators: ['In', 'NotIn', 'Exists', 'DoesNotExist', 'Gt', 'Lt'],
    terms: model.value.nodeAffinity,
  },
  {
    key: 'podAffinity',
    title: '副本亲和性',
    description: '要求 Pod 与匹配标签的 Pod 位于同一拓扑域。',
    topology: true,
    operators: ['In', 'NotIn', 'Exists', 'DoesNotExist'],
    terms: model.value.podAffinity,
  },
  {
    key: 'podAntiAffinity',
    title: '副本反亲和性',
    description: '要求 Pod 不与匹配标签的 Pod 位于同一拓扑域，常用于副本打散。',
    topology: true,
    operators: ['In', 'NotIn', 'Exists', 'DoesNotExist'],
    terms: model.value.podAntiAffinity,
  },
])

function sourcePlaceholder(type: VolumeType): string {
  if (type === 'persistentVolumeClaim') return 'PVC 名称'
  if (type === 'configMap') return 'ConfigMap 名称'
  if (type === 'secret') return 'Secret 名称'
  if (type === 'hostPath') return '节点路径，例如 /var/log'
  return '来源名称'
}

function addVolume() {
  const volume: PodVolumeForm = {
    name: '',
    type: 'persistentVolumeClaim',
    source: '',
    medium: '',
    sizeLimit: '',
    hostPathType: 'DirectoryOrCreate',
    readOnly: false,
    optional: false,
    raw: {},
  }
  model.value.volumes.push(volume)
}

function addSecret() {
  const name = secretDraft.value.trim()
  if (name && !model.value.imagePullSecrets.includes(name)) model.value.imagePullSecrets.push(name)
  secretDraft.value = ''
}

function removeSecret(name: string) {
  model.value.imagePullSecrets = model.value.imagePullSecrets.filter((item) => item !== name)
}
</script>
<style scoped>
.pod-settings {
  display: grid;
  gap: 22px;
  margin-top: 24px;
}
.settings-section {
  padding: 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-muted);
}
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
.settings-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.settings-heading h3 {
  font-size: 14px;
}
.settings-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.settings-empty {
  padding: 18px;
  color: var(--text-tertiary);
  text-align: center;
  font-size: 12px;
}
.volume-card {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-page);
}
.volume-row {
  display: grid;
  grid-template-columns: minmax(130px, 0.8fr) 170px minmax(150px, 1fr) auto auto 32px;
  align-items: center;
  gap: 10px;
}
.raw-volume {
  display: block;
  margin-top: 10px;
  padding: 8px;
  overflow: auto;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: 6px;
  font-size: 11px;
}
.pair-row,
.toleration-row {
  display: grid;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.affinity-card {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-page);
}
.policy-rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.affinity-row {
  display: grid;
  grid-template-columns: 1fr 120px 1fr 32px;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.affinity-placement {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 12px;
}
.affinity-placement label {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.claim-template-row {
  display: grid;
  grid-template-columns: 1fr 1fr 120px 170px 32px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.pair-row {
  grid-template-columns: 1fr 1fr 32px;
}
.toleration-row {
  grid-template-columns: 1fr 120px 1fr 150px 32px;
}
.strategy-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 14px;
}
.strategy-grid label {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.inline-switch {
  display: flex !important;
  align-items: center;
  gap: 8px;
}
.tag-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tag-input .el-input {
  width: 210px;
}
@media (max-width: 900px) {
  .settings-grid,
  .volume-row,
  .pair-row,
  .toleration-row,
  .affinity-row,
  .affinity-placement,
  .claim-template-row,
  .strategy-grid {
    grid-template-columns: 1fr;
  }
}
</style>
