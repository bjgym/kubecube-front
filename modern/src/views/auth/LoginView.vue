<template>
  <div class="login-page">
    <section class="login-hero" aria-label="平台介绍">
      <div class="login-hero__grid" aria-hidden="true" />
      <div class="login-hero__glow" aria-hidden="true" />
      <header class="login-hero__header">
        <AppLogo />
        <span class="environment-badge"><span />企业级云原生平台</span>
      </header>

      <div class="login-hero__content">
        <p class="hero-eyebrow">KUBERNETES, MADE CLEAR</p>
        <h1>让集群管理更简单，<br /><span>让每一次交付更可靠。</span></h1>
        <p class="hero-description">统一管理多集群、租户与云原生资源，在一个清晰的工作台中完成从部署到观测的完整流程。</p>
        <ul class="hero-features">
          <li v-for="feature in heroFeatures" :key="feature.title">
            <span class="feature-icon"
              ><el-icon><component :is="feature.icon" /></el-icon
            ></span>
            <div>
              <strong>{{ feature.title }}</strong>
              <p>{{ feature.description }}</p>
            </div>
          </li>
        </ul>
      </div>

      <footer class="login-hero__footer">
        <el-icon><Lock /></el-icon>
        <span>基于角色的访问控制，为您的资源保驾护航</span>
      </footer>
    </section>

    <main class="login-main">
      <div class="login-card">
        <div class="mobile-brand">
          <AppLogo compact /><strong>{{ brand }}</strong>
        </div>
        <div class="login-heading">
          <span class="login-heading__badge">欢迎回来</span>
          <h2>登录您的账户</h2>
          <p>使用平台账户或企业身份认证继续</p>
        </div>

        <el-alert v-if="errorMessage" class="login-alert" :title="errorMessage" type="error" show-icon :closable="false" />

        <div v-if="callbackLoading" class="sso-callback" role="status">
          <span class="sso-callback__icon"
            ><el-icon class="is-loading"><Loading /></el-icon
          ></span>
          <h3>正在完成安全登录</h3>
          <p>正在验证身份凭证并加载您的权限，请稍候…</p>
        </div>

        <template v-else>
          <el-form
            ref="loginFormRef"
            class="login-form"
            :model="loginForm"
            :rules="loginRules"
            label-position="top"
            size="large"
            @keyup.enter="submitLogin"
          >
            <el-form-item label="账号" prop="name">
              <el-input
                v-model.trim="loginForm.name"
                name="username"
                autocomplete="username"
                placeholder="请输入账号"
                maxlength="128"
                :prefix-icon="User"
                :disabled="ordinaryLoading"
                clearable
                @input="errorMessage = ''"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="loginForm.password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="请输入密码"
                maxlength="128"
                :prefix-icon="Key"
                :disabled="ordinaryLoading"
                show-password
                @input="errorMessage = ''"
              />
            </el-form-item>
            <div class="login-form__options">
              <span>普通登录</span>
              <el-button type="primary" link :disabled="ordinaryLoading" @click="openResetDialog">忘记密码？</el-button>
            </div>
            <el-button
              class="login-submit"
              type="primary"
              size="large"
              :loading="ordinaryLoading"
              :disabled="callbackLoading"
              @click="submitLogin"
            >
              {{ ordinaryLoading ? '正在登录…' : '登 录' }}
              <el-icon v-if="!ordinaryLoading" class="login-submit__arrow"><Right /></el-icon>
            </el-button>
          </el-form>

          <div v-if="ssoLoading || ssoProviders.length" class="sso-section">
            <el-divider><span>或使用以下方式登录</span></el-divider>
            <div v-if="ssoLoading" class="sso-loading"><el-skeleton :rows="1" animated /></div>
            <div v-else class="sso-buttons">
              <el-button
                v-for="provider in ssoProviders"
                :key="provider.key"
                class="sso-button"
                size="large"
                :loading="activeSsoProvider === provider.key"
                :disabled="ordinaryLoading || Boolean(activeSsoProvider)"
                @click="startSso(provider)"
              >
                <img v-if="provider.image" :src="provider.image" alt="" @error="provider.image = ''" />
                <el-icon v-else><Connection /></el-icon>
                <span>使用 {{ provider.name }} 账号登录</span>
              </el-button>
            </div>
          </div>
        </template>

        <div class="login-assistance">
          <el-icon><InfoFilled /></el-icon>
          <span>无法登录？请联系平台管理员检查账号状态</span>
        </div>
      </div>
      <p class="login-copyright">© {{ currentYear }} {{ brand }} · 安全、开放、可观测</p>
    </main>

    <el-dialog
      v-model="resetDialogVisible"
      title="重置密码"
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="!resetLoading"
      :show-close="!resetLoading"
      @closed="onResetDialogClosed"
    >
      <p class="reset-description">验证当前密码后即可设置新密码。新密码需为 8–20 位，并包含字母、数字、特殊字符中的至少两种。</p>
      <el-alert v-if="resetError" class="reset-alert" :title="resetError" type="error" show-icon :closable="false" />
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-position="top" @keyup.enter="submitResetPassword">
        <el-form-item label="账号" prop="userName">
          <el-input
            v-model.trim="resetForm.userName"
            autocomplete="username"
            maxlength="128"
            placeholder="请输入账号"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item label="当前密码" prop="originPassword">
          <el-input
            v-model="resetForm.originPassword"
            type="password"
            autocomplete="current-password"
            placeholder="请输入当前密码"
            show-password
            :prefix-icon="Key"
          />
        </el-form-item>
        <div class="reset-password-grid">
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="resetForm.newPassword"
              type="password"
              autocomplete="new-password"
              placeholder="请输入新密码"
              maxlength="20"
              show-password
            />
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="resetForm.confirmPassword"
              type="password"
              autocomplete="new-password"
              placeholder="请再次输入"
              maxlength="20"
              show-password
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="resetLoading" @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetLoading" @click="submitResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Connection, DataAnalysis, Grid, InfoFilled, Key, Lock, Loading, Right, User } from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'
import { accountFromLogin, authApi, userApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { storage } from '@/utils/storage'

interface SsoProvider {
  key: string
  name: string
  image: string
  config: Record<string, string>
}

interface ResetPasswordForm {
  userName: string
  originPassword: string
  newPassword: string
  confirmPassword: string
}

interface LastLocation {
  path: string
  query?: LocationQueryRaw
}

const brand = import.meta.env.VITE_BRAND_NAME || 'KubeCube'
const currentYear = new Date().getFullYear()
const heroFeatures = [
  { title: '多集群统一管理', description: '集中掌握集群与资源运行状态', icon: Grid },
  { title: '精细化权限体系', description: '租户、项目与空间多层隔离', icon: Lock },
  { title: '一站式可观测性', description: '监控、日志与告警融会贯通', icon: DataAnalysis },
]
const strongPasswordPattern = /(?!^\d+$)(?!^[A-Za-z]+$)(?!^[^A-Za-z0-9]+$)(?!^.*[\u4E00-\u9FA5].*$)^\S{8,20}$/

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const loginFormRef = ref<FormInstance>()
const resetFormRef = ref<FormInstance>()
const ordinaryLoading = ref(false)
const callbackLoading = ref(false)
const ssoLoading = ref(true)
const activeSsoProvider = ref('')
const errorMessage = ref('')
const ssoProviders = ref<SsoProvider[]>([])
const resetDialogVisible = ref(false)
const resetLoading = ref(false)
const resetError = ref('')

const loginForm = reactive({ name: '', password: '' })
const resetForm = reactive<ResetPasswordForm>({ userName: '', originPassword: '', newPassword: '', confirmPassword: '' })

const loginRules: FormRules = {
  name: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { max: 128, message: '账号不能超过 128 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { max: 128, message: '密码不能超过 128 个字符', trigger: 'blur' },
  ],
}

const resetRules: FormRules = {
  userName: [{ required: true, message: '请输入需要重置密码的账号', trigger: 'blur' }],
  originPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (!strongPasswordPattern.test(value || '')) callback(new Error('请输入 8–20 位密码，并至少包含两类字符'))
        else if (value === resetForm.originPassword) callback(new Error('新密码不能与当前密码相同'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== resetForm.newPassword) callback(new Error('两次输入的新密码不一致'))
        else callback()
      },
      trigger: 'blur',
    },
  ],
}

