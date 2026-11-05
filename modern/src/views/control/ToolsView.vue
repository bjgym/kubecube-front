<template>
  <div class="page page-stack tools-page">
    <PageHeader
      title="常用工具"
      description="下载专属 kubeconfig，在本地终端安全地访问和管理已授权的 Kubernetes 资源"
      :breadcrumbs="['资源管理', '常用工具']"
    >
      <template #actions>
        <a class="docs-link" href="https://kubernetes.io/zh-cn/docs/tasks/tools/" target="_blank" rel="noopener noreferrer">
          <el-icon><Link /></el-icon> kubectl 官方文档
        </a>
      </template>
    </PageHeader>

    <section class="tool-hero surface">
      <div class="tool-hero__icon">
        <el-icon><Monitor /></el-icon>
      </div>
      <div class="tool-hero__content">
        <span class="tool-hero__eyebrow">COMMAND LINE WORKSPACE</span>
        <h2>从浏览器到终端，继续您的工作</h2>
        <p>配置文件包含当前账户的访问凭证，请妥善保管，不要提交到代码仓库或发送给他人。</p>
        <div class="scope-chips">
          <el-tag effect="plain" type="info">当前集群：{{ scope.cluster || '未选择' }}</el-tag>
          <el-tag v-if="scope.namespace" effect="plain" type="info">默认空间：{{ scope.namespace }}</el-tag>
        </div>
      </div>
      <div class="tool-hero__action">
        <el-button type="primary" size="large" :icon="Download" :loading="downloading" @click="downloadKubeconfig">
          {{ downloading ? '正在生成…' : '下载 kubeconfig' }}
        </el-button>
        <span>文件名：config.yaml</span>
      </div>
    </section>

    <el-alert v-if="downloadError" :title="downloadError" type="error" show-icon closable @close="downloadError = ''" />

    <div class="setup-grid">
      <section class="surface surface-padded setup-card">
        <div class="section-heading">
          <span class="step-number">01</span>
          <div>
            <h2>安装 kubectl</h2>
            <p>请选择您的操作系统，复制命令到本地终端执行</p>
          </div>
        </div>
        <el-tabs v-model="activeSystem" class="system-tabs">
          <el-tab-pane v-for="guide in installGuides" :key="guide.key" :label="guide.label" :name="guide.key">
            <div class="command-block">
              <div class="command-block__header">
                <span>{{ guide.terminal }}</span
                ><el-button link type="primary" :icon="CopyDocument" @click="copyCommand(guide.command, `install-${guide.key}`)"
                  >复制命令</el-button
                >
              </div>
              <pre><code>{{ guide.command }}</code></pre>
            </div>
            <p class="command-note">{{ guide.note }}</p>
          </el-tab-pane>
        </el-tabs>
        <div class="version-check">
          <span>安装完成后验证版本</span><code>kubectl version --client</code
          ><el-button
            link
            type="primary"
            :icon="CopyDocument"
            aria-label="复制版本检查命令"
            @click="copyCommand('kubectl version --client', 'version')"
          />
        </div>
      </section>

      <section class="surface surface-padded setup-card">
        <div class="section-heading">
          <span class="step-number">02</span>
          <div>
            <h2>配置访问凭证</h2>
            <p>将下载的文件放入用户目录下的 .kube 文件夹</p>
          </div>
        </div>
        <ol class="config-steps">
          <li>
            <span>1</span>
            <div>
              <strong>备份已有配置</strong>
              <p>如果 ~/.kube/config 已存在，请先备份，避免覆盖其他集群的访问配置。</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>放置 config.yaml</strong>
              <p>将下载的文件重命名为 config，并移动到 ~/.kube/config；Windows 路径为 %USERPROFILE%\.kube\config。</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>验证配置</strong>
              <p>执行下方命令，确认能够显示当前上下文和集群信息。</p>
            </div>
          </li>
        </ol>
        <div class="inline-command">
          <code>kubectl config view</code
          ><el-button link type="primary" :icon="CopyDocument" @click="copyCommand('kubectl config view', 'config-view')">复制</el-button>
        </div>
        <p class="config-alternative">
          也可以保留原文件名，通过 <code>kubectl --kubeconfig=/path/to/config.yaml get nodes</code> 临时指定配置。
        </p>
      </section>
    </div>

    <section class="surface surface-padded commands-section">
      <div class="section-heading commands-heading">
        <span class="step-number">03</span>
        <div>
          <h2>常用命令速查</h2>
          <p>点击即可复制；示例空间已根据当前工作空间自动填充</p>
        </div>
      </div>
      <div class="command-cards">
        <article v-for="command in commonCommands" :key="command.id" class="command-card">
          <div class="command-card__title">
            <span
              ><el-icon><Document /></el-icon>{{ command.title }}</span
            ><el-button
              link
              type="primary"
              :icon="CopyDocument"
              :aria-label="`复制${command.title}命令`"
              @click="copyCommand(command.command, command.id)"
            />
          </div>
          <code>{{ command.command }}</code>
          <p>{{ command.description }}</p>
        </article>
      </div>
    </section>

    <el-alert type="warning" show-icon :closable="false" title="安全提示">
      <template #default
        >请仅管理您已获授权的资源。通过 kubectl 创建资源时，需按照平台租户与项目规范添加相应 labels； kubeconfig
        泄露后请立即联系管理员重置凭证。</template
      >
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Document, Download, Link, Monitor } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { userApi } from '@/api/auth'
import { useScopeStore } from '@/stores/scope'

