import { fileURLToPath, URL } from 'node:url'
import { Agent } from 'node:https'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cubeTarget = env.VITE_CUBE_TARGET || 'https://10.219.192.164:30443'
  const monitoringTarget = env.VITE_MONITORING_TARGET || 'http://10.219.192.164:31090'
  const logseerTarget = env.VITE_LOGSEER_TARGET || 'http://10.219.192.164:31043'
  const webconsoleTarget = env.VITE_WEBCONSOLE_TARGET || 'http://10.219.192.164:30010'
  const auditTarget = env.VITE_AUDIT_TARGET || 'http://10.219.192.164:30008'
  const cubeAgent = new Agent({ keepAlive: false })

  return {
    base: '/public/',
    plugins: [vue()],
    define: { global: 'globalThis' },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: '../public',
      emptyOutDir: true,
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/monaco-editor')) return 'monaco'
            if (id.includes('node_modules/echarts')) return 'charts'
            if (id.includes('node_modules/element-plus') || id.includes('node_modules/@element-plus')) return 'element'
            if (id.includes('node_modules/vue') || id.includes('node_modules/pinia')) return 'vue'
          },
        },
      },
    },
    server: {
      proxy: {
        '/api/v1/cube': { target: cubeTarget, secure: false, changeOrigin: true, agent: cubeAgent },
        '/api/v1/logseer': { target: logseerTarget, changeOrigin: true },
        '/api/v2/logseer': { target: logseerTarget, changeOrigin: true },
        '/api/v1/label': { target: monitoringTarget, changeOrigin: true },
        '/api/v1/series': { target: monitoringTarget, changeOrigin: true },
        '/api/v1/query': { target: monitoringTarget, changeOrigin: true },
        '/api/v1/query_range': { target: monitoringTarget, changeOrigin: true },
        '/api/v1/webconsole': {
          target: webconsoleTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/webconsole/, '/api/v1'),
        },
        '/webconsole/api/sockjs': {
          target: webconsoleTarget,
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/webconsole\/api\/sockjs/, '/api/sockjs'),
        },
        '/api/v1/audit': {
          target: auditTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/audit/, '/api/v1/cube/audit'),
        },
      },
    },
  }
})