function errorText(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

function firstQueryValue(value: unknown): string {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
}

function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && path !== '/login' && !path.startsWith('/login?')
}

function requestedDestination(): string | null {
  const redirect = firstQueryValue(route.query.redirect)
  return isSafeInternalPath(redirect) ? redirect : null
}

function previousDestination(): LastLocation | null {
  const lastLocation = storage.getJSON<LastLocation>('lastlocation')
  if (!lastLocation || typeof lastLocation.path !== 'string' || !isSafeInternalPath(lastLocation.path)) return null
  return lastLocation
}

function roleDestination(): string {
  return auth.identities.platformAdmin ? '/platform/user/list' : '/namespace'
}

async function navigateAfterLogin() {
  const redirect = requestedDestination()
  const previous = previousDestination()
  const destination = redirect || previous || roleDestination()
  storage.remove('lastlocation')
  await router.replace(destination)
}

async function submitLogin() {
  if (ordinaryLoading.value || callbackLoading.value) return
  errorMessage.value = ''
  const form = loginFormRef.value
  if (!form) return
  try {
    await form.validate()
  } catch {
    return
  }

  ordinaryLoading.value = true
  try {
    // Mock 与真实环境始终经过同一条认证链路，确保用户、身份与权限状态一致。
    await auth.login({ loginType: 'normal', name: loginForm.name, password: loginForm.password })
    await navigateAfterLogin()
  } catch (reason) {
    errorMessage.value = errorText(reason, '登录失败，请检查账号和密码后重试')
  } finally {
    ordinaryLoading.value = false
  }
}

