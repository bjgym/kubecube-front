<template>
  <main class="error-page">
    <header class="error-page__brand">
      <AppLogo compact /><span>{{ brand }}</span>
    </header>
    <section class="error-card" aria-labelledby="forbidden-title">
      <div class="error-visual" aria-hidden="true">
        <span class="error-code">403</span>
        <div class="error-icon error-icon--warning">
          <el-icon><Lock /></el-icon>
        </div>
      </div>
      <span class="error-kicker">ACCESS DENIED</span>
      <h1 id="forbidden-title">您没有访问此页面的权限</h1>
      <p>当前账户的角色或资源权限不足。您可以返回继续浏览其他页面，或联系平台管理员为您的账户授权。</p>
      <div class="error-actions">
        <el-button size="large" :icon="ArrowLeft" @click="goBack">返回上一页</el-button>
        <el-button type="primary" size="large" :icon="HomeFilled" @click="goHome">回到首页</el-button>
      </div>
      <div class="error-tip">
        <el-icon><InfoFilled /></el-icon><span>如需访问，请提供页面名称与当前账号，便于管理员排查。</span>
      </div>
    </section>
    <footer>错误代码：403 · FORBIDDEN</footer>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft, HomeFilled, InfoFilled, Lock } from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'

const brand = import.meta.env.VITE_BRAND_NAME || 'KubeCube'
const router = useRouter()
function goBack() {
  if (window.history.length > 1) router.back()
  else void router.replace('/')
}
function goHome() {
  void router.push('/')
}
</script>

<style scoped>
.error-page {
  display: flex;
  height: 100%;
  padding: 34px 28px 24px;
  overflow: auto;
  background: radial-gradient(circle at 50% 24%, rgb(224 231 255 / 55%), transparent 35%), var(--surface-page);
  flex-direction: column;
}
.error-page__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  font-size: 18px;
  font-weight: 650;
}
.error-card {
  width: 100%;
  max-width: 660px;
  margin: auto;
  padding: 64px 24px;
  text-align: center;
}
.error-visual {
  position: relative;
  width: 260px;
  height: 142px;
  margin: 0 auto 24px;
}
.error-code {
  color: transparent;
  background: linear-gradient(145deg, #c7d2fe, #e0e7ff);
  background-clip: text;
  font-size: 142px;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.09em;
  -webkit-background-clip: text;
}
.error-icon {
  position: absolute;
  right: 24px;
  bottom: 0;
  display: grid;
  width: 66px;
  height: 66px;
  border: 7px solid var(--surface-page);
  border-radius: 21px;
  place-items: center;
  font-size: 27px;
  transform: rotate(-5deg);
}
.error-icon--warning {
  color: #b54708;
  background: #fef0c7;
  box-shadow: 0 8px 20px rgb(181 71 8 / 12%);
}
.error-kicker {
  color: var(--brand-600);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.16em;
}
h1 {
  margin-top: 12px;
  font-size: 28px;
  line-height: 1.4;
}
.error-card > p {
  max-width: 540px;
  margin: 16px auto 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.9;
}
.error-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
.error-actions .el-button {
  min-width: 132px;
  margin: 0;
}
.error-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 30px;
  color: var(--text-tertiary);
  font-size: 12px;
}
footer {
  color: var(--text-tertiary);
  font-size: 11px;
  text-align: center;
  letter-spacing: 0.04em;
}
@media (max-width: 560px) {
  .error-page {
    padding: 24px 18px;
  }
  .error-card {
    padding: 48px 0;
  }
  .error-visual {
    width: 220px;
    height: 122px;
  }
  .error-code {
    font-size: 122px;
  }
  .error-icon {
    right: 14px;
    width: 60px;
    height: 60px;
  }
  h1 {
    font-size: 23px;
  }
  .error-actions {
    flex-direction: column-reverse;
  }
  .error-actions .el-button {
    width: 100%;
  }
  .error-tip {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
