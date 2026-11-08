<template>
  <div class="page page-stack">
    <PageHeader :title="clusterTitle" :description="`集群标识：${clusterName}`" :breadcrumbs="['平台管理', '集群管理', '集群详情']">
      <template #badge><StatusTag :status="cluster?.status" :label="statusLabel(cluster?.status)" /></template>
      <template #actions>
        <el-button @click="router.push('/platform/cluster/list')">返回列表</el-button>
        <el-button :icon="Refresh" :loading="summaryLoading || tabLoading" @click="refreshCurrent">刷新</el-button>
      </template>
    </PageHeader>

    <el-alert v-if="summaryError" type="error" :title="summaryError" show-icon :closable="false">
      <template #default><el-button link type="primary" @click="loadSummary">重新加载集群摘要</el-button></template>
    </el-alert>

    <div v-if="summaryLoading && !cluster" class="summary-grid">
      <el-skeleton v-for="index in 4" :key="index" class="surface summary-skeleton" animated :rows="2" />
    </div>
    <div v-else-if="cluster" class="summary-grid">
      <MetricCard
        label="CPU 使用"
        :value="formatNumber(cluster.usedCpu)"
        :unit="`/ ${formatNumber(cluster.totalCpu)} Cores`"
        caption="集群信息接口实时汇总"
      />
      <MetricCard
        label="内存使用"
        :value="formatBytes(cluster.usedMem, 'Mi')"
        :unit="`/ ${formatBytes(cluster.totalMem, 'Mi')}`"
        caption="集群信息接口实时汇总"
        tone="info"
      />
      <MetricCard label="节点" :value="cluster.nodeCount ?? '—'" unit="个" caption="当前集群节点数量" tone="success" />
      <MetricCard label="空间" :value="cluster.namespaceCount ?? '—'" unit="个" caption="当前集群空间数量" tone="warning" />
    </div>

    <section class="surface detail-surface">
      <el-tabs :model-value="activeTab" class="detail-tabs" @tab-change="changeTab">
        <el-tab-pane v-for="tab in tabs" :key="tab.name" :label="tab.label" :name="tab.name" />
      </el-tabs>

      <div class="tab-content">
        <template v-if="activeTab === 'info'">
          <el-skeleton v-if="summaryLoading && !cluster" animated :rows="7" />
          <template v-else-if="cluster">
            <div class="section-heading">
              <div>
                <h2>基本信息</h2>
                <p>来自集群信息接口的当前配置与容量。</p>
              </div>
            </div>
            <el-descriptions :column="descriptionColumns" border>
              <el-descriptions-item label="集群名称">{{ clusterTitle }}</el-descriptions-item>
              <el-descriptions-item label="集群标识">{{ cluster.clusterName }}</el-descriptions-item>
              <el-descriptions-item label="集群用途">{{ cluster.isMemberCluster ? '业务集群' : '管控集群' }}</el-descriptions-item>
              <el-descriptions-item label="状态"
                ><StatusTag :status="cluster.status" :label="statusLabel(cluster.status)"
              /></el-descriptions-item>
              <el-descriptions-item label="网络类型">{{ text(cluster.networkType) }}</el-descriptions-item>
              <el-descriptions-item label="Ingress 域名后缀">{{ text(cluster.ingressDomainSuffix) }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ formatDate(String(cluster.createTime || '')) }}</el-descriptions-item>
              <el-descriptions-item label="节点 / 空间"
                >{{ cluster.nodeCount ?? '—' }} / {{ cluster.namespaceCount ?? '—' }}</el-descriptions-item
              >
              <el-descriptions-item label="描述" :span="2">{{ cluster.clusterDescription || '—' }}</el-descriptions-item>
            </el-descriptions>
            <div class="metadata-section">
              <h3>注解</h3>
              <div v-if="annotationEntries.length" class="tag-list">
                <el-tag v-for="entry in annotationEntries" :key="entry[0]" type="info" effect="plain">{{ entry[0] }}={{ entry[1] }}</el-tag>
              </div>
              <span v-else class="text-secondary">暂无注解</span>
            </div>
          </template>
          <EmptyState v-else-if="!summaryLoading" title="无法展示集群详情" description="集群摘要不可用，请通过上方错误信息重试。" />
        </template>

        <template v-else-if="activeTab === 'monitor'">
          <div class="section-heading">
            <div>
              <h2>集群监控</h2>
              <p>通过监控查询接口执行 PromQL，展示当前时刻的结果。</p>
            </div>
            <el-button :icon="Refresh" :loading="tabLoading" @click="loadTab">重新查询</el-button>
          </div>
          <el-alert v-if="tabError" class="tab-alert" type="error" :title="tabError" show-icon :closable="false" />
          <div v-if="tabLoading && !metrics.length" class="metrics-grid">
            <el-skeleton v-for="index in 3" :key="index" class="metric-skeleton" animated :rows="2" />
          </div>
          <div v-else-if="metrics.length" v-loading="tabLoading" class="metrics-grid">
            <MetricCard
              v-for="metric in metrics"
              :key="metric.label"
              :label="metric.label"
              :value="metricDisplay(metric).value"
              :unit="metricDisplay(metric).unit"
              :caption="metric.value ? '即时查询成功' : '查询成功，但暂无匹配数据'"
              :tone="metric.tone"
            />
          </div>
          <EmptyState v-else-if="!tabLoading && !tabError" title="暂无监控数据" description="监控接口尚未返回可用指标。" />
          <el-collapse v-if="metrics.length" class="query-collapse"
            ><el-collapse-item title="查看本次 PromQL" name="query"
              ><div v-for="metric in metrics" :key="metric.label" class="query-row">
                <span>{{ metric.label }}</span
                ><code>{{ metric.query }}</code>
              </div></el-collapse-item
            ></el-collapse
          >
        </template>

        <template v-else>
          <div class="section-heading">
            <div>
              <h2>{{ currentTabLabel }}</h2>
              <p>{{ listDescription }}</p>
            </div>
            <div class="list-actions">
              <el-button v-if="activeTab === 'node'" :icon="Plus" @click="addNodeDialogVisible = true">添加节点</el-button>
              <el-button v-if="activeTab === 'storageclass'" type="primary" :icon="Plus" @click="openStorageClassCreate"
                >创建存储类别</el-button
              >
              <el-button v-if="activeTab === 'network'" type="primary" :icon="Plus" @click="createNetworkPolicy">创建网络策略</el-button>
              <el-input v-model="listKeyword" clearable :prefix-icon="Search" placeholder="搜索名称或空间" class="list-search" />
              <el-button :icon="Refresh" :loading="tabLoading" @click="loadTab">刷新</el-button>
            </div>
          </div>
          <el-alert v-if="tabError" class="tab-alert" type="error" :title="tabError" show-icon :closable="false" />
          <el-alert v-if="actionError" class="tab-alert" type="error" :title="actionError" show-icon closable @close="actionError = ''" />

          <el-table v-if="activeTab === 'node'" v-loading="tabLoading" :data="filteredItems" row-key="metadata.uid">
            <el-table-column label="节点名称" min-width="200" fixed="left"
              ><template #default="{ row }"
                ><router-link :to="`/platform/cluster/${encodeURIComponent(clusterName)}/${encodeURIComponent(row.metadata.name)}/info`">{{
                  row.metadata.name
                }}</router-link>
                <div class="cell-subtitle">{{ nodeRoles(row) }}</div></template
              ></el-table-column
            >
            <el-table-column label="状态" width="110"
              ><template #default="{ row }"
                ><StatusTag :status="nodeReady(row) ? 'Ready' : 'NotReady'" :label="nodeReady(row) ? '就绪' : '未就绪'" /></template
            ></el-table-column>
            <el-table-column label="Internal IP" min-width="135"
              ><template #default="{ row }">{{ nodeAddress(row) }}</template></el-table-column
            >
            <el-table-column label="CPU 容量" width="115"
              ><template #default="{ row }">{{ text(getByPath(row, 'status.capacity.cpu')) }}</template></el-table-column
            >
            <el-table-column label="内存容量" width="125"
              ><template #default="{ row }">{{ text(getByPath(row, 'status.capacity.memory')) }}</template></el-table-column
            >
            <el-table-column label="Kubelet" min-width="120"
              ><template #default="{ row }">{{ text(getByPath(row, 'status.nodeInfo.kubeletVersion')) }}</template></el-table-column
            >
            <el-table-column label="可调度" width="100"
              ><template #default="{ row }"
                ><el-tag :type="getByPath(row, 'spec.unschedulable') ? 'warning' : 'success'" effect="plain">{{
                  getByPath(row, 'spec.unschedulable') ? '已禁止' : '允许'
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column label="创建时间" width="165"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            >
            <el-table-column label="操作" width="265" fixed="right"
              ><template #default="{ row }">
                <el-button link type="primary" :disabled="Boolean(operatingName)" @click="openLabels(row)">标签</el-button>
                <el-button link type="primary" :disabled="Boolean(operatingName)" @click="openTaints(row)">污点</el-button>
                <el-button link type="primary" :loading="operatingName === row.metadata.name" @click="toggleScheduling(row)">{{
                  getByPath(row, 'spec.unschedulable') ? '允许调度' : '禁止调度'
                }}</el-button>
                <el-dropdown
                  ><el-button link type="primary">更多</el-button
                  ><template #dropdown
                    ><el-dropdown-menu
                      ><el-dropdown-item :disabled="Boolean(operatingName) || drainRunning" @click="confirmDrain(row)"
                        >平滑迁移</el-dropdown-item
                      ><el-dropdown-item :disabled="nodeDeleteForbidden(row) || Boolean(operatingName)" @click="openNodeDelete(row)"
                        ><span class="danger-text">删除节点</span></el-dropdown-item
                      ></el-dropdown-menu
                    ></template
                  ></el-dropdown
                >
              </template></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无节点" description="当前集群没有节点，或没有符合搜索条件的节点。"
            /></template>
          </el-table>

          <el-table v-else-if="activeTab === 'storageclass'" v-loading="tabLoading" :data="filteredItems" row-key="metadata.uid">
            <el-table-column label="存储类别" min-width="200"
              ><template #default="{ row }"
                >{{ row.metadata.name }}<el-tag v-if="isDefaultStorageClass(row)" size="small" class="inline-tag">默认</el-tag></template
              ></el-table-column
            >
            <el-table-column label="Provisioner" min-width="210"
              ><template #default="{ row }">{{ text(getByPath(row, 'provisioner')) }}</template></el-table-column
            >
            <el-table-column label="回收策略" width="130"
              ><template #default="{ row }">{{ text(getByPath(row, 'reclaimPolicy')) }}</template></el-table-column
            >
            <el-table-column label="绑定模式" min-width="150"
              ><template #default="{ row }">{{ text(getByPath(row, 'volumeBindingMode')) }}</template></el-table-column
            >
            <el-table-column label="允许扩容" width="110"
              ><template #default="{ row }">{{ getByPath(row, 'allowVolumeExpansion') === true ? '是' : '否' }}</template></el-table-column
            >
            <el-table-column label="创建时间" width="165"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            >
            <el-table-column label="操作" width="105" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="danger" :disabled="Boolean(operatingName)" @click="deleteStorageClass(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无存储类别" description="当前集群未返回 StorageClass 资源。"
            /></template>
          </el-table>

          <el-table v-else-if="activeTab === 'persistentvolumes'" v-loading="tabLoading" :data="filteredItems" row-key="metadata.uid">
            <el-table-column label="持久卷" min-width="210" fixed="left"
              ><template #default="{ row }">{{ row.metadata.name }}</template></el-table-column
            >
            <el-table-column label="状态" width="105"
              ><template #default="{ row }"><StatusTag :status="String(getByPath(row, 'status.phase') || '')" /></template
            ></el-table-column>
            <el-table-column label="容量" width="110"
              ><template #default="{ row }">{{ text(getByPath(row, 'spec.capacity.storage')) }}</template></el-table-column
            >
            <el-table-column label="访问模式" min-width="170"
              ><template #default="{ row }">{{ text(getByPath(row, 'spec.accessModes')) }}</template></el-table-column
            >
            <el-table-column label="存储类别" min-width="140"
              ><template #default="{ row }">{{ text(getByPath(row, 'spec.storageClassName')) }}</template></el-table-column
            >
            <el-table-column label="绑定声明" min-width="190"
              ><template #default="{ row }">{{ volumeClaim(row) }}</template></el-table-column
            >
            <el-table-column label="回收策略" width="120"
              ><template #default="{ row }">{{ text(getByPath(row, 'spec.persistentVolumeReclaimPolicy')) }}</template></el-table-column
            >
            <el-table-column label="创建时间" width="165"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            >
            <el-table-column label="操作" width="145" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="openReadonlyYaml(row)">YAML</el-button
                ><el-button link type="danger" :disabled="Boolean(operatingName)" @click="deletePersistentVolume(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无持久卷" description="当前集群未返回 PersistentVolume 资源。"
            /></template>
          </el-table>

          <el-table v-else v-loading="tabLoading" :data="filteredItems" row-key="metadata.uid">
            <el-table-column label="网络策略" min-width="210" fixed="left"
              ><template #default="{ row }">{{ row.metadata.name }}</template></el-table-column
            >
            <el-table-column label="空间" min-width="150"
              ><template #default="{ row }">{{ row.metadata.namespace || '—' }}</template></el-table-column
            >
            <el-table-column label="Pod 选择器" min-width="220"
              ><template #default="{ row }"
                ><span class="mono selector-text">{{ text(getByPath(row, 'spec.podSelector')) }}</span></template
              ></el-table-column
            >
            <el-table-column label="策略类型" min-width="150"
              ><template #default="{ row }">{{ text(getByPath(row, 'spec.policyTypes')) }}</template></el-table-column
            >
            <el-table-column label="入口 / 出口规则" width="145" align="center"
              ><template #default="{ row }">{{ ruleCount(row, 'ingress') }} / {{ ruleCount(row, 'egress') }}</template></el-table-column
            >
            <el-table-column label="创建时间" width="165"
              ><template #default="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template></el-table-column
            >
            <el-table-column label="操作" width="205" fixed="right"
              ><template #default="{ row }"
                ><el-button link type="primary" @click="editNetworkPolicy(row)">编辑</el-button
                ><el-button link type="primary" @click="openReadonlyYaml(row)">YAML</el-button
                ><el-button link type="danger" :disabled="Boolean(operatingName)" @click="deleteNetworkPolicy(row)"
                  >删除</el-button
                ></template
              ></el-table-column
            >
            <template #empty
              ><EmptyState v-if="!tabLoading && !tabError" title="暂无网络策略" description="当前集群未返回 NetworkPolicy 资源。"
            /></template>
          </el-table>
          <div v-if="filteredItems.length" class="list-count text-secondary">显示 {{ filteredItems.length }} / {{ items.length }} 项</div>
        </template>
      </div>
    </section>

    <YamlEditorDialog
      v-model="yamlOpen"
      :title="yamlTitle"
      :content="yamlContent"
      :read-only="yamlReadOnly"
      :submitting="yamlSubmitting"
      @submit="createStorageClass"
    />

    <el-dialog v-model="addNodeDialogVisible" title="添加节点" width="min(580px, 94vw)">
      <el-alert title="添加节点需要在目标主机和集群中执行安装步骤，页面不会伪造添加结果。" type="info" show-icon :closable="false" />
      <p class="dialog-copy">请按照 KubeCube 文档准备新节点、网络与运行时，并将工作节点加入当前集群。完成后返回节点列表刷新。</p>
      <el-link
        type="primary"
        href="https://www.kubecube.io/docs/installation-guide/add-k8s-node/#向集群添加工作节点"
        target="_blank"
        rel="noopener noreferrer"
        >查看添加工作节点文档</el-link
      >
      <template #footer><el-button type="primary" @click="addNodeDialogVisible = false">我知道了</el-button></template>
    </el-dialog>

    <el-dialog
      v-model="labelsDialogVisible"
      :title="`编辑节点标签 · ${editingNode?.metadata.name || ''}`"
      width="min(760px, 95vw)"
      :close-on-click-modal="false"
    >
      <p class="dialog-copy">标签将整体替换为以下内容。系统标签请谨慎修改，空键不会提交。</p>
      <div class="editor-toolbar">
        <strong>Labels</strong><el-button :icon="Plus" @click="labelRows.push({ key: '', value: '' })">添加标签</el-button>
      </div>
      <div v-for="(entry, index) in labelRows" :key="index" class="key-value-row">
        <el-input v-model="entry.key" placeholder="标签键，例如 environment" /><el-input
          v-model="entry.value"
          placeholder="标签值，例如 production"
        /><el-button :icon="Delete" @click="labelRows.splice(index, 1)" />
      </div>
      <p v-if="!labelRows.length" class="text-secondary">暂无标签，保存后会清空节点标签。</p>
      <el-alert v-if="dialogError" :title="dialogError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="labelsDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="editorSubmitting" @click="saveLabels">保存标签</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="taintsDialogVisible"
      :title="`编辑节点污点 · ${editingNode?.metadata.name || ''}`"
      width="min(860px, 95vw)"
      :close-on-click-modal="false"
    >
      <el-alert
        title="NoExecute 可能驱逐不能容忍该污点的现有 Pod，请谨慎操作。污点值可以为空。"
        type="warning"
        show-icon
        :closable="false"
        class="dialog-alert"
      />
      <div class="editor-toolbar">
        <strong>Taints</strong
        ><el-button :icon="Plus" @click="taintRows.push({ key: '', value: '', effect: 'NoSchedule' })">添加污点</el-button>
      </div>
      <div v-for="(entry, index) in taintRows" :key="index" class="taint-row">
        <el-input v-model="entry.key" placeholder="Key（必填）" /><el-input v-model="entry.value" placeholder="Value（可选）" /><el-select
          v-model="entry.effect"
          ><el-option label="NoSchedule" value="NoSchedule" /><el-option label="PreferNoSchedule" value="PreferNoSchedule" /><el-option
            label="NoExecute"
            value="NoExecute" /></el-select
        ><el-button :icon="Delete" @click="taintRows.splice(index, 1)" />
      </div>
      <p v-if="!taintRows.length" class="text-secondary">暂无污点，保存后会清空节点污点。</p>
      <el-alert v-if="dialogError" :title="dialogError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="taintsDialogVisible = false">取消</el-button
        ><el-button type="primary" :loading="editorSubmitting" @click="saveTaints">保存污点</el-button></template
      >
    </el-dialog>

    <el-dialog
      v-model="drainDialogVisible"
      :title="`平滑迁移 · ${drainNode?.metadata.name || ''}`"
      width="min(680px, 95vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!drainRunning"
      :show-close="!drainRunning"
    >
      <el-steps :active="drainStep" align-center finish-status="success" process-status="process"
        ><el-step title="禁止调度" /><el-step title="筛选 Pod" /><el-step title="逐个驱逐" /><el-step title="完成"
      /></el-steps>
      <el-alert
        class="drain-status"
        :type="drainPhase === 'error' ? 'error' : drainFailures.length ? 'warning' : drainPhase === 'completed' ? 'success' : 'info'"
        :title="drainStatusText"
        show-icon
        :closable="false"
      />
      <el-progress
        :percentage="drainPercent"
        :status="drainPhase === 'error' ? 'exception' : drainPhase === 'completed' && !drainFailures.length ? 'success' : undefined"
      />
      <p v-if="drainCurrent" class="drain-current">
        正在驱逐：<code>{{ drainCurrent }}</code>
      </p>
      <p v-if="drainTotal" class="text-secondary">已处理 {{ drainCompleted }} / {{ drainTotal }} 个 Pod</p>
      <div v-if="drainFailures.length" class="drain-failures">
        <h3>以下 Pod 驱逐失败（已继续处理其余 Pod）</h3>
        <div v-for="failure in drainFailures" :key="failure.pod" class="failure-item">
          <code>{{ failure.pod }}</code
          ><span>{{ failure.error }}</span>
        </div>
      </div>
      <template #footer
        ><el-button type="primary" :disabled="drainRunning" @click="drainDialogVisible = false">{{
          drainPhase === 'completed' || drainPhase === 'error' ? '关闭' : '处理中'
        }}</el-button></template
      >
    </el-dialog>

    <el-dialog v-model="nodeDeleteDialogVisible" title="删除节点" width="min(540px, 94vw)" :close-on-click-modal="false">
      <el-alert
        :title="`删除节点“${editingNode?.metadata.name}”会从 Kubernetes 集群移除该节点记录，且无法撤销。`"
        type="error"
        show-icon
        :closable="false"
      />
      <p class="dialog-copy">请先完成工作负载迁移并确认主机可以安全下线。输入完整节点名称以确认：</p>
      <el-input v-model="nodeDeleteConfirm" autocomplete="off" :placeholder="editingNode?.metadata.name" />
      <el-alert v-if="dialogError" :title="dialogError" type="error" show-icon :closable="false" />
      <template #footer
        ><el-button @click="nodeDeleteDialogVisible = false">取消</el-button
        ><el-button
          type="danger"
          :loading="editorSubmitting"
          :disabled="nodeDeleteConfirm !== editingNode?.metadata.name"
          @click="deleteNode"
          >确认永久删除</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh, Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import MetricCard from '@/components/MetricCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import YamlEditorDialog from '@/components/YamlEditorDialog.vue'
import { clusterApi } from '@/api/cluster'
import { monitorApi } from '@/api/observability'
import { resourceApi, type ResourceDefinition } from '@/api/resource'
import type { ClusterInfo, KubeResource } from '@/types/api'
import { asText, formatBytes, formatDate, formatNumber, getByPath } from '@/utils/format'
import { useViewport } from '@/composables/useViewport'
import { fromYAML, toYAML } from '@/utils/yaml'

type TabName = 'info' | 'node' | 'storageclass' | 'persistentvolumes' | 'network' | 'monitor'
interface MonitorMetric {
  label: string
  value: string
  unit: string
  query: string
  tone: 'brand' | 'success' | 'warning' | 'info'
}
interface PrometheusResponse {
  data?: { result?: Array<{ value?: [number | string, string] }> }
}
interface KeyValueRow {
  key: string
  value: string
}
interface TaintRow {
  key: string
  value: string
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
}
interface DrainFailure {
  pod: string
  error: string
}
type DrainPhase = 'idle' | 'cordon' | 'listing' | 'evicting' | 'completed' | 'error'
const tabs: Array<{ name: TabName; label: string }> = [
  { name: 'info', label: '详情' },
  { name: 'node', label: '节点' },
  { name: 'storageclass', label: '存储类别' },
  { name: 'persistentvolumes', label: '持久存储' },
  { name: 'network', label: '网络策略' },
  { name: 'monitor', label: '监控' },
]
const definitions: Partial<Record<TabName, ResourceDefinition>> = {
  node: { plural: 'nodes', kind: 'Node', version: 'v1', namespaced: false },
  storageclass: { plural: 'storageclasses', kind: 'StorageClass', group: 'storage.k8s.io', version: 'v1', namespaced: false },
  persistentvolumes: { plural: 'persistentvolumes', kind: 'PersistentVolume', version: 'v1', namespaced: false },
  network: { plural: 'networkpolicies', kind: 'NetworkPolicy', group: 'networking.k8s.io', version: 'v1', namespaced: false },
}
const podDefinition: ResourceDefinition = { plural: 'pods', kind: 'Pod', version: 'v1', namespaced: false }
const networkWriteDefinition: ResourceDefinition = {
  plural: 'networkpolicies',
  kind: 'NetworkPolicy',
  group: 'networking.k8s.io',
  version: 'v1',
  namespaced: true,
}
const route = useRoute()
const router = useRouter()
const cluster = ref<ClusterInfo>()
const summaryLoading = ref(false)
const summaryError = ref('')
const items = ref<KubeResource[]>([])
const tabLoading = ref(false)
const tabError = ref('')
const listKeyword = ref('')
const metrics = ref<MonitorMetric[]>([])
const actionError = ref('')
const operatingName = ref('')
const addNodeDialogVisible = ref(false)
const editingNode = ref<KubeResource>()
const labelsDialogVisible = ref(false)
const taintsDialogVisible = ref(false)
const nodeDeleteDialogVisible = ref(false)
const labelRows = ref<KeyValueRow[]>([])
const taintRows = ref<TaintRow[]>([])
const nodeDeleteConfirm = ref('')
const editorSubmitting = ref(false)
const dialogError = ref('')
const yamlOpen = ref(false)
const yamlTitle = ref('')
const yamlContent = ref('')
const yamlReadOnly = ref(true)
const yamlSubmitting = ref(false)
const drainDialogVisible = ref(false)
const drainNode = ref<KubeResource>()
const drainPhase = ref<DrainPhase>('idle')
const drainRunning = ref(false)
const drainTotal = ref(0)
const drainCompleted = ref(0)
const drainCurrent = ref('')
const drainError = ref('')
const drainFailures = ref<DrainFailure[]>([])
const { width: viewportWidth } = useViewport()
let summaryGeneration = 0
let tabGeneration = 0
const clusterName = computed(() => String(route.params.name || ''))
const activeTab = computed<TabName>(() => (tabs.some((tab) => tab.name === route.params.tab) ? (route.params.tab as TabName) : 'info'))
const clusterTitle = computed(
  () => cluster.value?.clusterDisplayName || cluster.value?.annotations?.['cluster.kubecube.io/cn-name'] || clusterName.value,
)
const currentTabLabel = computed(() => tabs.find((tab) => tab.name === activeTab.value)?.label || '')
const descriptionColumns = computed(() => (viewportWidth.value < 760 ? 1 : 2))
const annotationEntries = computed(() => Object.entries(cluster.value?.annotations || {}))
const listDescription = computed(
  () =>
    (
      ({
        node: '节点列表来自当前集群的 Node API。',
        storageclass: '存储类别来自当前集群的 StorageClass API。',
        persistentvolumes: '持久卷来自当前集群的 PersistentVolume API。',
        network: '网络策略来自当前集群全空间的 NetworkPolicy API。',
      }) as Record<string, string>
    )[activeTab.value] || '',
)
const filteredItems = computed(() => {
  const keyword = listKeyword.value.trim().toLowerCase()
  if (!keyword) return items.value
  return items.value.filter((item) =>
    [item.metadata.name, item.metadata.namespace].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(keyword),
    ),
  )
})
const drainStep = computed(
  () => (({ idle: 0, cordon: 0, listing: 1, evicting: 2, completed: 4, error: 3 }) as Record<DrainPhase, number>)[drainPhase.value],
)
const drainPercent = computed(() => {
  if (drainPhase.value === 'completed') return 100
  if (!drainTotal.value) return 0
  return Math.round((drainCompleted.value / drainTotal.value) * 100)
})
const drainStatusText = computed(() => {
  if (drainPhase.value === 'cordon') return '正在禁止新 Pod 调度到该节点，尚未开始驱逐。'
  if (drainPhase.value === 'listing') return '节点已禁止调度，正在读取并筛选需要迁移的 Pod。'
  if (drainPhase.value === 'evicting') return `正在逐个驱逐 Pod；单个子任务失败不会中断其余迁移。`
  if (drainPhase.value === 'error') return drainError.value || '平滑迁移失败，已保留当前进度与节点数据。'
  if (drainPhase.value === 'completed')
    return drainFailures.value.length
      ? `迁移流程结束：${drainCompleted.value - drainFailures.value.length} 个成功，${drainFailures.value.length} 个失败。请处理失败项后重试。`
      : drainTotal.value
        ? `已完成 ${drainCompleted.value} 个 Pod 的驱逐请求。`
        : '节点已禁止调度，没有需要驱逐的 Pod。'
  return '准备开始平滑迁移。'
})
function text(value: unknown) {
  return asText(value)
}
function statusLabel(status?: string) {
  return (
    ({ normal: '正常', abnormal: '异常', processing: '接入中', deleting: '删除中' } as Record<string, string>)[status || ''] ||
    status ||
    '未知'
  )
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : '请求失败，请稍后重试'
}
function changeTab(name: string | number) {
  if (tabs.some((tab) => tab.name === name))
    router.push({ path: `/platform/cluster/${encodeURIComponent(clusterName.value)}/${String(name)}`, query: route.query })
}
function nodeReady(row: KubeResource) {
  const conditions = getByPath(row, 'status.conditions') as Array<{ type?: string; status?: string }> | undefined
  return conditions?.some((item) => item.type === 'Ready' && item.status === 'True') || false
}
function nodeAddress(row: KubeResource) {
  const addresses = getByPath(row, 'status.addresses') as Array<{ type?: string; address?: string }> | undefined
  return addresses?.find((item) => item.type === 'InternalIP')?.address || '—'
}
function nodeRoles(row: KubeResource) {
  const roles = Object.keys(row.metadata.labels || {})
    .filter((key) => key.startsWith('node-role.kubernetes.io/'))
    .map((key) => key.split('/')[1])
  return roles?.join(', ') || 'worker'
}
function isDefaultStorageClass(row: KubeResource) {
  return row.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
}
function volumeClaim(row: KubeResource) {
  const namespace = getByPath(row, 'spec.claimRef.namespace')
  const name = getByPath(row, 'spec.claimRef.name')
  return name ? `${namespace || '—'} / ${name}` : '—'
}
function ruleCount(row: KubeResource, key: string) {
  const rules = getByPath(row, `spec.${key}`)
  return Array.isArray(rules) ? rules.length : 0
}
function openLabels(row: KubeResource) {
  editingNode.value = row
  labelRows.value = Object.entries(row.metadata.labels || {}).map(([key, value]) => ({ key, value }))
  dialogError.value = ''
  labelsDialogVisible.value = true
}
function openTaints(row: KubeResource) {
  editingNode.value = row
  const taints = (getByPath(row, 'spec.taints') as Array<{ key?: string; value?: string; effect?: TaintRow['effect'] }> | undefined) || []
  taintRows.value = taints.map((taint) => ({ key: taint.key || '', value: taint.value || '', effect: taint.effect || 'NoSchedule' }))
  dialogError.value = ''
  taintsDialogVisible.value = true
}
async function replaceNode(name: string, mutate: (resource: KubeResource) => void) {
  const latest = await resourceApi.get(definitions.node!, { cluster: clusterName.value, name })
  mutate(latest)
  await resourceApi.replace(definitions.node!, { cluster: clusterName.value, name }, latest)
}
async function saveLabels() {
  const node = editingNode.value
  if (!node || editorSubmitting.value) return
  const usable = labelRows.value.filter((entry) => entry.key.trim() || entry.value)
  if (usable.some((entry) => !entry.key.trim())) {
    dialogError.value = '标签键不能为空，请填写或移除该行的值。'
    return
  }
  const keys = usable.map((entry) => entry.key.trim())
  if (new Set(keys).size !== keys.length) {
    dialogError.value = '标签键不能重复。'
    return
  }
  editorSubmitting.value = true
  dialogError.value = ''
  try {
    await replaceNode(node.metadata.name, (latest) => {
      latest.metadata.labels = Object.fromEntries(usable.map((entry) => [entry.key.trim(), entry.value]))
    })
    ElMessage.success('节点标签已更新')
    labelsDialogVisible.value = false
    await loadTab()
  } catch (error) {
    dialogError.value = `标签保存失败：${errorText(error)}`
  } finally {
    editorSubmitting.value = false
  }
}
async function saveTaints() {
  const node = editingNode.value
  if (!node || editorSubmitting.value) return
  const usable = taintRows.value.filter((entry) => entry.key.trim() || entry.value)
  if (usable.some((entry) => !entry.key.trim())) {
    dialogError.value = '污点 Key 不能为空，请填写或移除该行。'
    return
  }
  const identities = usable.map((entry) => `${entry.key.trim()}/${entry.effect}`)
  if (new Set(identities).size !== identities.length) {
    dialogError.value = '相同 Key 与 Effect 的污点不能重复。'
    return
  }
  editorSubmitting.value = true
  dialogError.value = ''
  try {
    await replaceNode(node.metadata.name, (latest) => {
      latest.spec = {
        ...(latest.spec || {}),
        taints: usable.map((entry) => ({ key: entry.key.trim(), ...(entry.value ? { value: entry.value } : {}), effect: entry.effect })),
      }
    })
    ElMessage.success('节点污点已更新')
    taintsDialogVisible.value = false
    await loadTab()
  } catch (error) {
    dialogError.value = `污点保存失败：${errorText(error)}`
  } finally {
    editorSubmitting.value = false
  }
}
async function toggleScheduling(row: KubeResource) {
  if (operatingName.value) return
  const unschedulable = Boolean(getByPath(row, 'spec.unschedulable'))
  if (!unschedulable) {
    try {
      await ElMessageBox.confirm(`确定禁止新的工作负载调度到节点“${row.metadata.name}”吗？已有 Pod 不会被自动驱逐。`, '禁止调度', {
        type: 'warning',
        confirmButtonText: '确认禁止',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  operatingName.value = row.metadata.name
  actionError.value = ''
  try {
    await resourceApi.patch(
      definitions.node!,
      { cluster: clusterName.value, name: row.metadata.name },
      { spec: { unschedulable: !unschedulable } },
      'merge',
    )
    ElMessage.success(unschedulable ? '节点已允许调度' : '节点已禁止调度')
    await loadTab()
  } catch (error) {
    actionError.value = `调度状态更新失败：${errorText(error)}`
  } finally {
    operatingName.value = ''
  }
}
function nodeDeleteForbidden(row: KubeResource) {
  const labels = row.metadata.labels || {}
  return (
    Object.keys(labels).some((key) => ['node-role.kubernetes.io/master', 'node-role.kubernetes.io/control-plane'].includes(key)) ||
    labels['kubernetes.io/app'] === 'ingress-nginx' ||
    labels['system/helm'] === 'true'
  )
}
function openNodeDelete(row: KubeResource) {
  if (nodeDeleteForbidden(row)) {
    actionError.value = '控制面、Ingress 控制器或系统节点不允许从页面删除。'
    return
  }
  editingNode.value = row
  nodeDeleteConfirm.value = ''
  dialogError.value = ''
  nodeDeleteDialogVisible.value = true
}
async function deleteNode() {
  const node = editingNode.value
  if (!node || nodeDeleteConfirm.value !== node.metadata.name || editorSubmitting.value) return
  editorSubmitting.value = true
  dialogError.value = ''
  try {
    await resourceApi.delete(definitions.node!, { cluster: clusterName.value, name: node.metadata.name })
    ElMessage.success('节点删除请求已提交')
    nodeDeleteDialogVisible.value = false
    await loadTab()
  } catch (error) {
    dialogError.value = `节点删除失败：${errorText(error)}`
  } finally {
    editorSubmitting.value = false
  }
}
async function confirmDrain(row: KubeResource) {
  if (drainRunning.value || operatingName.value) return
  try {
    await ElMessageBox.confirm(
      `将先禁止节点“${row.metadata.name}”调度，再逐个驱逐业务 Pod。kube-public、kube-system 及 DaemonSet Pod 会按旧版规则跳过。确定继续吗？`,
      '平滑迁移',
      { type: 'warning', confirmButtonText: '开始迁移', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await startDrain(row)
}
function failDrain(message: string) {
  drainPhase.value = 'error'
  drainError.value = message
  drainCurrent.value = ''
  drainRunning.value = false
}
async function startDrain(row: KubeResource) {
  drainNode.value = row
  drainDialogVisible.value = true
  drainRunning.value = true
  drainPhase.value = 'cordon'
  drainTotal.value = 0
  drainCompleted.value = 0
  drainCurrent.value = ''
  drainError.value = ''
  drainFailures.value = []
  try {
    await resourceApi.patch(
      definitions.node!,
      { cluster: clusterName.value, name: row.metadata.name },
      { spec: { unschedulable: true } },
      'merge',
    )
  } catch (error) {
    failDrain(`禁止调度失败：${errorText(error)}。尚未驱逐任何 Pod。`)
    return
  }
  drainPhase.value = 'listing'
  let pods: KubeResource[]
  try {
    const response = await resourceApi.list(podDefinition, { cluster: clusterName.value }, {
      pageNum: 1,
      pageSize: 10000,
      fieldSelector: `spec.nodeName=${row.metadata.name}`,
    } as Parameters<typeof resourceApi.list>[2])
    pods = response.items || []
  } catch (error) {
    failDrain(`Pod 列表读取失败：${errorText(error)}。节点已禁止调度，请确认后手动恢复或重试。`)
    await loadTab()
    return
  }
  const targets = pods.filter(
    (pod) =>
      !['kube-public', 'kube-system'].includes(pod.metadata.namespace || '') &&
      (pod.metadata.ownerReferences as Array<{ kind?: string }> | undefined)?.[0]?.kind !== 'DaemonSet',
  )
  drainTotal.value = targets.length
  drainPhase.value = 'evicting'
  for (const pod of targets) {
    const namespace = pod.metadata.namespace || ''
    const name = pod.metadata.name
    const identity = `${namespace}/${name}`
    drainCurrent.value = identity
    try {
      if (!namespace) throw new Error('Pod 缺少命名空间')
      await resourceApi.evictPod(clusterName.value, namespace, name, {
        apiVersion: 'policy/v1beta1',
        kind: 'Eviction',
        metadata: { name, namespace },
      })
    } catch (error) {
      drainFailures.value.push({ pod: identity, error: errorText(error) })
    } finally {
      drainCompleted.value += 1
    }
  }
  drainCurrent.value = ''
  drainPhase.value = 'completed'
  drainRunning.value = false
  await loadTab()
  if (drainFailures.value.length) ElMessage.warning(`平滑迁移结束，${drainFailures.value.length} 个 Pod 驱逐失败`)
  else ElMessage.success('平滑迁移流程已完成')
}
function openStorageClassCreate() {
  yamlTitle.value = '创建 StorageClass'
  yamlContent.value = toYAML({
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: { name: 'example-storage' },
    provisioner: 'kubernetes.io/no-provisioner',
    reclaimPolicy: 'Delete',
    volumeBindingMode: 'WaitForFirstConsumer',
  })
  yamlReadOnly.value = false
  yamlOpen.value = true
}
function openReadonlyYaml(row: KubeResource) {
  yamlTitle.value = `${row.metadata.name} · 只读 YAML`
  yamlContent.value = toYAML(row)
  yamlReadOnly.value = true
  yamlOpen.value = true
}
async function createStorageClass(content: string) {
  if (yamlReadOnly.value || yamlSubmitting.value) return
  yamlSubmitting.value = true
  actionError.value = ''
  try {
    const resource = fromYAML<KubeResource & { provisioner?: string }>(content)
    if (resource.apiVersion !== 'storage.k8s.io/v1' || resource.kind !== 'StorageClass')
      throw new Error('请输入 storage.k8s.io/v1 的 StorageClass')
    if (!resource.metadata?.name || !resource.provisioner) throw new Error('StorageClass 必须包含 metadata.name 与 provisioner')
    await resourceApi.create(definitions.storageclass!, { cluster: clusterName.value }, resource)
    ElMessage.success(`StorageClass ${resource.metadata.name} 已创建`)
    yamlOpen.value = false
    await loadTab()
  } catch (error) {
    actionError.value = `StorageClass 创建失败：${errorText(error)}`
    ElMessage.error(actionError.value)
  } finally {
    yamlSubmitting.value = false
  }
}
async function removeResource(row: KubeResource, definition: ResourceDefinition, namespace: string | undefined, message: string) {
  if (operatingName.value) return
  try {
    await ElMessageBox.confirm(message, `删除${currentTabLabel.value}`, {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  operatingName.value = row.metadata.name
  actionError.value = ''
  try {
    await resourceApi.delete(definition, { cluster: clusterName.value, namespace, name: row.metadata.name })
    ElMessage.success(`${currentTabLabel.value} ${row.metadata.name} 删除请求已提交`)
    await loadTab()
  } catch (error) {
    actionError.value = `${currentTabLabel.value}删除失败：${errorText(error)}`
  } finally {
    operatingName.value = ''
  }
}
function deleteStorageClass(row: KubeResource) {
  void removeResource(
    row,
    definitions.storageclass!,
    undefined,
    `确定删除 StorageClass“${row.metadata.name}”吗？已有 PV/PVC 不会自动删除，但新的动态供给将不可用它。`,
  )
}
function deletePersistentVolume(row: KubeResource) {
  void removeResource(
    row,
    definitions.persistentvolumes!,
    undefined,
    `确定删除持久卷“${row.metadata.name}”吗？请确认绑定声明与数据已妥善处理，回收策略为 ${text(getByPath(row, 'spec.persistentVolumeReclaimPolicy'))}。`,
  )
}
function deleteNetworkPolicy(row: KubeResource) {
  if (!row.metadata.namespace) {
    actionError.value = 'NetworkPolicy 缺少命名空间，无法删除。'
    return
  }
  void removeResource(
    row,
    networkWriteDefinition,
    row.metadata.namespace,
    `确定删除 ${row.metadata.namespace}/${row.metadata.name} 网络策略吗？删除后对应网络约束将失效。`,
  )
}
function createNetworkPolicy() {
  router.push({
    name: 'platform.cluster.detail.network.create',
    params: { name: clusterName.value },
    query: { ...route.query, cluster: clusterName.value },
  })
}
function editNetworkPolicy(row: KubeResource) {
  if (!row.metadata.namespace) {
    actionError.value = 'NetworkPolicy 缺少命名空间，无法进入编辑器。'
    return
  }
  router.push({
    name: 'platform.cluster.detail.network.edit',
    params: { name: clusterName.value, namespace: row.metadata.namespace, instance: row.metadata.name },
    query: { ...route.query, cluster: clusterName.value },
  })
}
function metricDisplay(metric: MonitorMetric) {
  if (!metric.value) return { value: '暂无数据', unit: '' }
  const number = Number(metric.value)
  if (!Number.isFinite(number)) return { value: metric.value, unit: metric.unit }
  if (metric.unit === '%') return { value: formatNumber(number * 100, 1), unit: '%' }
  return { value: formatNumber(number, 2), unit: metric.unit }
}
async function loadSummary() {
  if (!clusterName.value) return
  const generation = ++summaryGeneration
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const response = await clusterApi.list({ cluster: clusterName.value })
    if (generation !== summaryGeneration) return
    const current = (response.items || []).find((item) => item.clusterName === clusterName.value) || response.items?.[0]
    if (!current) throw new Error('集群信息接口未返回当前集群')
    cluster.value = current
  } catch (error) {
    if (generation === summaryGeneration) summaryError.value = `集群摘要加载失败：${errorText(error)}`
  } finally {
    if (generation === summaryGeneration) summaryLoading.value = false
  }
}
function promSelector() {
  return clusterName.value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
async function loadMonitor(generation: number) {
  const clusterLabel = promSelector()
  const definitions = [
    {
      label: '就绪节点',
      unit: '个',
      tone: 'success' as const,
      query: `sum(kube_node_status_condition{cluster="${clusterLabel}",condition="Ready",status="true"})`,
    },
    {
      label: 'CPU 空闲率',
      unit: '%',
      tone: 'brand' as const,
      query: `avg(rate(node_cpu_seconds_total{cluster="${clusterLabel}",mode="idle"}[5m]))`,
    },
    {
      label: '内存可用率',
      unit: '%',
      tone: 'info' as const,
      query: `sum(node_memory_MemAvailable_bytes{cluster="${clusterLabel}"}) / sum(node_memory_MemTotal_bytes{cluster="${clusterLabel}"})`,
    },
  ]
  const responses = await Promise.all(definitions.map((item) => monitorApi.query({ query: item.query, time: Date.now() / 1000 })))
  if (generation !== tabGeneration) return
  metrics.value = definitions.map((item, index) => ({
    ...item,
    value: (responses[index] as PrometheusResponse)?.data?.result?.[0]?.value?.[1] || '',
  }))
}
async function loadTab() {
  if (!clusterName.value || activeTab.value === 'info') return
  const generation = ++tabGeneration
  tabLoading.value = true
  tabError.value = ''
  try {
    if (activeTab.value === 'monitor') await loadMonitor(generation)
    else {
      const definition = definitions[activeTab.value]
      if (!definition) return
      const response = await resourceApi.list(definition, { cluster: clusterName.value }, { pageNum: 1, pageSize: 1000 })
      if (generation === tabGeneration) items.value = response.items || []
    }
  } catch (error) {
    if (generation === tabGeneration) tabError.value = `${currentTabLabel.value}加载失败：${errorText(error)}`
  } finally {
    if (generation === tabGeneration) tabLoading.value = false
  }
}
function refreshCurrent() {
  void loadSummary()
  void loadTab()
}
watch(
  clusterName,
  (value, previous) => {
    if (value !== previous) {
      cluster.value = undefined
      items.value = []
      metrics.value = []
      summaryError.value = ''
      tabError.value = ''
      listKeyword.value = ''
      void loadSummary()
    }
  },
  { immediate: true },
)
watch(
  [clusterName, activeTab],
  ([clusterValue, tabValue], previous) => {
    if (!previous || clusterValue !== previous[0] || tabValue !== previous[1]) {
      items.value = []
      metrics.value = []
      listKeyword.value = ''
      tabError.value = ''
      void loadTab()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  summaryGeneration++
  tabGeneration++
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.summary-skeleton {
  min-height: 130px;
  padding: 24px;
}
.detail-surface {
  overflow: hidden;
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
.tab-content {
  min-height: 360px;
  padding: 24px;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.section-heading h2 {
  font-size: 17px;
}
.section-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}
.list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.list-search {
  width: 240px;
}
.tab-alert {
  margin-bottom: 16px;
}
.metadata-section {
  margin-top: 24px;
}
.metadata-section h3 {
  margin-bottom: 12px;
  font-size: 14px;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-list .el-tag {
  max-width: 100%;
  height: auto;
  min-height: 28px;
  white-space: normal;
  word-break: break-all;
}
.cell-subtitle {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}
.inline-tag {
  margin-left: 8px;
}
.selector-text {
  font-size: 12px;
  word-break: break-all;
}
.list-count {
  margin-top: 14px;
  text-align: right;
  font-size: 13px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.metric-skeleton {
  padding: 24px;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}
.query-collapse {
  margin-top: 20px;
}
.query-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 16px;
  padding: 8px 0;
}
.query-row code {
  overflow-wrap: anywhere;
  color: var(--text-secondary);
}
.dialog-copy {
  margin: 20px 0;
  color: var(--text-secondary);
  line-height: 1.7;
}
.dialog-alert {
  margin-bottom: 18px;
}
.danger-text {
  color: var(--danger);
}
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.key-value-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px;
  gap: 10px;
  margin-bottom: 10px;
}
.taint-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(150px, 0.8fr) 40px;
  gap: 10px;
  margin-bottom: 10px;
}
.drain-status {
  margin: 24px 0 18px;
}
.drain-current {
  margin: 16px 0 6px;
}
.drain-failures {
  max-height: 220px;
  margin-top: 18px;
  padding: 14px;
  overflow-y: auto;
  background: var(--surface-subtle);
  border-radius: 8px;
}
.drain-failures h3 {
  margin-bottom: 10px;
  color: var(--danger);
  font-size: 13px;
}
.failure-item {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
  padding: 7px 0;
  border-top: 1px solid var(--border-light);
}
.failure-item span {
  color: var(--text-secondary);
  word-break: break-word;
}
@media (max-width: 1100px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .detail-tabs {
    padding: 0 14px;
    overflow-x: auto;
  }
  .tab-content {
    padding: 16px;
  }
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }
  .list-actions {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .list-search {
    width: 100%;
  }
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .query-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .key-value-row,
  .taint-row,
  .failure-item {
    grid-template-columns: 1fr;
  }
}
</style>