function parseSsoBlock(block: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key) result[key] = value.replace(/^(["'])(.*)\1$/, '$2')
  }
  return result
}

async function loadSsoConfig() {
  ssoLoading.value = true
  try {
    const response = await authApi.ssoConfig()
    const global = response.global ? parseSsoBlock(response.global) : {}
    const providers: SsoProvider[] = []
    for (const [key, block] of Object.entries(response)) {
      if (key === 'global') continue
      const config = parseSsoBlock(block)
      if (config.enabled !== 'true') continue
      providers.push({
        key,
        name: config.describeName || global.describeName || key,
        image: config.img || global.img || '',
        config: {
          ...global,
          ...config,
          host: config.host || global.host || '',
          describeName: config.describeName || global.describeName || key,
        },
      })
    }
    ssoProviders.value = providers
  } catch {
    // 单点登录配置不可用时不影响普通登录；回调仍会使用 sessionStorage 中的 key 尝试认证。
    ssoProviders.value = []
  } finally {
    ssoLoading.value = false
  }
}

function getSessionSsoKey(): string {
  try {
    return window.sessionStorage.getItem('sso') || ''
  } catch {
    return ''
  }
}

function saveSessionSsoKey(key: string) {
  try {
    window.sessionStorage.setItem('sso', key)
  } catch {
    /* sessionStorage may be unavailable */
  }
}

function startSso(provider: SsoProvider) {
  errorMessage.value = ''
  if (!provider.config.loginUrl) {
    errorMessage.value = `${provider.name} 未配置登录地址，请联系平台管理员`
    return
  }
  saveSessionSsoKey(provider.key)
  activeSsoProvider.value = provider.key
  const url = provider.config.loginUrl
    .replaceAll('CLIENT_ID_VALUE', provider.config.clientId || '')
    .replaceAll('SCOPE_VALUE', '')
    .replaceAll('HOST_VALUE', provider.config.host || '')
  window.location.assign(url)
}

async function handleSsoCallback() {
  const search = new globalThis.URLSearchParams(window.location.search)
  const code = firstQueryValue(route.query.code) || search.get('code') || ''
  const ticket = firstQueryValue(route.query.ticket) || search.get('ticket') || ''
  const token = code || ticket
  if (!token) return

  callbackLoading.value = true
  errorMessage.value = ''
  const key = getSessionSsoKey()
  if (!key) {
    errorMessage.value = '单点登录状态已失效，请重新选择登录方式'
    callbackLoading.value = false
    return
  }

  const provider = ssoProviders.value.find((item) => item.key === key)
  try {
    const response = await authApi.oauth({ token, key, type: provider?.config.type || key })
    auth.user = accountFromLogin(response)
    storage.setJSON('user', auth.user)
    auth.initialized = false
    await auth.initialize()
    await navigateAfterLogin()
  } catch (reason) {
    errorMessage.value = errorText(reason, '单点登录验证失败，请重新尝试')
  } finally {
    callbackLoading.value = false
  }
}

function openResetDialog() {
  resetForm.userName = loginForm.name
  resetError.value = ''
  resetDialogVisible.value = true
  void nextTick(() => resetFormRef.value?.clearValidate())
}

async function submitResetPassword() {
  if (resetLoading.value) return
  resetError.value = ''
  const form = resetFormRef.value
  if (!form) return
  try {
    await form.validate()
  } catch {
    return
  }

  resetLoading.value = true
  try {
    await userApi.changePassword({
      userName: resetForm.userName,
      originPassword: resetForm.originPassword,
      newPassword: resetForm.newPassword,
    })
    loginForm.name = resetForm.userName
    loginForm.password = ''
    resetDialogVisible.value = false
    ElMessage.success('密码重置成功，请使用新密码登录')
  } catch (reason) {
    resetError.value = errorText(reason, '密码重置失败，请核对账号和当前密码')
  } finally {
    resetLoading.value = false
  }
}

function onResetDialogClosed() {
  resetForm.userName = ''
  resetForm.originPassword = ''
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
  resetError.value = ''
  resetFormRef.value?.clearValidate()
}

onMounted(async () => {
  await loadSsoConfig()
  await handleSsoCallback()
})
</script>

<style scoped>
.login-page {
  display: grid;
  height: 100%;
  grid-template-columns: minmax(440px, 1.08fr) minmax(480px, 0.92fr);
  overflow: auto;
  background: #f7f8fc;
}
.login-hero {
  position: relative;
  display: flex;
  min-height: 100vh;
  padding: 38px clamp(40px, 6vw, 92px);
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 82% 12%, rgb(99 102 241 / 24%), transparent 33%),
    linear-gradient(145deg, #11182d 0%, #151d38 48%, #202654 100%);
  flex-direction: column;
}
.login-hero__grid {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  background-image:
    linear-gradient(rgb(255 255 255 / 7%) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 7%) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: linear-gradient(to bottom, #000, transparent 85%);
}
.login-hero__glow {
  position: absolute;
  right: -140px;
  bottom: -180px;
  width: 520px;
  height: 520px;
  border: 1px solid rgb(129 140 248 / 16%);
  border-radius: 50%;
  box-shadow:
    0 0 0 76px rgb(99 102 241 / 3%),
    0 0 0 152px rgb(99 102 241 / 2%);
}
.login-hero__header,
.login-hero__content,
.login-hero__footer {
  position: relative;
  z-index: 1;
}
.login-hero__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.environment-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 11px;
  color: #c7d2fe;
  border: 1px solid rgb(199 210 254 / 16%);
  border-radius: 999px;
  background: rgb(255 255 255 / 4%);
  font-size: 12px;
  white-space: nowrap;
}
.environment-badge > span {
  width: 6px;
  height: 6px;
  background: #6ee7b7;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(110 231 183 / 10%);
}
.login-hero__content {
  width: 100%;
  max-width: 620px;
  margin: auto 0;
  padding: 72px 0;
}
.hero-eyebrow {
  margin-bottom: 22px;
  color: #a5b4fc;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
}
.login-hero h1 {
  font-size: clamp(34px, 3.25vw, 50px);
  font-weight: 650;
  line-height: 1.32;
  letter-spacing: -0.045em;
}
.login-hero h1 span {
  color: #a5b4fc;
}
.hero-description {
  max-width: 560px;
  margin-top: 24px;
  color: #aeb8ce;
  font-size: 16px;
  line-height: 1.9;
}
.hero-features {
  display: grid;
  margin: 42px 0 0;
  padding: 0;
  gap: 22px;
  list-style: none;
}
.hero-features li {
  display: flex;
  align-items: center;
  gap: 15px;
}
.feature-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  color: #c7d2fe;
  border: 1px solid rgb(165 180 252 / 16%);
  border-radius: 12px;
  background: rgb(129 140 248 / 10%);
  place-items: center;
  font-size: 19px;
}
.hero-features strong {
  font-size: 14px;
  font-weight: 550;
}
.hero-features p {
  margin-top: 3px;
  color: #8995ae;
  font-size: 13px;
}
.login-hero__footer {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #7f8ba5;
  font-size: 12px;
}
.login-main {
  display: flex;
  align-items: center;
  min-height: 100vh;
  padding: 48px clamp(32px, 5vw, 80px) 26px;
  flex-direction: column;
  justify-content: center;
}
.login-card {
  width: 100%;
  max-width: 420px;
  margin: auto;
}
.mobile-brand {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 40px;
  font-size: 20px;
}
.login-heading {
  margin-bottom: 30px;
}
.login-heading__badge {
  display: inline-block;
  margin-bottom: 12px;
  color: var(--brand-600);
  font-size: 13px;
  font-weight: 600;
}
.login-heading h2 {
  font-size: 30px;
  line-height: 1.35;
  letter-spacing: -0.035em;
}
.login-heading p {
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 14px;
}
.login-alert,
.reset-alert {
  margin-bottom: 20px;
}
.login-form :deep(.el-form-item) {
  margin-bottom: 22px;
}
.login-form :deep(.el-form-item__label) {
  padding-bottom: 7px;
  color: var(--text-regular);
  font-weight: 500;
}
.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  padding: 1px 14px;
  box-shadow: 0 0 0 1px var(--border-regular) inset;
}
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--brand-500) inset,
    0 0 0 3px rgb(91 108 255 / 10%);
}
.login-form__options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -6px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.login-submit {
  width: 100%;
  min-height: 46px;
  margin-top: 22px;
  font-weight: 600;
  box-shadow: 0 8px 18px rgb(91 108 255 / 20%);
}
.login-submit__arrow {
  margin-left: 8px;
}
.sso-section :deep(.el-divider) {
  margin: 30px 0 22px;
}
.sso-section :deep(.el-divider__text) {
  color: var(--text-tertiary);
  background: #f7f8fc;
  font-size: 12px;
}
.sso-buttons {
  display: grid;
  gap: 10px;
}
.sso-button {
  width: 100%;
  min-height: 44px;
  margin: 0;
}
.sso-button img {
  width: 20px;
  height: 20px;
  margin-right: 8px;
  object-fit: contain;
}
.sso-button .el-icon {
  margin-right: 8px;
}
.login-assistance {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 32px;
  color: var(--text-tertiary);
  font-size: 12px;
}
.login-copyright {
  margin: 38px 0 0;
  color: #a0a8b8;
  font-size: 11px;
  text-align: center;
}
.sso-callback {
  padding: 48px 0 60px;
  text-align: center;
}
.sso-callback__icon {
  display: grid;
  width: 58px;
  height: 58px;
  margin: 0 auto 20px;
  color: var(--brand-500);
  background: var(--brand-50);
  border-radius: 18px;
  place-items: center;
  font-size: 27px;
}
.sso-callback h3 {
  font-size: 17px;
}
.sso-callback p {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}
.reset-description {
  margin: -4px 0 20px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.75;
}
.reset-password-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 1050px) {
  .login-page {
    grid-template-columns: minmax(380px, 0.9fr) minmax(430px, 1.1fr);
  }
  .login-hero {
    padding: 32px 40px;
  }
  .environment-badge {
    display: none;
  }
  .hero-description {
    font-size: 14px;
  }
}
@media (max-width: 820px) {
  .login-page {
    display: block;
    background: #f7f8fc;
  }
  .login-hero {
    display: none;
  }
  .login-main {
    min-height: 100vh;
    padding: 36px 24px 24px;
  }
  .mobile-brand {
    display: flex;
  }
  .login-card {
    max-width: 440px;
    padding: 32px;
    background: #fff;
    border: 1px solid var(--border-light);
    border-radius: 18px;
    box-shadow: var(--shadow-md);
  }
  .sso-section :deep(.el-divider__text) {
    background: #fff;
  }
}
@media (max-width: 480px) {
  .login-main {
    padding: 20px 16px;
  }
  .login-card {
    padding: 26px 22px;
  }
  .mobile-brand {
    margin-bottom: 28px;
  }
  .login-heading h2 {
    font-size: 26px;
  }
  .reset-password-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
