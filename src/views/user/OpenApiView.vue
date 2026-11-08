<template>
  <div class="page page-stack">
    <PageHeader
      title="OpenAPI 密钥"
      description="管理当前账号的 API 访问凭证。创建成功后，secretKey 仅在本次弹窗中完整展示，请立即妥善保存。"
      :breadcrumbs="['个人中心']"
    >
      <template #actions>
        <el-button type="primary" :icon="Plus" :loading="creating" @click="createKey">创建密钥</el-button>
      </template>
    </PageHeader>

    <el-alert title="请勿在代码仓库、日志或聊天工具中泄露密钥。复制配置前请确认周围环境安全。" type="warning" :closable="false" show-icon />

    <section class="surface surface-padded page-stack" aria-label="密钥列表">
      <div class="toolbar">
        <div>
          <h2 class="section-title">访问凭证</h2>
          <p class="text-secondary section-description">每个账号最多可创建的密钥数量由后端限制。</p>
        </div>
        <el-button text :icon="Refresh" :loading="loading" @click="loadKeys">刷新</el-button>
      </div>

      <el-alert
        v-if="loadError && credentials.length"
        title="密钥列表刷新失败，仍显示上次成功加载的数据。"
        type="error"
        :closable="false"
        show-icon
      >
        <el-button link type="primary" @click="loadKeys">重新加载</el-button>
      </el-alert>

      <el-table v-loading="loading" :data="credentials" :row-key="credentialKey">
        <el-table-column label="名称" min-width="150">
          <template #default="{ row }">
            <div class="key-name">
              <span class="key-icon" aria-hidden="true"
                ><el-icon><Key /></el-icon
              ></span>
              <strong>{{ row.displayName }}</strong>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="accessKey" min-width="250">
          <template #default="{ row }">
            <div class="secret-cell">
              <code class="truncate">{{ row.accessKey }}</code>
              <el-button link :icon="CopyDocument" aria-label="复制 accessKey" @click="copyText(row.accessKey, 'accessKey 已复制')" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="secretKey" min-width="150">
          <template #default="{ row }">
            <el-tooltip
              :content="row.secretKey ? '完整值不会在列表中展示，可通过复制配置获取' : '列表响应未包含 secretKey'"
              placement="top"
            >
              <code class="masked-secret">{{ row.secretKey ? '••••••••••••••••' : '不可见' }}</code>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="165">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="最近使用" min-width="165">
          <template #default="{ row }">{{ formatDate(row.lastUsedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="310" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" :disabled="!row.secretKey" @click="copyConfig(row, 'properties')">复制 properties</el-button>
              <el-button link type="primary" :disabled="!row.secretKey" @click="copyConfig(row, 'yaml')">复制 YAML</el-button>
              <el-button link type="danger" :loading="deletingKey === row.accessKey" @click="removeKey(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <EmptyState
            v-if="loadError"
            title="密钥列表加载失败"
            description="请检查网络或后端服务后重试。"
            action-text="重新加载"
            @action="loadKeys"
          />
          <EmptyState
            v-else
            title="暂无 API 密钥"
            description="创建密钥后，请立即复制并安全保存 secretKey。"
            action-text="创建密钥"
            @action="createKey"
          />
        </template>
      </el-table>
      <p v-if="credentials.some((item) => !item.secretKey)" class="text-tertiary list-footnote">
        部分历史密钥的列表响应未返回 secretKey，因此不能复制完整配置；不会使用掩码或占位符伪造配置。
      </p>
    </section>

    <el-dialog
      v-model="secretDialogVisible"
      title="密钥创建成功"
      width="660px"
      :close-on-click-modal="false"
      @closed="discardCreatedCredential"
    >
      <div v-if="createdCredential" class="credential-result">
        <el-alert
          title="secretKey 仅此弹窗展示一次"
          description="关闭弹窗后将清除本次创建响应，请立即复制并保存到安全的凭证管理工具中。"
          type="warning"
          :closable="false"
          show-icon
        />
        <div class="credential-field">
          <span>accessKey</span>
          <div>
            <code>{{ createdCredential.accessKey }}</code
            ><el-button link :icon="CopyDocument" @click="copyText(createdCredential.accessKey, 'accessKey 已复制')" />
          </div>
        </div>
        <div class="credential-field credential-field--secret">
          <span>secretKey</span>
          <div>
            <code>{{ createdCredential.secretKey }}</code
            ><el-button link :icon="CopyDocument" @click="copyText(createdCredential.secretKey, 'secretKey 已复制')" />
          </div>
        </div>
        <el-tabs v-model="createdFormat" class="config-tabs">
          <el-tab-pane label="properties" name="properties" />
          <el-tab-pane label="YAML" name="yaml" />
        </el-tabs>
        <pre class="config-preview"><code>{{ createdConfigText }}</code></pre>
        <el-button class="copy-config" type="primary" plain :icon="CopyDocument" @click="copyConfig(createdCredential, createdFormat)">
          复制 {{ createdFormat === 'yaml' ? 'YAML' : 'properties' }} 配置
        </el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="secretDialogVisible = false">我已妥善保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Key, Plus, Refresh } from '@element-plus/icons-vue'
