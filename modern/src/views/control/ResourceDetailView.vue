<template>
  <div class="page page-stack detail-page">
    <PageHeader
      :title="instanceName"
      :description="`${config.shortTitle} · ${scope.cluster} / ${scope.namespace}`"
      :breadcrumbs="['资源控制台', config.title, instanceName]"
    >
      <template #badge><StatusTag :status="resourceStatus" /></template>
      <template #actions
        ><el-button @click="router.push({ path: `/control/${config.key}/list`, query: scope.query })">返回列表</el-button
        ><el-button @click="openYaml"
          ><el-icon><Document /></el-icon>YAML</el-button
        ><el-dropdown v-if="config.canEdit || config.canRestart || config.canScale" @command="onCommand"
          ><el-button type="primary"
            >管理资源<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button
          ><template #dropdown
            ><el-dropdown-menu
              ><el-dropdown-item v-if="config.canEdit" command="edit">设置资源</el-dropdown-item
              ><el-dropdown-item v-if="config.canScale" command="scale">调整副本数</el-dropdown-item
              ><el-dropdown-item v-if="config.canRestart" command="restart">重建副本</el-dropdown-item
              ><el-dropdown-item command="delete" :disabled="isProtectedResource" divided
                ><span class="danger-text">删除资源</span></el-dropdown-item
              ></el-dropdown-menu
            ></template
          ></el-dropdown
        ></template
      >
    </PageHeader>
    <el-alert v-if="error" type="error" :title="error" description="页面保留了最近一次成功加载的数据。" :closable="false" show-icon />
    <section class="surface detail-surface" v-loading="loading && !resource">
      <el-tabs :model-value="activeTab" class="detail-tabs" @tab-change="changeTab"
        ><el-tab-pane v-for="tab in config.tabs" :key="tab" :name="tab" :label="tabLabels[tab]"
      /></el-tabs>
      <div v-if="resource" class="detail-content">
        <template v-if="activeTab === 'info'">
          <section class="detail-section">
            <div class="section-title">
              <h2>基本信息</h2>
              <span>资源元数据与身份</span>
            </div>
            <el-descriptions :column="descriptionColumns" border
              ><el-descriptions-item label="名称"
                ><span class="mono">{{ resource.metadata.name }}</span></el-descriptions-item
              ><el-descriptions-item label="类型">{{ resource.kind }}</el-descriptions-item
              ><el-descriptions-item label="API 版本">{{ resource.apiVersion }}</el-descriptions-item
              ><el-descriptions-item label="命名空间">{{ resource.metadata.namespace || '—' }}</el-descriptions-item
              ><el-descriptions-item label="创建时间">{{ formatDate(resource.metadata.creationTimestamp, true) }}</el-descriptions-item
              ><el-descriptions-item label="Resource Version"
                ><span class="mono">{{ resource.metadata.resourceVersion || '—' }}</span></el-descriptions-item
              ><el-descriptions-item label="UID" :span="2"
                ><span class="mono uid">{{ resource.metadata.uid || '—' }}</span></el-descriptions-item
              ></el-descriptions
            >
          </section>
          <section v-if="kindFacts.length" class="detail-section">
            <div class="section-title">
              <h2>资源概览</h2>
              <span>当前类型的关键运行状态与配置</span>
            </div>
            <el-descriptions :column="descriptionColumns" border
              ><el-descriptions-item v-for="fact in kindFacts" :key="fact.label" :label="fact.label">{{
                fact.value
              }}</el-descriptions-item></el-descriptions
            >
          </section>
          <section v-if="config.key === 'pods' && podContainers.length" class="detail-section">
            <div class="section-title">
              <h2>容器</h2>
              <span>{{ podContainers.length }} 个容器，点击名称查看挂载、探针和日志</span>
            </div>
            <el-table :data="podContainers"
              ><el-table-column label="容器名称" min-width="170"
                ><template #default="{ row }"
                  ><router-link
                    :to="{
                      name: 'control.workload.containerdetail',
                      params: { workload: 'pods', instance: instanceName, pod: instanceName, container: row.name },
                      query: scope.query,
                    }"
                    >{{ row.name }}</router-link
                  ></template
                ></el-table-column
              ><el-table-column label="类型" width="90"
                ><template #default="{ row }">{{ row.init ? 'Init' : '业务' }}</template></el-table-column
              ><el-table-column prop="image" label="镜像" min-width="260" show-overflow-tooltip /><el-table-column
                label="CPU 请求 / 限制"
                width="150"
                ><template #default="{ row }">{{ row.cpu }}</template></el-table-column
              ><el-table-column label="内存请求 / 限制" width="160"
                ><template #default="{ row }">{{ row.memory }}</template></el-table-column
              ><el-table-column label="端口" min-width="120"
                ><template #default="{ row }">{{ row.ports || '—' }}</template></el-table-column
              ><el-table-column label="状态" width="130"
                ><template #default="{ row }"
                  ><StatusTag
                    :status="row.ready ? '运行正常' : '未就绪'"
                    :label="`${row.ready ? 'Ready' : 'NotReady'} · ${row.restarts} 次重启`" /></template
              ></el-table-column>
            </el-table>
          </section>
          <section class="detail-section">
            <div class="section-title">
              <h2>标签与注解</h2>
              <span
                >{{ Object.keys(resource.metadata.labels || {}).length }} 个标签 ·
                {{ Object.keys(resource.metadata.annotations || {}).length }} 个注解</span
              >
            </div>
            <div class="metadata-groups">
              <div>
                <h3>标签</h3>
                <div class="tag-list">
                  <el-tag v-for="(value, key) in resource.metadata.labels" :key="key" effect="plain">{{ key }}={{ value }}</el-tag
                  ><span v-if="!Object.keys(resource.metadata.labels || {}).length" class="text-tertiary">暂无标签</span>
                </div>
              </div>
              <div>
                <h3>注解</h3>
                <div class="tag-list">
                  <el-tag v-for="(value, key) in resource.metadata.annotations" :key="key" type="info" effect="plain"
                    >{{ key }}={{ value }}</el-tag
                  ><span v-if="!Object.keys(resource.metadata.annotations || {}).length" class="text-tertiary">暂无注解</span>
                </div>
              </div>
            </div>
          </section>
          <section class="detail-section">
            <div class="section-title">
              <h2>Spec 与 Status</h2>
              <el-button text type="primary" @click="openYaml"
                >查看完整 YAML<el-icon><ArrowRight /></el-icon
              ></el-button>
            </div>
            <CodeEditor :model-value="specStatusYaml" :read-only="true" height="400px" />
          </section>
        </template>

        <template v-else-if="activeTab === 'pod'">
          <div class="section-title">
            <h2>{{ tabLabels.pod }}</h2>
            <div class="inline-filters">
              <el-select v-if="config.key === 'deployments'" v-model="versionFilter" aria-label="副本版本" class="compact-select"
                ><el-option label="全部版本" value="all" /><el-option label="当前版本" value="current" /><el-option
                  label="历史版本"
                  value="history" /></el-select
              ><el-button :loading="relatedLoading" @click="loadRelated"
                ><el-icon><Refresh /></el-icon>刷新</el-button
              >
            </div>
          </div>
          <el-table :data="filteredRelatedPods" v-loading="relatedLoading"
            ><el-table-column label="副本名称" min-width="240"
              ><template #default="{ row }"
                ><router-link :to="{ path: `/control/pods/${row.metadata.name}/info`, query: scope.query }">{{
                  row.metadata.name
                }}</router-link></template
              ></el-table-column
            ><el-table-column v-if="config.key === 'deployments'" label="版本" width="110"
              ><template #default="{ row }"
                ><el-tag :type="podVersion(row.metadata.name) === 'current' ? 'success' : 'info'" effect="plain">{{
                  podVersion(row.metadata.name) === 'current' ? '当前版本' : '历史版本'
                }}</el-tag></template
              ></el-table-column
            ><el-table-column label="状态" width="130"
              ><template #default="{ row }"><StatusTag :status="row.status?.phase" /></template></el-table-column
            ><el-table-column prop="status.podIP" label="Pod IP" width="150" /><el-table-column
              prop="spec.nodeName"
              label="节点"
              min-width="150" /><el-table-column label="创建时间" width="180"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            ><el-table-column label="操作" width="180" align="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="showLogs(row)">日志</el-button
                ><el-button link type="primary" @click="openContainerShell(row)">终端</el-button></template
              ></el-table-column
            ><template #empty><EmptyState title="暂无关联副本" description="工作负载尚未创建 Pod，或副本仍在调度中" /></template
          ></el-table>
        </template>

        <template v-else-if="activeTab === 'jobs'"
          ><div class="section-title">
            <div>
              <h2>任务列表</h2>
              <span>仅展示归属当前 CronJob 的任务</span>
            </div>
            <div class="inline-filters">
              <el-select v-model="jobStatusFilter" aria-label="任务状态筛选" class="compact-select"
                ><el-option label="全部状态" value="all" /><el-option label="已完成" value="complete" /><el-option
                  label="执行中"
                  value="running" /></el-select
              ><el-button :loading="relatedLoading" @click="loadRelated"
                ><el-icon><Refresh /></el-icon>刷新</el-button
              >
            </div>
          </div>
          <el-table :data="filteredJobs" v-loading="relatedLoading"
            ><el-table-column prop="metadata.name" label="任务名称" min-width="220" /><el-table-column label="状态" width="130"
              ><template #default="{ row }"><StatusTag :status="row.status?.succeeded ? '已完成' : '执行中'" /></template></el-table-column
            ><el-table-column label="完成 / 目标" width="130"
              ><template #default="{ row }">{{ row.status?.succeeded || 0 }} / {{ row.spec?.completions || 1 }}</template></el-table-column
            ><el-table-column label="创建时间" width="190"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            ><el-table-column label="操作" width="100" align="right"
              ><template #default="{ row }"
                ><el-button link type="danger" @click="deleteJob(row)">删除</el-button></template
              ></el-table-column
            ><template #empty><EmptyState title="暂无关联任务" description="CronJob 到达调度时间后会在这里生成任务" /></template></el-table
        ></template>

        <template v-else-if="activeTab === 'event'"
          ><div class="section-title">
            <div>
              <h2>资源事件</h2>
              <span>按对象、Pod 与事件类型筛选，时间倒序排列</span>
            </div>
            <div class="inline-filters">
              <el-select v-if="config.key === 'deployments'" v-model="versionFilter" aria-label="事件副本版本" class="compact-select"
                ><el-option label="全部版本" value="all" /><el-option label="当前版本" value="current" /><el-option
                  label="历史版本"
                  value="history" /></el-select
              ><el-select v-model="eventScope" aria-label="事件对象" class="compact-select" @change="onEventScopeChange"
                ><el-option label="当前资源" value="resource" /><el-option label="关联 Pod" value="pod" /></el-select
              ><el-select
                v-if="eventScope === 'pod'"
                v-model="eventPod"
                aria-label="事件 Pod"
                filterable
                class="pod-select"
                @change="loadEvents"
                ><el-option v-for="pod in logPodOptions" :key="pod" :label="pod" :value="pod" /></el-select
              ><el-select v-model="eventTypeFilter" aria-label="事件类型" class="compact-select"
                ><el-option label="全部类型" value="" /><el-option label="Normal" value="Normal" /><el-option
                  label="Warning"
                  value="Warning" /></el-select
              ><el-button :loading="eventsLoading" @click="loadEvents"
                ><el-icon><Refresh /></el-icon>刷新</el-button
              ><el-checkbox v-model="relatedAutoRefresh">自动刷新</el-checkbox>
            </div>
          </div>
          <el-timeline v-if="filteredEvents.length" class="event-timeline"
            ><el-timeline-item
              v-for="event in filteredEvents"
              :key="event.metadata.uid"
              :timestamp="formatDate(event.lastTimestamp || event.metadata.creationTimestamp, true)"
              :type="event.type === 'Warning' ? 'danger' : 'primary'"
              ><div class="event-item">
                <div>
                  <strong>{{ event.reason }}</strong
                  ><el-tag :type="event.type === 'Warning' ? 'danger' : 'info'" size="small">{{ event.type }}</el-tag>
                </div>
                <p>{{ event.message }}</p>
                <small>{{ event.source?.component || event.reportingComponent || 'kubernetes' }} · {{ event.count || 1 }} 次</small>
              </div></el-timeline-item
            ></el-timeline
          ><EmptyState v-else title="暂无事件" description="当前对象或 Pod 没有符合筛选条件的新事件"
        /></template>

        <template v-else-if="activeTab === 'condition'"
          ><div class="section-title">
            <div>
              <h2>Condition 信息</h2>
              <span>控制器最近上报的状态条件</span>
            </div>
            <div class="inline-filters">
              <el-select v-if="config.key === 'deployments'" v-model="versionFilter" aria-label="Condition 副本版本" class="compact-select"
                ><el-option label="全部版本" value="all" /><el-option label="当前版本" value="current" /><el-option
                  label="历史版本"
                  value="history" /></el-select
              ><el-select
                v-if="config.key !== 'pods'"
                v-model="conditionPod"
                aria-label="Condition Pod"
                clearable
                filterable
                class="pod-select"
                @change="loadRelated"
                ><el-option label="当前资源" value="" /><el-option
                  v-for="pod in logPodOptions"
                  :key="pod"
                  :label="`Pod: ${pod}`"
                  :value="pod"
              /></el-select>
              <el-checkbox v-model="relatedAutoRefresh">自动刷新</el-checkbox>
            </div>
          </div>
          <el-table :data="conditionRows"
            ><el-table-column prop="type" label="类型" min-width="160" /><el-table-column label="状态" width="120"
              ><template #default="{ row }"
                ><StatusTag
                  :status="row.status === 'True' ? '正常' : row.status === 'False' ? '异常' : '未知'"
                  :label="row.status" /></template></el-table-column
            ><el-table-column prop="reason" label="原因" min-width="160" /><el-table-column
              prop="message"
              label="详细信息"
              min-width="260" /><el-table-column label="最近更新" width="190"
              ><template #default="{ row }">{{ formatDate(row.lastUpdateTime || row.lastTransitionTime) }}</template></el-table-column
            ><template #empty><EmptyState title="暂无 Condition" description="该资源未上报状态条件" /></template></el-table
        ></template>

        <template v-else-if="activeTab === 'log'"
          ><div class="log-toolbar">
            <div class="log-selectors">
              <el-select v-model="logPod" placeholder="选择 Pod" @change="onLogPodChange"
                ><el-option v-for="pod in logPodOptions" :key="pod" :label="pod" :value="pod" /></el-select
              ><el-select v-model="logContainer" placeholder="选择容器" @change="onLogContainerChange"
                ><el-option v-for="container in logContainerOptions" :key="container" :label="container" :value="container"
              /></el-select>
            </div>
            <div>
              <el-button text :disabled="logsLoading || !logSelection || logLines.length >= 5000" @click="loadOlderLogs">加载更早</el-button
              ><el-button text :disabled="logsLoading" @click="refreshLatestLogs">加载更新</el-button
              ><el-checkbox v-model="logPrevious" :disabled="logsLoading" @change="onLogPreviousChange">上一容器</el-checkbox
              ><el-checkbox v-model="logAutoRefresh">自动刷新</el-checkbox
              ><el-button :loading="logsLoading" @click="loadLogs()"
                ><el-icon><Refresh /></el-icon>刷新</el-button
              ><el-button @click="openLogShell"
                ><el-icon><Monitor /></el-icon>容器终端</el-button
              >
            </div>
          </div>
          <div class="log-viewer">
            <div class="log-viewer__header">
              <span
                ><i :class="{ live: logAutoRefresh }" />{{
                  logsLoading ? '正在读取日志' : `容器 ${logInfo?.containerName || logContainer || '—'} · 已加载 ${logLines.length} 行`
                }}</span
              ><span>{{ logLineCount }} 行<template v-if="logInfo?.truncated"> · 已达后端读取上限</template></span>
            </div>
            <el-alert v-if="logError" :title="logError" type="error" :closable="false" show-icon class="log-error" />
            <pre ref="logViewer">{{ logContent || '暂无日志。请选择 Pod 和容器后刷新。' }}</pre>
          </div></template
        >

        <template v-else-if="activeTab === 'monitor'"><DashboardView /></template>
        <template v-else-if="activeTab === 'extrnal'">
          <div class="section-title">
            <div>
              <h2>对外服务端口</h2>
              <span>Service 的集群内与外部访问入口</span>
            </div>
            <el-button type="primary" plain :icon="Setting" @click="openExternalDialog">外部访问设置</el-button>
          </div>
          <el-alert
            v-if="resource.spec?.type === 'ClusterIP'"
            type="info"
            title="当前 Service 类型为 ClusterIP，仅支持集群内部访问。需要外部访问时可修改为 NodePort 或 LoadBalancer。"
            :closable="false"
            show-icon
          />
          <el-table :data="servicePorts" class="external-table"
            ><el-table-column prop="name" label="端口名称" min-width="140"
              ><template #default="{ row }">{{ row.name || '—' }}</template></el-table-column
            ><el-table-column prop="protocol" label="协议" width="110" /><el-table-column
              prop="port"
              label="服务端口"
              width="130"
            /><el-table-column prop="targetPort" label="目标端口" width="130" /><el-table-column label="NodePort" width="130"
              ><template #default="{ row }">{{ row.nodePort || '—' }}</template></el-table-column
            ></el-table
          >
        </template>
      </div>
    </section>
    <el-dialog v-model="scaleOpen" title="调整副本数" width="min(460px, 94vw)" :close-on-click-modal="false">
      <el-alert
        type="info"
        :title="`当前期望副本数：${currentReplicas}`"
        description="保存后由控制器创建或删除 Pod，滚动发布策略仍然生效。"
        :closable="false"
        show-icon
      />
      <el-form label-position="top" class="scale-form"
        ><el-form-item label="期望副本数" required
          ><el-input-number v-model="scaleReplicas" :min="0" :max="1000" />
          <span class="text-secondary">设为 0 将停止全部副本但保留工作负载。</span></el-form-item
        ></el-form
      >
      <el-alert v-if="scaleError" type="error" :title="scaleError" :closable="false" show-icon />
      <template #footer
        ><el-button :disabled="scaleSubmitting" @click="scaleOpen = false">取消</el-button
        ><el-button type="primary" :loading="scaleSubmitting" @click="submitScale">保存</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="externalDialogOpen" title="外部访问设置" width="min(760px, 94vw)" :close-on-click-modal="false">
      <el-alert
        class="external-guide"
        type="warning"
        title="为每个服务端口设置负载均衡控制器对外暴露的端口。"
        description="外部端口须为 1-65535 的整数。服务端口名称修改可能导致既有外部访问设置失效。"
        :closable="false"
        show-icon
      />
      <el-alert v-if="externalLoadError" class="external-alert" type="error" :title="externalLoadError" :closable="false" show-icon>
        <template #default><el-button link type="primary" @click="loadExternalPorts">重新加载</el-button></template>
      </el-alert>
      <el-alert v-if="externalSubmitError" class="external-alert" type="error" :title="externalSubmitError" :closable="false" show-icon />
      <div class="external-dialog-body" v-loading="externalLoading">
        <el-table v-if="externalPorts.length" :data="externalPorts">
          <el-table-column prop="servicePort" label="服务端口" width="110" />
          <el-table-column prop="protocol" label="协议" width="90" />
          <el-table-column label="端口名称" min-width="120"
            ><template #default="{ row }">{{ row.servicePortName || '—' }}</template></el-table-column
          >
          <el-table-column label="启用外部访问 / 外部端口" min-width="270">
            <template #default="{ row }">
              <div class="external-port-editor">
                <el-switch
                  v-model="row.enabled"
                  :aria-label="`${row.protocol} ${row.servicePort} 外部访问`"
                  @change="row.externalPort = null"
                />
                <div>
                  <el-input-number
                    v-model="row.externalPort"
                    class="external-port-input"
                    :min="1"
                    :max="65535"
                    :precision="0"
                    :controls="false"
                    :disabled="!row.enabled"
                    placeholder="1-65535"
                  />
                  <p v-if="row.enabled && !validExternalPort(row.externalPort)" class="external-validation">请输入 1-65535 的整数</p>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-else-if="!externalLoading && !externalLoadError" class="external-empty">当前 Service 暂无可配置的服务端口</div>
      </div>
      <template #footer
        ><el-button :disabled="externalSubmitting" @click="externalDialogOpen = false">取消</el-button
        ><el-button
          type="primary"
          :loading="externalSubmitting"
          :disabled="externalLoading || Boolean(externalLoadError) || !externalPorts.length"
          @click="saveExternalPorts"
          >保存设置</el-button
        ></template
      >
    </el-dialog>
    <YamlEditorDialog
      v-model="yamlOpen"
      :title="`${instanceName} · YAML`"
      :content="yamlContent"
      :read-only="config.key === 'pods' || !writeAllowed"
      :submitting="yamlSubmitting"
      @submit="saveYaml"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, ArrowRight, Document, Monitor, Refresh, Setting } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import DashboardView from './DashboardView.vue'
