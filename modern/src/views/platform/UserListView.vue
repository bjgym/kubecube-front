<template>
  <div class="page page-stack">
    <PageHeader
      title="用户管理"
      description="维护平台登录账号、联系方式与账号状态。管理员可以重置密码，无需知道用户原密码。"
      :breadcrumbs="['平台管理', '组织管理']"
    >
      <template #actions>
        <el-button :icon="Upload" @click="importDialogVisible = true">批量导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
      </template>
    </PageHeader>

    <section class="surface surface-padded page-stack" aria-label="用户列表">
      <div class="toolbar">
        <div class="toolbar__group">
          <el-input
            v-model="keyword"
            class="search-input"
            clearable
            :prefix-icon="Search"
            placeholder="搜索登录账号"
            aria-label="搜索登录账号"
            @keyup.enter="search"
            @clear="search"
          />
          <el-button @click="search">查询</el-button>
        </div>
        <el-button text :icon="Refresh" :loading="loading" @click="loadUsers">刷新</el-button>
      </div>

      <el-alert
        v-if="listError && users.length"
        title="用户列表刷新失败，当前仍显示上次成功加载的数据。"
        type="error"
        :closable="false"
        show-icon
      >
        <el-button link type="primary" @click="loadUsers">重新加载</el-button>
      </el-alert>

      <el-table v-loading="loading" :data="users" :row-key="userName" scrollbar-always-on>
        <el-table-column label="登录账号" min-width="150" fixed="left">
          <template #default="{ row }">
            <div class="account-cell">
              <span class="account-avatar" aria-hidden="true">{{ avatarText(row) }}</span>
              <div>
                <strong>{{ userName(row) }}</strong>
                <p class="text-secondary cell-subtitle">{{ userField(row, 'email') }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="用户名称" min-width="130">
          <template #default="{ row }">{{ userField(row, 'displayName') }}</template>
        </el-table-column>
        <el-table-column v-if="isWide" label="登录类型" min-width="110">
          <template #default="{ row }">{{ loginTypeText(userField(row, 'loginType')) }}</template>
        </el-table-column>
        <el-table-column v-if="isWide" label="联系电话" min-width="130">
          <template #default="{ row }">{{ userField(row, 'phone') }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusTag :status="userState(row)" :label="userStateLabel(row)" />
          </template>
        </el-table-column>
        <el-table-column v-if="isWide" label="上次登录 IP" min-width="140">
          <template #default="{ row }">{{ userField(row, 'lastLoginIP') }}</template>
        </el-table-column>
        <el-table-column label="上次登录时间" min-width="170">
          <template #default="{ row }">{{ formatDate(userField(row, 'lastLoginTime', '')) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="176" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" @click="openEdit(row)">编辑信息</el-button>
              <el-dropdown trigger="click" @command="(command: string) => onRowCommand(command, row)">
                <el-button link class="more-button" aria-label="更多操作"
                  ><el-icon><MoreFilled /></el-icon
                ></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="password"
                      ><el-icon><Key /></el-icon>重置密码</el-dropdown-item
                    >
                    <el-dropdown-item command="status" divided :disabled="!hasKnownState(row)"
                      ><el-icon><SwitchButton /></el-icon>{{ isEnabled(row) ? '禁用账号' : '启用账号' }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <EmptyState
            v-if="listError"
            title="用户列表加载失败"
            description="请检查网络或后端服务后重试，已输入的搜索条件会保留。"
            action-text="重新加载"
            @action="loadUsers"
          />
          <EmptyState
            v-else
            :title="activeKeyword ? '未找到匹配用户' : '暂无用户'"
            :description="activeKeyword ? '请尝试更换登录账号关键字。' : '可以手动新增用户，或通过 CSV 模板批量导入。'"
            :action-text="activeKeyword ? '' : '新增用户'"
            @action="openCreate"
          />
        </template>
      </el-table>

      <el-pagination
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="loadUsers"
        @size-change="onPageSizeChange"
      />
    </section>

    <el-dialog
      v-model="userDialogVisible"
      :title="dialogMode === 'create' ? '新增用户' : '编辑用户信息'"
      width="560px"
      :close-on-click-modal="!saving"
      @closed="resetUserForm"
    >
      <el-form ref="userFormRef" :model="userModel" :rules="userRules" label-position="top">
        <el-form-item label="登录账号" prop="name">
          <el-input v-model.trim="userModel.name" :disabled="dialogMode === 'edit'" maxlength="64" placeholder="用于登录的唯一账号" />
          <p class="form-help">创建后登录账号不可修改。</p>
        </el-form-item>
        <el-form-item label="用户名称" prop="displayName">
          <el-input v-model.trim="userModel.displayName" maxlength="63" placeholder="用于页面展示的名称" />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'create'" label="初始密码" prop="password">
          <el-input v-model="userModel.password" type="password" show-password autocomplete="new-password" />
          <p class="form-help">8–20 位，至少包含字母、数字、特殊字符中的两类。</p>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="邮箱" prop="email">
            <el-input v-model.trim="userModel.email" placeholder="name@example.com" />
          </el-form-item>
          <el-form-item label="联系电话" prop="phone">
            <el-input v-model.trim="userModel.phone" maxlength="20" placeholder="选填" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitUser">
          {{ dialogMode === 'create' ? '创建用户' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordDialogVisible"
      title="管理员重置密码"
      width="500px"
      :close-on-click-modal="!savingPassword"
      @closed="resetPasswordForm"
    >
      <el-alert
        :title="`正在重置账号 ${passwordModel.userName} 的密码`"
        description="管理员重置无需提供原密码。保存后旧密码立即失效，请通过安全渠道将新密码交给用户。"
        type="warning"
        :closable="false"
        show-icon
        class="dialog-alert"
      />
      <el-form ref="passwordFormRef" :model="passwordModel" :rules="passwordRules" label-position="top">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordModel.newPassword" type="password" show-password autocomplete="new-password" />
          <p class="form-help">8–20 位，至少包含字母、数字、特殊字符中的两类。</p>
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input v-model="passwordModel.confirmPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="savingPassword" @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPassword" @click="submitPassword">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="批量导入用户" width="600px" :close-on-click-modal="!importing" @closed="resetImport">
      <div class="import-intro">
        <div>
          <h3>使用 CSV 模板</h3>
          <p class="text-secondary">请保留模板表头并按示例填写。导入结果由后端逐行返回。</p>
        </div>
        <el-button link type="primary" :icon="Download" :loading="downloading" @click="downloadTemplate">下载模板</el-button>
      </div>
      <el-upload
        ref="uploadRef"
        v-loading="importing"
        drag
        action="#"
        accept=".csv,text/csv"
        :auto-upload="false"
        :limit="1"
        :disabled="importing"
        :on-change="onFileChange"
        :on-remove="onFileRemove"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将 CSV 文件拖到此处，或 <em>点击选择</em></div>
        <template #tip><div class="el-upload__tip">仅支持 CSV 文件，重新选择前请先移除已选文件。</div></template>
      </el-upload>
      <el-alert
        v-if="importResult"
        :title="`导入完成：成功 ${importResult.successCount} 条，失败 ${importResult.failedCount} 条`"
        :type="importResult.failedCount ? 'warning' : 'success'"
        :closable="false"
        show-icon
        class="import-result"
      />
      <ul v-if="importResult?.messages.length" class="import-errors">
        <li v-for="message in importResult.messages" :key="message">{{ message }}</li>
      </ul>
      <template #footer>
        <el-button :disabled="importing" @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="!importFile" :loading="importing" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type UploadFile,
  type UploadInstance,
  type UploadRawFile,
} from 'element-plus'
import { Download, Key, MoreFilled, Plus, Refresh, Search, SwitchButton, Upload, UploadFilled } from '@element-plus/icons-vue'
import { userApi } from '@/api/auth'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useViewport } from '@/composables/useViewport'
import { formatDate } from '@/utils/format'
import type { KubeResource } from '@/types/api'

type UserResource = KubeResource & { name?: string }
type DialogMode = 'create' | 'edit'
interface ImportResult {
  successCount: number
  failedCount: number
  messages: string[]
}

const users = ref<UserResource[]>([])
const total = ref(0)
const loading = ref(false)
const listError = ref(false)
const keyword = ref('')
const activeKeyword = ref('')
const pageNum = ref(1)
const pageSize = ref(10)
const actionLoading = ref('')
const { isWide } = useViewport()
let listGeneration = 0

const userDialogVisible = ref(false)
const dialogMode = ref<DialogMode>('create')
const saving = ref(false)
const userFormRef = ref<FormInstance>()
const userModel = reactive({ name: '', displayName: '', password: '', email: '', phone: '' })

const passwordDialogVisible = ref(false)
const savingPassword = ref(false)
const passwordFormRef = ref<FormInstance>()
const passwordModel = reactive({ userName: '', newPassword: '', confirmPassword: '' })

const importDialogVisible = ref(false)
const importing = ref(false)
const downloading = ref(false)
const importFile = ref<UploadRawFile | null>(null)
const importResult = ref<ImportResult | null>(null)
const uploadRef = ref<UploadInstance>()

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function text(value: unknown, fallback = '—'): string {
  if (value === undefined || value === null || value === '') return fallback
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function userName(user: UserResource): string {
  return user.metadata?.name || user.name || '—'
}

function userField(user: UserResource, field: string, fallback = '—'): string {
  const spec = record(user.spec)
  const status = record(user.status)
  return text(spec[field] ?? status[field] ?? user[field], fallback)
}

function userState(user: UserResource): string {
  return userField(user, 'state', '').toLowerCase()
}

function isEnabled(user: UserResource): boolean {
  return ['normal', 'active', 'enabled', 'true'].includes(userState(user))
}

function hasKnownState(user: UserResource): boolean {
  return isEnabled(user) || ['forbidden', 'disabled', 'inactive', 'false'].includes(userState(user))
}

function userStateLabel(user: UserResource): string {
  if (isEnabled(user)) return '已启用'
  if (hasKnownState(user)) return '已禁用'
  return '状态未知'
}

function loginTypeText(value: string): string {
  const labels: Record<string, string> = { normal: '本地账号', openid: 'OpenID', ldap: 'LDAP', oauth: 'OAuth' }
  return labels[value.toLowerCase()] || value
}

function avatarText(user: UserResource): string {
  return (userField(user, 'displayName', userName(user)).trim()[0] || '用').toUpperCase()
}

async function loadUsers() {
  const generation = ++listGeneration
  loading.value = true
  try {
    const response = await userApi.list({
      query: activeKeyword.value || undefined,
      selector: activeKeyword.value ? `metadata.name~${activeKeyword.value}` : undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    if (generation !== listGeneration) return
    users.value = (response.items || []) as UserResource[]
    total.value = Number(response.total ?? response.items?.length ?? 0)
    listError.value = false
  } catch {
    if (generation === listGeneration) listError.value = true
  } finally {
    if (generation === listGeneration) loading.value = false
  }
}

function search() {
  activeKeyword.value = keyword.value.trim()
  pageNum.value = 1
  void loadUsers()
}

function onPageSizeChange() {
  pageNum.value = 1
  void loadUsers()
}

function openCreate() {
  dialogMode.value = 'create'
  Object.assign(userModel, { name: '', displayName: '', password: '', email: '', phone: '' })
  userDialogVisible.value = true
}

function openEdit(user: UserResource) {
  dialogMode.value = 'edit'
  Object.assign(userModel, {
    name: userName(user),
    displayName: userField(user, 'displayName', ''),
    password: '',
    email: userField(user, 'email', ''),
    phone: userField(user, 'phone', ''),
  })
  userDialogVisible.value = true
}

function resetUserForm() {
  userFormRef.value?.clearValidate()
  Object.assign(userModel, { name: '', displayName: '', password: '', email: '', phone: '' })
}

function validatePassword(_rule: unknown, value: string, callback: (error?: string | Error) => void) {
  if (!value) return callback(new Error('请输入密码'))
  if (value.length < 8 || value.length > 20) return callback(new Error('密码长度须为 8–20 位'))
  const groups = [/[\p{L}]/u, /\d/, /[^\p{L}\d]/u]
  if (groups.filter((pattern) => pattern.test(value)).length < 2) return callback(new Error('至少包含字母、数字、特殊字符中的两类'))
  callback()
}

const userRules: FormRules = {
  name: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { min: 2, max: 64, message: '登录账号长度须为 2–64 位', trigger: 'blur' },
  ],
  displayName: [{ required: true, message: '请输入用户名称', trigger: 'blur' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
}

async function submitUser() {
  const valid = await userFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (dialogMode.value === 'create') {
      await userApi.create({
        metadata: { name: userModel.name },
        spec: {
          displayName: userModel.displayName,
          password: userModel.password,
          email: userModel.email,
          phone: userModel.phone,
        },
      })
      ElMessage.success('用户创建成功')
    } else {
      await userApi.update(userModel.name, {
        spec: { displayName: userModel.displayName, email: userModel.email, phone: userModel.phone },
      })
      ElMessage.success('用户信息已更新')
    }
    userDialogVisible.value = false
    await loadUsers()
  } catch {
    // 请求层已展示后端错误；保留表单与旧列表，便于修正后重试。
  } finally {
    saving.value = false
  }
}

function openPassword(user: UserResource) {
  Object.assign(passwordModel, { userName: userName(user), newPassword: '', confirmPassword: '' })
  passwordDialogVisible.value = true
}

function onRowCommand(command: string, user: UserResource) {
  if (command === 'password') openPassword(user)
  else if (command === 'status') void toggleStatus(user)
}

function resetPasswordForm() {
  passwordFormRef.value?.clearValidate()
  Object.assign(passwordModel, { userName: '', newPassword: '', confirmPassword: '' })
}

const passwordRules: FormRules = {
  newPassword: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [
    {
      validator: (_rule, value: string, callback: (error?: string | Error) => void) => {
        if (!value) return callback(new Error('请再次输入新密码'))
        if (value !== passwordModel.newPassword) return callback(new Error('两次输入的新密码不一致'))
        callback()
      },
      trigger: 'blur',
    },
  ],
}

async function submitPassword() {
  const valid = await passwordFormRef.value?.validate().catch(() => false)
  if (!valid) return
  savingPassword.value = true
  try {
    await userApi.update(passwordModel.userName, { spec: { password: passwordModel.newPassword } })
    ElMessage.success('密码重置成功')
    passwordDialogVisible.value = false
  } catch {
    // 保留表单，避免失败后要求重新填写。
  } finally {
    savingPassword.value = false
  }
}

async function toggleStatus(user: UserResource) {
  const name = userName(user)
  const enabled = isEnabled(user)
  if (enabled) {
    try {
      await ElMessageBox.confirm(`禁用后，账号 ${name} 将无法登录。确认继续吗？`, '禁用用户', {
        confirmButtonText: '确认禁用',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  actionLoading.value = name
  try {
    await userApi.update(name, { spec: { state: enabled ? 'forbidden' : 'normal' } })
    ElMessage.success(enabled ? '用户已禁用' : '用户已启用')
    await loadUsers()
  } catch {
    // 失败时保留列表中的原状态。
  } finally {
    actionLoading.value = ''
  }
}

function onFileChange(file: UploadFile) {
  importResult.value = null
  const raw = file.raw
  if (!raw || !raw.name.toLowerCase().endsWith('.csv')) {
    importFile.value = null
    uploadRef.value?.clearFiles()
    ElMessage.error('请选择 CSV 格式的用户模板文件')
    return
  }
  importFile.value = raw
}

function onFileRemove() {
  importFile.value = null
  importResult.value = null
}

async function downloadTemplate() {
  downloading.value = true
  try {
    const response = await userApi.downloadTemplate()
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data])
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'UserTemplate.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('模板下载已开始')
  } catch {
    // 请求层负责提示失败。
  } finally {
    downloading.value = false
  }
}

async function submitImport() {
  if (!importFile.value) return
  importing.value = true
  importResult.value = null
  try {
    const body = new globalThis.FormData()
    body.append('userInfoFile', importFile.value)
    const response: unknown = await userApi.importUsers(body)
    const data = record(response)
    if (Object.keys(data).length) {
      const messages = Array.isArray(data.failedMessageList) ? data.failedMessageList.map((item) => String(item)) : []
      importResult.value = {
        successCount: Number(data.successCount || 0),
        failedCount: Number(data.failedCount || 0),
        messages,
      }
    }
    if (importResult.value?.failedCount) ElMessage.warning('导入已完成，但存在失败记录，请查看详情')
    else ElMessage.success('用户导入完成')
    await loadUsers()
  } catch {
    // 文件与既有列表均保留，便于修正后重试。
  } finally {
    importing.value = false
  }
}

function resetImport() {
  uploadRef.value?.clearFiles()
  importFile.value = null
  importResult.value = null
}

onMounted(loadUsers)
</script>

<style scoped>
.search-input {
  width: min(320px, 100%);
}
.toolbar__group {
  flex-wrap: nowrap;
}
.more-button {
  min-height: auto;
  padding: 4px;
}
.account-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.account-avatar {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  color: var(--brand-600);
  background: var(--brand-50);
  border-radius: 9px;
  place-items: center;
  font-weight: 600;
}
.cell-subtitle {
  max-width: 210px;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-help {
  margin-top: 5px;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dialog-alert {
  margin-bottom: 20px;
}
.import-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.import-intro h3 {
  margin-bottom: 5px;
  font-size: 15px;
}
.import-intro p {
  font-size: 13px;
}
.import-result {
  margin-top: 18px;
}
.import-errors {
  max-height: 150px;
  margin: 12px 0 0;
  padding: 12px 12px 12px 30px;
  overflow: auto;
  color: var(--danger);
  background: #fff7f6;
  border-radius: 8px;
  font-size: 12px;
}
@media (max-width: 768px) {
  .search-input {
    width: 100%;
  }
  .toolbar__group {
    width: 100%;
    flex-wrap: wrap;
  }
  .toolbar__group .el-button {
    flex-shrink: 0;
  }
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .import-intro {
    flex-direction: column;
  }
}
</style>
