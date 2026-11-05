<template>
  <div class="page page-stack">
    <section class="surface surface-padded" aria-label="正在进入平台管理">
      <el-skeleton :rows="4" animated />
    </section>
  </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { platformLanding } from '@/config/access'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  try {
    await auth.initialize()
    await router.replace(platformLanding(auth.identities))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '管理员身份加载失败，请稍后重试')
  }
})
</script>
