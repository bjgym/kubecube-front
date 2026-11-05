<template>
  <el-drawer
    v-model="ui.cloudShellOpen"
    direction="btt"
    size="min(76vh, 760px)"
    :show-close="false"
    :close-on-click-modal="false"
    class="terminal-drawer"
    @open="openTerminal"
    @closed="cleanup"
  >
    <template #header>
      <div class="terminal-header">
        <div class="terminal-title">
          <span class="terminal-logo"
            ><el-icon><Monitor /></el-icon
          ></span>
          <div>
            <h2>{{ ui.shellPod ? '容器终端' : 'Cloud Shell' }}</h2>
            <p>
              {{ scope.cluster }}<span v-if="scope.namespace"> / {{ scope.namespace }}</span
              ><span v-if="ui.shellPod"> / {{ ui.shellPod }} / {{ ui.shellContainer }}</span>
            </p>
          </div>
          <span class="connection" :class="`connection--${status}`"><i />{{ statusText }}</span>
        </div>
        <div class="terminal-actions">
          <el-button text @click="reconnect"
            ><el-icon><RefreshRight /></el-icon>重新连接</el-button
          ><el-button text @click="ui.cloudShellOpen = false"
            ><el-icon><Close /></el-icon>关闭</el-button
          >
        </div>
      </div>
    </template>
    <div class="terminal-body">
      <div ref="terminalHost" class="terminal-host" />
      <div v-if="status === 'connecting'" class="terminal-loading">
        <el-icon class="spinning"><Loading /></el-icon><span>正在建立安全会话…</span>
      </div>
    </div>
    <div class="terminal-footer">
      <span>快捷键：Ctrl + C 中断命令 · Ctrl + L 清屏</span
      ><span>{{ mock ? '预览模式不会执行真实命令' : '会话通过 WebConsole 加密连接' }}</span>
    </div>
  </el-drawer>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import SockJS from 'sockjs-client'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { Close, Loading, Monitor, RefreshRight } from '@element-plus/icons-vue'
