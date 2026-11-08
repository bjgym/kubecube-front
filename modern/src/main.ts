import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@xterm/xterm/css/xterm.css'
import App from './App.vue'
import router from './router'
import './styles/index.css'

// Apply the saved density before the first render so the console does not flash
// the other layout. The ui store owns later changes.
try {
  document.documentElement.dataset.density = localStorage.getItem('kubecube-density') === 'comfortable' ? 'comfortable' : 'compact'
} catch {
  document.documentElement.dataset.density = 'compact'
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