import { resourceApi, type ExternalAccessPortUpdate, type ResourceDefinition } from '@/api/resource'
import { getResourceConfig } from '@/config/resources'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/utils/format'
import { formatPodLogs, mergeOlderLogs, olderPodLogQuery, podLogQuery } from '@/utils/pod-log'
import { fromYAML, toYAML } from '@/utils/yaml'
import type { PodLogDetails, PodLogInfo, PodLogLine, PodLogSelection } from '@/api/resource'
import type { KubeResource } from '@/types/api'
type EventResource = KubeResource & {
  type?: string
  reason?: string
  message?: string
  lastTimestamp?: string
  count?: number
  source?: { component?: string }
  reportingComponent?: string
  involvedObject?: { name?: string; kind?: string }
}
interface ExternalPortFormRow {
  protocol: string
  servicePort: number
  servicePortName?: string
  enabled: boolean
  externalPort: number | null
}
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const ui = useUiStore()
const config = computed(() => getResourceConfig(String(route.params.workload))!)
const instanceName = computed(() => String(route.params.instance))
const activeTab = computed(() => String(route.params.tab || 'info') as (typeof config.value.tabs)[number])
const tabLabels = computed<Record<string, string>>(() => ({
  info: '基本信息',
  pod: config.value.key === 'persistentvolumeclaims' ? '挂载 Pod' : '副本',
  monitor: '监控',
  jobs: '任务列表',
  event: '事件',
  condition: 'Condition',
  log: '日志',
  extrnal: '对外服务端口',
}))
const resource = ref<KubeResource>()
const loading = ref(false)
const error = ref('')
const relatedPods = ref<KubeResource[]>([])
const podVersions = ref<Record<string, 'current' | 'history'>>({})
const versionFilter = ref<'all' | 'current' | 'history'>('all')
const filteredRelatedPods = computed(() =>
  config.value.key === 'deployments' && versionFilter.value !== 'all'
    ? relatedPods.value.filter((pod) => podVersions.value[pod.metadata.name] === versionFilter.value)
    : relatedPods.value,
)
function podVersion(name: string): 'current' | 'history' {
  return podVersions.value[name] || 'current'
}
const relatedJobs = ref<KubeResource[]>([])
const relatedLoading = ref(false)
const events = ref<EventResource[]>([])
const eventsLoading = ref(false)
const relatedAutoRefresh = ref(true)
const yamlOpen = ref(false)
const yamlContent = ref('')
const yamlSubmitting = ref(false)
const logPod = ref('')
const logContainer = ref('')
const logContent = ref('')
const logDetails = ref<PodLogDetails>()
const logInfo = computed<PodLogInfo | undefined>(() => logDetails.value?.info)
const logLineCount = computed(() => logLines.value.length)
const logsLoading = ref(false)
const logAutoRefresh = ref(false)
const logSelection = ref<PodLogSelection>()
const logLines = ref<PodLogLine[]>([])
const logError = ref('')
const logViewer = ref<HTMLElement>()
const LOG_PAGE_SIZE = 100
const logPrevious = ref(false)
const externalDialogOpen = ref(false)
const scaleOpen = ref(false)
const scaleReplicas = ref(1)
const scaleSubmitting = ref(false)
const scaleError = ref('')
const currentReplicas = computed(() => {
  const spec = resource.value?.spec as Record<string, any> | undefined
  const status = resource.value?.status as Record<string, any> | undefined
  return Number(spec?.replicas ?? status?.replicas ?? 0)
})
const externalPorts = ref<ExternalPortFormRow[]>([])
const externalLoading = ref(false)
const externalSubmitting = ref(false)
const externalLoadError = ref('')
const externalSubmitError = ref('')
const jobStatusFilter = ref<'all' | 'complete' | 'running'>('all')
const eventScope = ref<'resource' | 'pod'>('resource')
const eventPod = ref('')
const eventTypeFilter = ref('')
const conditionPod = ref('')
let externalRequestId = 0
const context = computed(() => ({ cluster: scope.cluster, namespace: scope.namespace, name: instanceName.value }))
const writeAllowed = computed(() => scope.canWrite(config.value.key) || scope.canWrite(config.value.plural))
const isProtectedResource = computed(() => {
  const metadata = resource.value?.metadata as Record<string, any> | undefined
  return (
    config.value.key === 'secrets' &&
    (metadata?.labels?.['system/defaultImagePullSecret'] === 'true' || metadata?.pureLabels?.['system/defaultImagePullSecret'] === 'true')
  )
})
const descriptionColumns = computed(() => (window.innerWidth < 768 ? 1 : 3))
const resourceStatus = computed(() => {
  const status = resource.value?.status as Record<string, any> | undefined
  if (status?.phase) return String(status.phase)
  if (status?.replicas !== undefined) return Number(status.readyReplicas || 0) === Number(status.replicas) ? '运行正常' : '副本未就绪'
  return resource.value ? '已创建' : '加载中'
})
function valueText(value: unknown, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback
  if (Array.isArray(value)) return value.length ? value.join(', ') : fallback
  return String(value)
}
const kindFacts = computed<Array<{ label: string; value: string }>>(() => {
  const current = resource.value
  if (!current) return []
  const spec = (current.spec || {}) as Record<string, any>
  const status = (current.status || {}) as Record<string, any>
  const facts: Array<{ label: string; value: string }> = []
  const add = (label: string, value: unknown) => facts.push({ label, value: valueText(value) })
  switch (config.value.key) {
    case 'pods':
      add('Pod 状态', status.phase)
      add('Pod IP', status.podIP)
      add('所在节点', spec.nodeName)
      add('QoS', status.qosClass)
      add('重启策略', spec.restartPolicy || 'Always')
      add('Service Account', spec.serviceAccountName)
      add('主机网络', spec.hostNetwork ? '是' : '否')
      break
    case 'deployments':
      add('副本（就绪 / 期望）', `${status.readyReplicas || 0} / ${status.replicas ?? spec.replicas ?? 0}`)
      add('已更新', status.updatedReplicas || 0)
      add('可用', status.availableReplicas || 0)
      add('不可用', status.unavailableReplicas || 0)
      add('更新策略', spec.strategy?.type || 'RollingUpdate')
      add(
        '选择器',
        Object.entries(spec.selector?.matchLabels || {})
          .map(([key, value]) => `${key}=${value}`)
          .join(', '),
      )
      break
    case 'statefulsets':
      add('副本（就绪 / 期望）', `${status.readyReplicas || 0} / ${status.replicas ?? spec.replicas ?? 0}`)
      add('当前版本副本', status.currentReplicas || 0)
      add('已更新副本', status.updatedReplicas || 0)
      add('Headless Service', spec.serviceName)
      add('更新策略', spec.updateStrategy?.type || 'RollingUpdate')
      add('存储声明模板', (spec.volumeClaimTemplates || []).length)
      break
    case 'daemonsets':
      add('就绪 / 期望', `${status.numberReady || 0} / ${status.desiredNumberScheduled || 0}`)
      add('已调度', status.currentNumberScheduled || 0)
      add('可用', status.numberAvailable || 0)
      add('已更新', status.updatedNumberScheduled || 0)
      add('更新策略', spec.updateStrategy?.type || 'RollingUpdate')
      break
    case 'jobs':
      add('完成 / 目标', `${status.succeeded || 0} / ${spec.completions ?? 1}`)
      add('活跃', status.active || 0)
      add('失败', status.failed || 0)
      add('重试上限', spec.backoffLimit ?? 6)
      add('开始时间', formatDate(status.startTime, true))
      add('完成时间', formatDate(status.completionTime, true))
      break
    case 'cronjobs':
      add('调度规则', spec.schedule)
      add('暂停', spec.suspend ? '是' : '否')
      add('并发策略', spec.concurrencyPolicy || 'Allow')
      add('活跃任务', (status.active || []).length)
      add('最近调度', formatDate(status.lastScheduleTime, true))
      add('历史保留（成功 / 失败）', `${spec.successfulJobsHistoryLimit ?? 3} / ${spec.failedJobsHistoryLimit ?? 1}`)
      break
    case 'services':
      add('类型', spec.type || 'ClusterIP')
      add('ClusterIP', spec.clusterIP)
      add('External IPs', spec.externalIPs)
      add(
        '端口',
        (spec.ports || []).map((port: Record<string, any>) => `${port.port}→${port.targetPort || port.port}/${port.protocol || 'TCP'}`),
      )
      add(
        '选择器',
        Object.entries(spec.selector || {})
          .map(([key, value]) => `${key}=${value}`)
          .join(', '),
      )
      add('会话保持', spec.sessionAffinity || 'None')
      break
    case 'ingresses':
      add('Ingress Class', spec.ingressClassName)
      add('域名', [...new Set((spec.rules || []).map((rule: Record<string, any>) => rule.host).filter(Boolean))])
      add(
        '路径规则数',
        (spec.rules || []).reduce((total: number, rule: Record<string, any>) => total + (rule.http?.paths || []).length, 0),
      )
      add('TLS 证书', (spec.tls || []).length)
      break
    case 'persistentvolumeclaims':
      add('状态', status.phase)
      add('绑定 PV', spec.volumeName)
      add('StorageClass', spec.storageClassName)
      add('申请容量', spec.resources?.requests?.storage)
      add('实际容量', status.capacity?.storage)
      add('访问模式', spec.accessModes)
      add('卷模式', spec.volumeMode || 'Filesystem')
      break
    case 'configmaps':
      add('数据键', Object.keys(current.data || {}).length)
      add('二进制键', Object.keys(current.binaryData || {}).length)
      add('不可变', current.immutable ? '是' : '否')
      break
    case 'secrets':
      add('Secret 类型', current.type || 'Opaque')
      add('数据键', Object.keys(current.data || {}).length)
      add('不可变', current.immutable ? '是' : '否')
      break
    case 'networkpolicies':
      add('策略类型', spec.policyTypes)
      add(
        'Pod 选择器',
        Object.entries(spec.podSelector?.matchLabels || {})
          .map(([key, value]) => `${key}=${value}`)
          .join(', '),
      )
      add('Ingress 规则', (spec.ingress || []).length)
      add('Egress 规则', (spec.egress || []).length)
      break
    case 'PrometheusRule':
      add('规则组', (spec.groups || []).length)
      add(
        '规则数',
        (spec.groups || []).reduce((total: number, group: Record<string, any>) => total + (group.rules || []).length, 0),
      )
      add(
        '告警规则',
        (spec.groups || []).reduce(
          (total: number, group: Record<string, any>) =>
            total + (group.rules || []).filter((rule: Record<string, any>) => rule.alert).length,
          0,
        ),
      )
      break
    case 'AlertmanagerConfig':
      add('接收人', spec.route?.receiver)
      add(
        '通知渠道',
        (spec.receivers || []).reduce(
          (total: number, receiver: Record<string, any>) =>
            total + ['wechatConfigs', 'emailConfigs', 'webhookConfigs'].reduce((count, key) => count + (receiver[key] || []).length, 0),
          0,
        ),
      )
      add('路由匹配', (spec.route?.matchers || []).length)
      add('分组键', spec.route?.groupBy)
      break
    default:
      break
  }
  return facts.filter((fact) => fact.value !== '—')
})
const podContainers = computed(() => {
  const current = resource.value
  if (!current || config.value.key !== 'pods') return []
  const spec = (current.spec || {}) as Record<string, any>
  const status = (current.status || {}) as Record<string, any>
  const statuses = [...(status.initContainerStatuses || []), ...(status.containerStatuses || [])] as Array<Record<string, any>>
  const build = (container: Record<string, any>, init: boolean) => {
    const containerStatus = statuses.find((item) => item.name === container.name) || {}
    const resources = container.resources || {}
    return {
      name: String(container.name || ''),
      image: String(container.image || ''),
      init,
      cpu: `${resources.requests?.cpu || '—'} / ${resources.limits?.cpu || '—'}`,
      memory: `${resources.requests?.memory || '—'} / ${resources.limits?.memory || '—'}`,
      ports: (container.ports || []).map((port: Record<string, any>) => `${port.containerPort}/${port.protocol || 'TCP'}`).join(', '),
      ready: Boolean(containerStatus.ready),
      restarts: Number(containerStatus.restartCount || 0),
    }
  }
  return [
    ...(spec.initContainers || []).map((container: Record<string, any>) => build(container, true)),
    ...(spec.containers || []).map((container: Record<string, any>) => build(container, false)),
  ]
})
const specStatusYaml = computed(() =>
  toYAML({
    spec: resource.value?.spec || {},
    status: resource.value?.status || {},
    ...(resource.value?.data ? { data: resource.value.data } : {}),
  }),
)
const conditions = computed(
  () => ((resource.value?.status as Record<string, any> | undefined)?.conditions || []) as Array<Record<string, string>>,
)
const conditionRows = computed(() => {
  if (!conditionPod.value) return conditions.value
  const pod = relatedPods.value.find((item) => item.metadata.name === conditionPod.value)
  return ((pod?.status as Record<string, any> | undefined)?.conditions || []) as Array<Record<string, string>>
})
const filteredJobs = computed(() =>
  relatedJobs.value.filter((job) => {
    if (jobStatusFilter.value === 'all') return true
    const succeeded = Boolean(job.status?.succeeded)
    return jobStatusFilter.value === 'complete' ? succeeded : !succeeded
  }),
)
const filteredEvents = computed(() => events.value.filter((event) => !eventTypeFilter.value || event.type === eventTypeFilter.value))
const servicePorts = computed(
  () => ((resource.value?.spec as Record<string, any> | undefined)?.ports || []) as Array<Record<string, unknown>>,
)
const containers = computed(() => {
  const spec = resource.value?.spec as Record<string, any> | undefined
  return (spec?.containers || spec?.template?.spec?.containers || []) as Array<{ name: string }>
})
const logPodOptions = computed(() =>
  config.value.key === 'pods' ? [instanceName.value] : filteredRelatedPods.value.map((item) => item.metadata.name),
)
const logContainerOptions = computed(() => containers.value.map((item) => item.name))
const podDefinition: ResourceDefinition = { plural: 'pods', kind: 'Pod', group: '', version: 'v1', namespaced: true }
const jobDefinition: ResourceDefinition = { plural: 'jobs', kind: 'Job', group: 'batch', version: 'v1', namespaced: true }
const eventDefinition: ResourceDefinition = { plural: 'events', kind: 'Event', group: '', version: 'v1', namespaced: true }
const replicaSetDefinition: ResourceDefinition = {
  plural: 'replicasets',
  kind: 'ReplicaSet',
  group: 'apps',
  version: 'v1',
  namespaced: true,
}
let logTimer: ReturnType<typeof setInterval> | undefined
let relatedTimer: ReturnType<typeof setInterval> | undefined
function syncRelatedTimer() {
  clearInterval(relatedTimer)
  if (!relatedAutoRefresh.value || !['event', 'condition'].includes(activeTab.value)) return
  relatedTimer = setInterval(() => {
    if (activeTab.value === 'event') void loadEvents()
    else void loadRelated()
  }, 15000)
}
async function loadResource() {
  loading.value = true
  error.value = ''
  try {
    resource.value = await resourceApi.get(config.value, context.value)
    yamlContent.value = toYAML(resource.value)
    if (['pod', 'jobs', 'log', 'event', 'condition'].includes(activeTab.value)) await loadRelated()
    if (activeTab.value === 'event') await loadEvents()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '资源加载失败'
  } finally {
    loading.value = false
  }
}
function ownerReferences(item: KubeResource): Array<Record<string, unknown>> {
  const refs = (item.metadata as Record<string, unknown>).ownerReferences
  return Array.isArray(refs) ? (refs as Array<Record<string, unknown>>) : []
}
function ownedBy(item: KubeResource, uids: Set<string>, names: Set<string> = new Set()) {
  return ownerReferences(item).some((ref) => uids.has(String(ref.uid || '')) || names.has(String(ref.name || '')))
}
async function loadRelated() {
  relatedLoading.value = true
  try {
    const needsPods = ['pod', 'log', 'event', 'condition'].includes(activeTab.value)
    if (config.value.key === 'persistentvolumeclaims' && needsPods) {
      const response = await resourceApi.pvcPods(scope.cluster, scope.namespace, instanceName.value)
      relatedPods.value = response.pods || []
    } else if (needsPods) {
      const response = await resourceApi.list(podDefinition, context.value, { pageNum: 1, pageSize: 500 })
      let pods = response.items || []
      const ownerUid = String(resource.value?.metadata.uid || '')
      if (config.value.key === 'pods') pods = pods.filter((item) => item.metadata.name === instanceName.value)
      else if (config.value.key === 'deployments' && ownerUid) {
        const replicaSets = await resourceApi.list(replicaSetDefinition, context.value, { pageNum: 1, pageSize: 500 })
        const sets = (replicaSets.items || []).filter(
          (item) =>
            ownedBy(item, new Set([ownerUid])) || ownerReferences(item).some((ref) => String(ref.name || '') === instanceName.value),
        )
        const revision = String(resource.value?.metadata.annotations?.['deployment.kubernetes.io/revision'] || '')
        const currentSets = revision
          ? sets.filter((item) => String(item.metadata.annotations?.['deployment.kubernetes.io/revision'] || '') === revision)
          : sets.filter((item) => Number((item.spec as Record<string, any> | undefined)?.replicas || 0) > 0)
        const currentNames = new Set(
          currentSets.length ? currentSets.map((item) => item.metadata.name) : sets.map((item) => item.metadata.name),
        )
        const uids = new Set(sets.map((item) => String(item.metadata.uid || '')).filter(Boolean))
        const names = new Set(sets.map((item) => item.metadata.name))
        pods = pods.filter((item) => ownedBy(item, uids, names))
        podVersions.value = Object.fromEntries(
          pods.map((pod) => {
            const ownerName = ownerReferences(pod).find((ref) => names.has(String(ref.name || '')))?.name
            return [pod.metadata.name, currentNames.has(String(ownerName || '')) ? 'current' : 'history']
          }),
        ) as Record<string, 'current' | 'history'>
      } else if (ownerUid) pods = pods.filter((item) => ownedBy(item, new Set([ownerUid])))
      if (!pods.length && config.value.key !== 'pods') {
        pods = (response.items || []).filter(
          (item) => item.metadata.name.startsWith(`${instanceName.value}-`) || item.metadata.labels?.app === instanceName.value,
        )
      }
      relatedPods.value = pods
    }
    if (activeTab.value === 'jobs') {
      const response = await resourceApi.list(jobDefinition, context.value, { pageNum: 1, pageSize: 500 })
      const ownerUid = String(resource.value?.metadata.uid || '')
      let jobs = response.items || []
      const owned = ownerUid ? jobs.filter((job) => ownedBy(job, new Set([ownerUid]))) : []
      jobs = owned.length ? owned : jobs.filter((job) => job.metadata.name.startsWith(`${instanceName.value}-`))
      relatedJobs.value = jobs
    }
    if (['event', 'condition'].includes(activeTab.value)) {
      if (!eventPod.value) eventPod.value = logPodOptions.value[0] || ''
      if (conditionPod.value && !logPodOptions.value.includes(conditionPod.value)) conditionPod.value = ''
    }
    if (activeTab.value === 'log') {
      if (!logPod.value) logPod.value = logPodOptions.value[0] || ''
      if (!logContainer.value) logContainer.value = logContainerOptions.value[0] || 'app'
      if (logPod.value) await loadLogs()
    }
  } finally {
    relatedLoading.value = false
  }
}
async function loadEvents() {
  eventsLoading.value = true
  try {
    const podEvent = eventScope.value === 'pod'
    if (podEvent && !eventPod.value) {
      await loadRelated()
    }
    const targetName = podEvent ? eventPod.value : instanceName.value
    if (!targetName) {
      events.value = []
      return
    }
    const targetKind = podEvent ? 'Pod' : String(resource.value?.kind || config.value.kind)
    const response = await resourceApi.list(eventDefinition, context.value, {
      pageNum: 1,
      pageSize: 300,
      fieldSelector: `involvedObject.name=${targetName},involvedObject.kind=${targetKind}`,
    } as never)
    events.value = (response.items || [])
      .filter((event) => (event as EventResource).involvedObject?.name === targetName || !(event as EventResource).involvedObject)
      .sort(
        (left, right) =>
          Date.parse(String(right.lastTimestamp || right.metadata.creationTimestamp || '')) -
          Date.parse(String(left.lastTimestamp || left.metadata.creationTimestamp || '')),
      ) as EventResource[]
  } finally {
    eventsLoading.value = false
  }
}
function onEventScopeChange() {
  if (eventScope.value === 'pod') void loadRelated().then(loadEvents)
  else void loadEvents()
}
async function deleteJob(job: KubeResource) {
  await ElMessageBox.confirm(`删除后 Job ${job.metadata.name} 及其 Pod 将无法恢复，确定继续吗？`, '删除任务', {
    type: 'warning',
    confirmButtonText: '确认删除',
  })
  await resourceApi.delete(jobDefinition, { ...context.value, name: job.metadata.name })
  ElMessage.success('任务已删除')
  await loadRelated()
}
function openExternalDialog() {
  externalDialogOpen.value = true
  externalSubmitError.value = ''
  loadExternalPorts()
}
async function loadExternalPorts() {
  const current = ++externalRequestId
  const cluster = scope.cluster
  const namespace = scope.namespace
  const name = instanceName.value
  externalLoading.value = true
  externalLoadError.value = ''
  try {
    const response = await resourceApi.getExternalAccess(cluster, namespace, name)
    if (current !== externalRequestId) return
    externalPorts.value = (response || []).map((item) => ({
      protocol: item.protocol,
      servicePort: item.servicePort,
      servicePortName: item.servicePortName,
      enabled: Boolean(item.externalPort),
      externalPort: typeof item.externalPort === 'number' ? item.externalPort : null,
    }))
  } catch (reason) {
    if (current === externalRequestId)
      externalLoadError.value = `外部端口加载失败：${reason instanceof Error ? reason.message : '请求失败，请稍后重试'}。已保留当前设置。`
  } finally {
    if (current === externalRequestId) externalLoading.value = false
  }
}
function validExternalPort(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
}
async function saveExternalPorts() {
  if (!externalPorts.value.every((row) => !row.enabled || validExternalPort(row.externalPort))) {
    externalSubmitError.value = '请为每个已启用外部访问的端口填写 1-65535 的整数。'
    return
  }
  const data: ExternalAccessPortUpdate[] = externalPorts.value.map((row) =>
    row.enabled
      ? { protocol: row.protocol, servicePort: row.servicePort, externalPort: Number(row.externalPort) }
      : { protocol: row.protocol, servicePort: row.servicePort },
  )
  externalSubmitting.value = true
  externalSubmitError.value = ''
  try {
    await resourceApi.setExternalAccess(scope.cluster, scope.namespace, instanceName.value, data)
    ElMessage.success('外部访问设置已保存')
    externalDialogOpen.value = false
    await Promise.all([loadResource(), loadExternalPorts()])
  } catch (reason) {
    externalSubmitError.value = `外部访问设置保存失败：${reason instanceof Error ? reason.message : '请求失败，请稍后重试'}。当前填写内容已保留。`
  } finally {
    externalSubmitting.value = false
  }
}
function changeTab(tab: string | number) {
  router.replace({ path: `/control/${config.value.key}/${instanceName.value}/${String(tab)}`, query: route.query })
}
async function openYaml() {
  yamlContent.value = toYAML(resource.value || {})
  yamlOpen.value = true
}
async function saveYaml(content: string) {
  yamlSubmitting.value = true
  try {
    resource.value = await resourceApi.replace(config.value, context.value, fromYAML(content))
    ElMessage.success('YAML 已保存并应用')
    yamlOpen.value = false
    await loadResource()
  } finally {
    yamlSubmitting.value = false
  }
}
async function submitScale() {
  scaleError.value = ''
  const replicas = Number(scaleReplicas.value)
  if (!Number.isInteger(replicas) || replicas < 0 || replicas > 1000) {
    scaleError.value = '副本数必须是 0-1000 的整数。'
    return
  }
  scaleSubmitting.value = true
  try {
    await resourceApi.patch(config.value, context.value, { spec: { replicas } }, 'merge')
    ElMessage.success(`副本数已调整为 ${replicas}`)
    scaleOpen.value = false
    await loadResource()
  } catch (reason) {
    scaleError.value = `副本数调整失败：${reason instanceof Error ? reason.message : '请求失败，请稍后重试'}`
  } finally {
    scaleSubmitting.value = false
  }
}
async function onCommand(command: string) {
  if (command === 'edit') router.push({ path: `/control/${config.value.key}/${instanceName.value}/edit`, query: scope.query })
  else if (command === 'scale') {
    scaleReplicas.value = currentReplicas.value
    scaleError.value = ''
    scaleOpen.value = true
  } else if (command === 'restart') {
    await ElMessageBox.confirm(`确定重建 ${instanceName.value} 的副本吗？`, '重建工作负载', { type: 'warning' })
    await resourceApi.patch(config.value, context.value, {
      spec: { template: { metadata: { annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() } } } },
    })
    ElMessage.success('已触发重建')
    await loadResource()
  } else if (command === 'delete') {
    if (isProtectedResource.value) {
      ElMessage.warning('默认镜像拉取 Secret 不能删除')
      return
    }
    await ElMessageBox.confirm(`删除后无法恢复，确定删除 ${instanceName.value} 吗？`, '删除资源', {
      type: 'warning',
      confirmButtonText: '确认删除',
    })
    await resourceApi.delete(config.value, context.value)
    ElMessage.success('资源已删除')
    router.push({ path: `/control/${config.value.key}/list`, query: scope.query })
  }
}
function showLogs(row: KubeResource) {
  logPod.value = row.metadata.name
  resetLogWindow()
  changeTab('log')
}
function openContainerShell(row: KubeResource) {
  const container = ((row.spec as Record<string, any>)?.containers?.[0]?.name || 'app') as string
  ui.openShell(row.metadata.name, container)
}
function openLogShell() {
  if (logPod.value) ui.openShell(logPod.value, logContainer.value || 'app')
}
function resetLogWindow() {
  logSelection.value = undefined
  logLines.value = []
  logContent.value = ''
  logError.value = ''
}
function onLogPodChange() {
  const pod = relatedPods.value.find((item) => item.metadata.name === logPod.value)
  logContainer.value = (pod?.spec as Record<string, any>)?.containers?.[0]?.name || 'app'
  logPrevious.value = false
  resetLogWindow()
  loadLogs()
}
function onLogContainerChange() {
  logPrevious.value = false
  resetLogWindow()
  loadLogs()
}
function onLogPreviousChange() {
  resetLogWindow()
  loadLogs()
}
async function loadLogs(mode: 'latest' | 'older' = 'latest') {
  if (!logPod.value) return
  const viewer = logViewer.value
  const distanceFromBottom = viewer ? viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight : 0
  logsLoading.value = true
  logError.value = ''
  try {
    const query =
      mode === 'older' && logSelection.value
        ? olderPodLogQuery(logContainer.value, logSelection.value, LOG_PAGE_SIZE, logPrevious.value)
        : podLogQuery(logContainer.value, LOG_PAGE_SIZE, logPrevious.value)
    const details = await resourceApi.podLogs(scope.cluster, scope.namespace, logPod.value, query)
    const lines = mode === 'older' ? mergeOlderLogs(logLines.value, details.logs) : details.logs
    logDetails.value = details
    logSelection.value = details.selection
    logLines.value = lines
    logContent.value = formatPodLogs({ ...details, logs: lines }, true)
  } catch (error) {
    logError.value = `日志加载失败：${error instanceof Error ? error.message : '请求失败，请稍后重试'}`
  } finally {
    logsLoading.value = false
    await nextTick()
    if (viewer) viewer.scrollTop = Math.max(0, viewer.scrollHeight - viewer.clientHeight - distanceFromBottom)
  }
}
async function loadOlderLogs() {
  if (!logSelection.value || logLines.value.length >= 5000) return
  await loadLogs('older')
}
async function refreshLatestLogs() {
  await loadLogs('latest')
}
watch(
  [instanceName, () => config.value.key, () => scope.key],
  () => {
    externalRequestId++
    externalDialogOpen.value = false
    externalPorts.value = []
    externalLoading.value = false
    externalLoadError.value = ''
    externalSubmitError.value = ''
    loadResource()
  },
  { immediate: true },
)
watch(activeTab, (tab) => {
  clearInterval(logTimer)
  if (['pod', 'jobs', 'log', 'event', 'condition'].includes(tab)) void loadRelated()
  if (tab === 'event') void loadEvents()
  if (tab === 'log' && logAutoRefresh.value) logTimer = setInterval(loadLogs, 3000)
})
watch(eventPod, () => {
  if (activeTab.value === 'event' && eventScope.value === 'pod') void loadEvents()
})
watch(versionFilter, () => {
  eventPod.value = ''
  conditionPod.value = ''
  logPod.value = ''
  if (activeTab.value === 'event') void loadEvents()
  if (activeTab.value === 'log') void loadLogs()
})
watch(logAutoRefresh, (value) => {
  clearInterval(logTimer)
  if (value && activeTab.value === 'log') logTimer = setInterval(loadLogs, 3000)
})
watch([activeTab, relatedAutoRefresh], syncRelatedTimer)
onBeforeUnmount(() => {
  clearInterval(logTimer)
  clearInterval(relatedTimer)
  externalRequestId++
})
</script>
<style scoped>
.detail-surface {
  overflow: hidden;
  min-height: 420px;
}
.detail-tabs {
  padding: 0 24px;
  border-bottom: 1px solid var(--border-light);
}
.detail-tabs :deep(.el-tabs__header) {
  margin: 0;
}
.detail-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.detail-content {
  padding: 26px;
}
.detail-section + .detail-section {
  margin-top: 32px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.section-title > div {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.section-title h2 {
  font-size: 16px;
}
.section-title span {
  color: var(--text-tertiary);
  font-size: 12px;
}
.uid {
  font-size: 12px;
  word-break: break-all;
}
.metadata-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.metadata-groups h3 {
  margin-bottom: 10px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}
.tag-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag-list .el-tag {
  max-width: 100%;
  height: auto;
  min-height: 28px;
  white-space: normal;
  word-break: break-all;
}
.event-timeline {
  padding: 8px 4px;
}
.event-item > div {
  display: flex;
  align-items: center;
  gap: 10px;
}
.event-item p {
  margin: 7px 0;
  color: var(--text-regular);
}
.event-item small {
  color: var(--text-tertiary);
}
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.log-toolbar > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.log-selectors .el-select {
  width: 220px;
}
.inline-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.compact-select {
  width: 130px;
}
.pod-select {
  width: 220px;
}
.log-viewer {
  overflow: hidden;
  color: #d0d5dd;
  background: #101828;
  border: 1px solid #344054;
  border-radius: 10px;
}
.log-viewer__header {
  display: flex;
  height: 42px;
  padding: 0 16px;
  align-items: center;
  justify-content: space-between;
  color: #98a2b3;
  background: #1d2939;
  font-size: 11px;
}
.log-viewer__header > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
}
.log-viewer__header i {
  width: 6px;
  height: 6px;
  background: #667085;
  border-radius: 50%;
}
.log-viewer__header i.live {
  background: var(--success);
  box-shadow: 0 0 0 4px rgb(18 183 106 / 12%);
}
.log-viewer pre {
  min-height: 420px;
  max-height: 62vh;
  margin: 0;
  padding: 18px;
  overflow: auto;
  color: #e4e7ec;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-all;
}
.external-table {
  margin-top: 18px;
}
.danger-text {
  color: var(--danger);
}
.scale-form {
  margin-top: 20px;
}
.scale-form .text-secondary {
  display: block;
  margin-top: 6px;
  font-size: 12px;
}
.external-guide,
.external-alert {
  margin-bottom: 16px;
}
.external-dialog-body {
  min-height: 120px;
}
.external-port-editor {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.external-port-editor > .el-switch {
  margin-top: 7px;
  flex-shrink: 0;
}
.external-port-input {
  width: 160px;
}
.external-validation {
  margin: 3px 0 0;
  color: var(--danger);
  font-size: 11px;
  line-height: 16px;
}
.external-empty {
  display: grid;
  min-height: 120px;
  color: var(--text-secondary);
  place-items: center;
}
@media (max-width: 900px) {
  .metadata-groups {
    grid-template-columns: 1fr;
  }
  .log-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .log-toolbar > div {
    flex-wrap: wrap;
  }
}
@media (max-width: 600px) {
  .detail-content {
    padding: 18px;
  }
  .detail-tabs {
    padding: 0 12px;
    overflow-x: auto;
  }
  .log-selectors {
    flex-direction: column;
  }
  .log-selectors .el-select {
    width: 100%;
  }
}
</style>