type SystemKey = 'windows' | 'macos' | 'linux'

const scope = useScopeStore()
const downloading = ref(false)
const downloadError = ref('')
const activeSystem = ref<SystemKey>('windows')

const installGuides: Array<{ key: SystemKey; label: string; terminal: string; command: string; note: string }> = [
  {
    key: 'windows',
    label: 'Windows',
    terminal: 'PowerShell',
    command: 'winget install -e --id Kubernetes.kubectl',
    note: '也可以从 Kubernetes 官方发布页下载 kubectl.exe，并将其所在目录加入 PATH。',
  },
  {
    key: 'macos',
    label: 'macOS',
    terminal: 'Terminal · Homebrew',
    command: 'brew install kubectl',
    note: '支持 Intel 与 Apple Silicon。未安装 Homebrew 时，请参考官方文档使用二进制文件安装。',
  },
  {
    key: 'linux',
    label: 'Linux',
    terminal: 'Shell · amd64',
    command:
      'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"\nchmod +x kubectl\nsudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl\nrm kubectl',
    note: '其他 CPU 架构请将 amd64 替换为 arm64 等对应架构。',
  },
]

const commonCommands = computed(() => {
  const namespace = scope.namespace || 'default'
  return [
    { id: 'nodes', title: '查看集群节点', command: 'kubectl get nodes -o wide', description: '查看节点状态、角色、内外网地址与版本信息。' },
    {
      id: 'pods',
      title: '查看全部 Pod',
      command: 'kubectl get pods -A -o wide',
      description: '跨命名空间查看工作负载运行状态及所在节点。',
    },
    {
      id: 'namespace-pods',
      title: '查看当前空间 Pod',
      command: `kubectl get pods -n ${namespace}`,
      description: `仅查看 ${namespace} 空间内的 Pod 资源。`,
    },
    {
      id: 'describe',
      title: '诊断 Pod 状态',
      command: `kubectl describe pod <pod-name> -n ${namespace}`,
      description: '查看 Pod 的详细配置、调度过程与最近事件。',
    },
    {
      id: 'logs',
      title: '持续查看日志',
      command: `kubectl logs -f <pod-name> -n ${namespace}`,
      description: '实时输出容器日志；多容器 Pod 可追加 -c <container>。',
    },
    {
      id: 'apply',
      title: '应用 YAML 配置',
      command: 'kubectl apply -f resource.yaml',
      description: '以声明式方式创建或更新 YAML 中描述的 Kubernetes 资源。',
    },
    { id: 'crd', title: '查看自定义资源', command: 'kubectl get crd', description: '列出集群中已经注册的 CustomResourceDefinition。' },
    {
      id: 'contexts',
      title: '查看与切换上下文',
      command: 'kubectl config get-contexts',
      description: '使用 kubectl config use-context <name> 切换访问上下文。',
    },
  ]
})

function decodeBase64(value: string): string {
  const binary = window.atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new globalThis.TextDecoder().decode(bytes)
}

function extractConfigText(value: unknown): string {
  if (typeof value === 'string') {
    if (value.includes('apiVersion:') || value.includes('clusters:')) return value
    try {
      return decodeBase64(value)
    } catch {
      return value
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['kubeconfig', 'config', 'content', 'data']) {
      if (typeof record[key] === 'string') return extractConfigText(record[key])
    }
  }
  throw new Error('服务端未返回有效的 kubeconfig 内容')
}

async function readKubeconfig(payload: unknown): Promise<string> {
  const raw = payload instanceof Blob ? await payload.text() : payload
  if (typeof raw !== 'string') return extractConfigText(raw)
  const content = raw.trim()
  if (!content) throw new Error('下载的 kubeconfig 为空，请联系管理员')
  let parsed: unknown
  try {
    parsed = JSON.parse(content) as unknown
  } catch {
    return extractConfigText(content)
  }
  return extractConfigText(parsed)
}

function saveTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/x-yaml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadKubeconfig() {
  if (downloading.value) return
  downloading.value = true
  downloadError.value = ''
  try {
    const response = await userApi.downloadKubeconfigs()
    const content = await readKubeconfig(response.data as unknown)
    saveTextFile(content, 'config.yaml')
    ElMessage.success('kubeconfig 已下载，请按配置步骤完成安装')
  } catch (reason) {
    downloadError.value = reason instanceof Error && reason.message ? reason.message : 'kubeconfig 下载失败，请稍后重试'
  } finally {
    downloading.value = false
  }
}