import { webconsoleApi } from '@/api/observability'
import { useScopeStore } from '@/stores/scope'
import { useUiStore } from '@/stores/ui'
const ui = useUiStore()
const scope = useScopeStore()
const terminalHost = ref<HTMLElement>()
const status = ref<'connecting' | 'connected' | 'reconnecting' | 'error'>('connecting')
const mock = import.meta.env.VITE_USE_MOCK === 'true'
const statusText = computed(
  () => ({ connecting: '连接中', connected: mock ? '预览会话' : '已连接', reconnecting: '重新连接中', error: '连接失败' })[status.value],
)
interface SocketLike {
  readyState: number
  send(data: string): void
  close(): void
  onopen: ((event: Event) => void) | null
  onmessage: ((event: { data: string }) => void) | null
  onclose: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
}
let terminal: Terminal | undefined
let fit: FitAddon | undefined
let socket: SocketLike | undefined
let observer: ResizeObserver | undefined
let heartbeat: ReturnType<typeof setInterval> | undefined
let retries = 0
let closing = false
async function openTerminal() {
  await nextTick()
  closing = false
  retries = 0
  status.value = 'connecting'
  if (!terminalHost.value) return
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    lineHeight: 1.45,
    fontFamily: 'SFMono-Regular, Consolas, monospace',
    allowProposedApi: true,
    theme: {
      background: '#101828',
      foreground: '#e4e7ec',
      cursor: '#8490ff',
      selectionBackground: '#344054',
      green: '#6ce9a6',
      yellow: '#fec84b',
      blue: '#84adff',
    },
  })
  fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(terminalHost.value)
  fit.fit()
  terminal.focus()
  observer = new ResizeObserver(() => fit?.fit())
  observer.observe(terminalHost.value)
  terminal.onResize(({ cols, rows }) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify({ Op: 'resize', Cols: cols, Rows: rows }))
  })
  if (mock) startMock()
  else {
    terminal.onData((data) => socket?.send(JSON.stringify({ Op: 'stdin', Data: data })))
    await connect()
  }
}
function startMock() {
  status.value = 'connected'
  terminal?.writeln('\x1b[36mKubeCube Cloud Shell · UI 预览模式\x1b[0m')
  terminal?.writeln('此会话仅用于界面验证，不会向集群发送命令。\r\n')
  terminal?.write(`\x1b[32madmin@${scope.cluster}\x1b[0m:~$ `)
  terminal?.onData((data) => {
    if (data === '\r') {
      terminal?.writeln('')
      terminal?.write(`\x1b[32madmin@${scope.cluster}\x1b[0m:~$ `)
    } else if (data === '\u007f') terminal?.write('\b \b')
    else if (data === '\f') terminal?.clear()
    else terminal?.write(data)
  })
}
async function connect() {
  if (!terminal) return
  try {
    const response = ui.shellPod
      ? ((await webconsoleApi.podShell(scope.cluster, scope.namespace, ui.shellPod, ui.shellContainer)) as { id: string })
      : ((await webconsoleApi.cloudShell(scope.cluster)) as { id: string })
    const connection = new SockJS(`/webconsole/api/sockjs?${response.id}`) as unknown as SocketLike
    socket = connection
    connection.onopen = () => {
      status.value = 'connected'
      retries = 0
      connection.send(JSON.stringify({ Op: 'bind', SessionID: response.id }))
      heartbeat = setInterval(() => socket?.send('ping'), 9 * 60 * 1000)
    }
    connection.onmessage = (event: { data: string }) => {
      try {
        const message = JSON.parse(event.data)
        if (message.Op === 'stdout') terminal?.write(message.Data)
        else if (message.Op === 'toast') terminal?.write(`\r\n\x1b[33m${message.Data}\x1b[0m\r\n`)
      } catch {
        /* pong */
      }
    }
    connection.onclose = () => {
      clearInterval(heartbeat)
      if (closing) return
      if (retries < 3) {
        retries++
        status.value = 'reconnecting'
        setTimeout(() => {
          if (!closing) connect()
        }, 2000)
      } else {
        status.value = 'error'
        terminal?.writeln('\r\n连接已断开，请点击“重新连接”。')
      }
    }
    connection.onerror = () => {
      status.value = 'reconnecting'
    }
  } catch {
    status.value = 'error'
    terminal?.writeln('无法建立与服务器端的连接，请稍后重试。')
  }
}
async function reconnect() {
  cleanupSocket()
  status.value = 'connecting'
  terminal?.clear()
  retries = 0
  closing = false
  if (mock) startMock()
  else await connect()
}
function cleanupSocket() {
  closing = true
  clearInterval(heartbeat)
  if (socket && socket.readyState === 1) socket.send(JSON.stringify({ Op: 'stdin', Data: 'exit \r' }))
  socket?.close()
  socket = undefined
}
function cleanup() {
  cleanupSocket()
  observer?.disconnect()
  terminal?.dispose()
  terminal = undefined
  ui.shellPod = ''
  ui.shellContainer = ''
}
onBeforeUnmount(cleanup)
</script>
<style scoped>
.terminal-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.terminal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.terminal-logo {
  display: grid;
  width: 36px;
  height: 36px;
  color: #c7d2fe;
  background: #1d2939;
  border-radius: 8px;
  place-items: center;
}
h2 {
  font-size: 15px;
}
p {
  margin-top: 2px;
  color: var(--text-secondary);
  font-family: monospace;
  font-size: 11px;
}
.connection {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  color: var(--text-secondary);
  font-size: 11px;
}
.connection i {
  width: 6px;
  height: 6px;
  background: var(--warning);
  border-radius: 50%;
}
.connection--connected {
  color: var(--success);
}
.connection--connected i {
  background: var(--success);
}
.connection--error {
  color: var(--danger);
}
.connection--error i {
  background: var(--danger);
}
.terminal-body {
  position: relative;
  height: calc(100% - 36px);
  padding: 12px 16px;
  background: #101828;
}
.terminal-host {
  width: 100%;
  height: 100%;
}
.terminal-loading {
  position: absolute;
  display: flex;
  inset: 0;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #d0d5dd;
  background: rgb(16 24 40 / 82%);
}
.terminal-footer {
  display: flex;
  height: 36px;
  padding: 0 18px;
  align-items: center;
  justify-content: space-between;
  color: #98a2b3;
  background: #1d2939;
  font-size: 10px;
}
.terminal-actions {
  margin-left: auto;
}
.spinning {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 600px) {
  .connection,
  .terminal-footer span:last-child {
    display: none;
  }
}
</style>
