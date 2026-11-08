<template>
  <main class="error-page">
    <header class="error-page__brand">
      <AppLogo compact /><span>{{ brand }}</span>
    </header>
    <section class="error-card" aria-labelledby="not-found-title">
      <div class="error-visual" aria-hidden="true">
        <span class="error-code">404</span>
        <div class="error-icon">
          <el-icon><Compass /></el-icon>
        </div>
      </div>
      <span class="error-kicker">PAGE NOT FOUND</span>
      <h1 id="not-found-title">抱歉，页面走丢了</h1>
      <p>您访问的页面不存在、已被移动或链接有误。请检查地址，或返回首页继续管理您的云原生资源。</p>
      <div v-if="route.fullPath !== '/'" class="error-path">
        <span>请求路径</span><code>{{ route.fullPath }}</code>
      </div>
      <div class="error-actions">
        <el-button size="large" :icon="ArrowLeft" @click="goBack">返回上一页</el-button>
        <el-button type="primary" size="large" :icon="HomeFilled" @click="goHome">回到首页</el-button>
      </div>
    </section>
    <footer>错误代码：404 · NOT FOUND</footer>
  </main>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Compass, HomeFilled } from '@element-plus/icons-vue'
import AppLogo from '@/components/AppLogo.vue'

const brand = import.meta.env.VITE_BRAND_NAME || 'KubeCube'
const route = useRoute()
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
  max-width: 680px;
  margin: auto;
  padding: 60px 24px;
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
  background: linear-gradient(145deg, #a5b4fc, #dbe2ff);
  background-clip: text;
  font-size: 142px;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.09em;
  -webkit-background-clip: text;
}
.error-icon {
  position: absolute;
  right: 23px;
  bottom: 0;
  display: grid;
  width: 66px;
  height: 66px;
  color: var(--brand-600);
  background: var(--brand-100);
  border: 7px solid var(--surface-page);
  border-radius: 21px;
  box-shadow: 0 8px 20px rgb(91 108 255 / 12%);
  place-items: center;
  font-size: 28px;
  transform: rotate(7deg);
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
.error-path {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 100%;
  margin: 22px auto 0;
  color: var(--text-tertiary);
  font-size: 12px;
}
.error-path code {
  max-width: 440px;
  padding: 5px 9px;
  overflow: hidden;
  color: var(--text-secondary);
  background: #eceff5;
  border-radius: 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 30px;
}
.error-actions .el-button {
  min-width: 132px;
  margin: 0;
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
    padding: 44px 0;
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
    font-size: 24px;
  }
  .error-path {
    align-items: flex-start;
    flex-direction: column;
  }
  .error-path code {
    max-width: 100%;
  }
  .error-actions {
    flex-direction: column-reverse;
  }
  .error-actions .el-button {
    width: 100%;
  }
}
</style>