async function copyCommand(command: string, id: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(command)
    else {
      const textarea = document.createElement('textarea')
      textarea.value = command
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      if (!copied) throw new Error('copy failed')
    }
    ElMessage.success({ message: id === 'version' ? '版本检查命令已复制' : '命令已复制到剪贴板', duration: 1600 })
  } catch {
    ElMessage.warning('自动复制失败，请选中命令后手动复制')
  }
}
</script>

<style scoped>
.tools-page {
  padding-bottom: 12px;
}
.docs-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.tool-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 28px 30px;
  overflow: hidden;
  background: linear-gradient(110deg, #fff 45%, #f3f5ff);
}
.tool-hero::after {
  position: absolute;
  right: -54px;
  width: 190px;
  height: 190px;
  border: 30px solid rgb(91 108 255 / 4%);
  border-radius: 50%;
  content: '';
}
.tool-hero__icon {
  display: grid;
  width: 62px;
  height: 62px;
  flex: 0 0 62px;
  color: var(--brand-600);
  background: var(--brand-50);
  border: 1px solid var(--brand-100);
  border-radius: 18px;
  place-items: center;
  font-size: 29px;
}
.tool-hero__content {
  min-width: 0;
  flex: 1;
}
.tool-hero__eyebrow {
  color: var(--brand-600);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.13em;
}
.tool-hero h2 {
  margin-top: 5px;
  font-size: 20px;
}
.tool-hero p {
  margin-top: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.scope-chips {
  display: flex;
  gap: 8px;
  margin-top: 13px;
  flex-wrap: wrap;
}
.tool-hero__action {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8px;
}
.tool-hero__action > span {
  color: var(--text-tertiary);
  font-size: 11px;
}
.setup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
  gap: 20px;
}
.setup-card {
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}
.step-number {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 11px;
  place-items: center;
  font-size: 12px;
  font-weight: 650;
}
.section-heading h2 {
  font-size: 17px;
}
.section-heading p {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 12px;
}
.system-tabs {
  margin-top: 16px;
}
.system-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}
.command-block {
  overflow: hidden;
  color: #e5e7eb;
  background: #151b2c;
  border: 1px solid #252e43;
  border-radius: 10px;
}
.command-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  color: #98a2b3;
  background: rgb(255 255 255 / 3%);
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  font-size: 11px;
}
.command-block__header .el-button {
  font-size: 11px;
}
.command-block pre {
  min-height: 86px;
  margin: 0;
  padding: 16px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.85;
}
.command-note {
  min-height: 36px;
  margin-top: 10px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.65;
}
.version-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--text-secondary);
  font-size: 11px;
}
.version-check code {
  padding: 3px 7px;
  color: var(--text-regular);
  background: var(--surface-subtle);
  border-radius: 5px;
}
.config-steps {
  display: grid;
  margin: 22px 0 18px;
  padding: 0;
  gap: 16px;
  list-style: none;
}
.config-steps li {
  display: flex;
  gap: 11px;
}
.config-steps li > span {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  margin-top: 1px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 50%;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
}
.config-steps strong {
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 550;
}
.config-steps p {
  margin-top: 3px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.7;
}
.inline-command {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.inline-command code {
  color: var(--text-regular);
  font-size: 12px;
}
.config-alternative {
  margin-top: 12px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.config-alternative code {
  color: var(--text-secondary);
}
.commands-heading {
  margin-bottom: 20px;
}
.command-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.command-card {
  min-width: 0;
  padding: 14px;
  background: var(--surface-subtle);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  transition:
    border-color 160ms var(--ease),
    box-shadow 160ms var(--ease);
}
.command-card:hover {
  border-color: var(--brand-200);
  box-shadow: var(--shadow-sm);
}
.command-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.command-card__title > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-regular);
  font-size: 12px;
  font-weight: 550;
}
.command-card__title .el-icon {
  color: var(--brand-500);
}
.command-card > code {
  display: block;
  margin-top: 10px;
  overflow: hidden;
  color: #344054;
  font-size: 11px;
  line-height: 1.7;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.command-card > p {
  margin-top: 8px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.65;
}
@media (min-width: 1500px) {
  .command-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 1200px) {
  .command-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .setup-grid {
    grid-template-columns: 1fr;
  }
  .tool-hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .tool-hero__action {
    align-items: flex-start;
    width: 100%;
    padding-left: 84px;
  }
}
@media (max-width: 600px) {
  .tool-hero {
    padding: 22px;
  }
  .tool-hero__icon {
    width: 48px;
    height: 48px;
    flex-basis: 48px;
  }
  .tool-hero__action {
    padding-left: 0;
  }
  .tool-hero__action .el-button {
    width: 100%;
  }
  .command-cards {
    grid-template-columns: 1fr;
  }
  .version-check {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