import { stringify as stringifyYaml } from 'yaml'
import { userApi } from '@/api/auth'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatDate } from '@/utils/format'

type ConfigFormat = 'properties' | 'yaml'
interface Credential {
  displayName: string
  accessKey: string
  secretKey: string
  createdAt: string
  lastUsedAt: string
}

const credentials = ref<Credential[]>([])
const loading = ref(false)
const loadError = ref(false)
const creating = ref(false)
const deletingKey = ref('')
const createdCredential = ref<Credential | null>(null)
const secretDialogVisible = ref(false)
const createdFormat = ref<ConfigFormat>('properties')
let listGeneration = 0

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

function normalizeCredential(value: unknown): Credential {
  const data = record(value)
  const metadata = record(data.metadata)
  const spec = record(data.spec)
  const accessKey = text(metadata.name || data.accessKey || data.name)
  const friendlyName = text(data.name)
  return {
    displayName: friendlyName && friendlyName !== accessKey ? friendlyName : 'API 密钥',
    accessKey,
    secretKey: text(spec.secretKey || data.secretKey),
    createdAt: text(metadata.creationTimestamp || data.createdAt || data.creationTimestamp),
    lastUsedAt: text(data.lastUsedAt || data.lastUsedTime),
  }
}

function credentialKey(credential: Credential): string {
  return credential.accessKey
}

async function loadKeys() {
  const generation = ++listGeneration
  loading.value = true
  try {
    const response = await userApi.keys()
    if (generation !== listGeneration) return
    credentials.value = (response.items || []).map(normalizeCredential).filter((item) => item.accessKey)
    loadError.value = false
  } catch {
    if (generation === listGeneration) loadError.value = true
  } finally {
    if (generation === listGeneration) loading.value = false
  }
}

async function createKey() {
  creating.value = true
  try {
    const credential = normalizeCredential(await userApi.createKey())
    if (!credential.accessKey || !credential.secretKey) {
      ElMessage.warning('创建接口已返回，但响应缺少 accessKey 或 secretKey，请检查后端返回并核对列表')
    } else {
      createdCredential.value = credential
      createdFormat.value = 'properties'
      secretDialogVisible.value = true
      ElMessage.success('密钥创建成功，请立即保存 secretKey')
    }
    await loadKeys()
  } catch {
    // 创建失败时不打开结果弹窗，也不清空旧列表。
  } finally {
    creating.value = false
  }
}

function discardCreatedCredential() {
  createdCredential.value = null
  createdFormat.value = 'properties'
}

function configText(credential: Credential, format: ConfigFormat): string {
  if (format === 'yaml') return stringifyYaml({ accessKey: credential.accessKey, secretKey: credential.secretKey }).trimEnd()
  return `accessKey=${credential.accessKey}\nsecretKey=${credential.secretKey}`
}

const createdConfigText = computed(() => (createdCredential.value ? configText(createdCredential.value, createdFormat.value) : ''))

async function copyText(value: string, successMessage: string) {
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) throw new Error('浏览器未允许复制')
    }
    ElMessage.success(successMessage)
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限后重试')
  }
}

async function copyConfig(credential: Credential, format: ConfigFormat) {
  if (!credential.secretKey) {
    ElMessage.warning('列表未返回 secretKey，无法复制完整配置')
    return
  }
  await copyText(configText(credential, format), `${format === 'yaml' ? 'YAML' : 'properties'} 配置已复制`)
}

async function removeKey(credential: Credential) {
  try {
    await ElMessageBox.confirm(`删除后，使用 accessKey ${credential.accessKey} 的调用将立即失效，且无法恢复。确认继续吗？`, '删除密钥', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }
  deletingKey.value = credential.accessKey
  try {
    await userApi.deleteKey(credential.accessKey)
    ElMessage.success('密钥已删除')
    if (createdCredential.value?.accessKey === credential.accessKey) secretDialogVisible.value = false
    await loadKeys()
  } catch {
    // 删除失败时保留原列表。
  } finally {
    deletingKey.value = ''
  }
}

onMounted(loadKeys)
</script>

<style scoped>
.section-title {
  font-size: 16px;
}
.section-description {
  margin-top: 4px;
  font-size: 12px;
}
.key-name {
  display: flex;
  align-items: center;
  gap: 9px;
}
.key-icon {
  display: grid;
  width: 30px;
  height: 30px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 8px;
  place-items: center;
}
.secret-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.secret-cell code {
  font-size: 12px;
}
.masked-secret {
  color: var(--text-tertiary);
  letter-spacing: 1px;
}
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px 8px;
}
.list-footnote {
  font-size: 12px;
  line-height: 18px;
}
.credential-result {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.credential-field > span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.credential-field > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.credential-field code {
  overflow-wrap: anywhere;
  font-size: 13px;
}
.credential-field--secret > div {
  background: #fffaeb;
  border-color: #fedf89;
}
.config-tabs {
  margin-bottom: -12px;
}
.config-preview {
  max-height: 180px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  color: #e4e7ec;
  background: #101828;
  border-radius: 10px;
  font-size: 13px;
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.copy-config {
  align-self: flex-start;
}
@media (max-width: 768px) {
  .credential-field > div {
    align-items: flex-start;
  }
  .copy-config {
    width: 100%;
  }
}
</style>
