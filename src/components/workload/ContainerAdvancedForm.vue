<template>
  <div class="container-advanced">
    <section class="advanced-section">
      <div class="advanced-heading">
        <div>
          <h3>容器端口</h3>
          <p>一个容器可以暴露多个命名端口。</p>
        </div>
        <el-button text type="primary" @click="container.ports.push({ name: '', port: 8080, protocol: 'TCP' })"
          ><el-icon><Plus /></el-icon>添加端口</el-button
        >
      </div>
      <div v-for="(port, index) in container.ports" :key="index" class="advanced-row advanced-row--port">
        <el-input v-model="port.name" placeholder="端口名称，例如 http" />
        <el-input-number v-model="port.port" :min="1" :max="65535" :controls="false" />
        <el-select v-model="port.protocol"> <el-option value="TCP" /><el-option value="UDP" /><el-option value="SCTP" /> </el-select>
        <el-button text type="danger" aria-label="删除端口" @click="container.ports.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section class="advanced-section">
      <div class="advanced-heading">
        <div>
          <h3>环境变量</h3>
          <p>支持字面值、Secret、ConfigMap、Pod 字段和资源字段引用。</p>
        </div>
        <el-button
          text
          type="primary"
          @click="container.env.push({ name: '', source: 'value', value: '', refName: '', refKey: '', optional: false })"
          ><el-icon><Plus /></el-icon>添加变量</el-button
        >
      </div>
      <div v-for="(env, index) in container.env" :key="index" class="env-row">
        <el-input v-model="env.name" placeholder="变量名，例如 DATABASE_URL" />
        <el-select v-model="env.source" aria-label="环境变量来源">
          <el-option label="字面值" value="value" />
          <el-option label="Secret" value="secretKeyRef" />
          <el-option label="ConfigMap" value="configMapKeyRef" />
          <el-option label="Pod 字段" value="fieldRef" />
          <el-option label="资源字段" value="resourceFieldRef" />
        </el-select>
        <el-input v-if="env.source === 'value'" v-model="env.value" placeholder="变量值" />
        <template v-else-if="env.source === 'fieldRef'">
          <el-input v-model="env.refKey" placeholder="例如 metadata.name" />
        </template>
        <template v-else-if="env.source === 'resourceFieldRef'">
          <el-input v-model="env.refKey" placeholder="例如 limits.cpu" />
        </template>
        <template v-else>
          <el-input v-model="env.refName" :placeholder="env.source === 'secretKeyRef' ? 'Secret 名称' : 'ConfigMap 名称'" />
          <el-input v-model="env.refKey" placeholder="键名" />
          <el-checkbox v-model="env.optional">可选</el-checkbox>
        </template>
        <el-button text type="danger" aria-label="删除环境变量" @click="container.env.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section class="advanced-section">
      <div class="advanced-heading">
        <div>
          <h3>挂载卷</h3>
          <p>挂载名称必须与下方“Pod 存储卷”中的名称一致。</p>
        </div>
        <el-button text type="primary" @click="container.mounts.push({ volumeName: '', mountPath: '', subPath: '', readOnly: false })"
          ><el-icon><Plus /></el-icon>添加挂载</el-button
        >
      </div>
      <el-alert
        v-if="!volumes.length && container.mounts.length"
        title="尚未定义 Pod 存储卷；请先在页面下方“Pod 存储卷”中添加同名卷。"
        type="warning"
        :closable="false"
        show-icon
      />
      <div v-for="(mount, index) in container.mounts" :key="index" class="mount-row">
        <el-select v-model="mount.volumeName" filterable allow-create default-first-option placeholder="卷名称">
          <el-option v-for="name in volumes" :key="name" :label="name" :value="name" />
        </el-select>
        <el-input v-model="mount.mountPath" placeholder="挂载路径，例如 /data" />
        <el-input v-model="mount.subPath" placeholder="subPath（选填）" />
        <el-checkbox v-model="mount.readOnly">只读</el-checkbox>
        <el-button text type="danger" aria-label="删除挂载" @click="container.mounts.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section class="advanced-section">
      <div class="advanced-heading">
        <div>
          <h3>启动命令与参数</h3>
          <p>每行一个参数，留空时使用镜像默认 ENTRYPOINT/CMD。</p>
        </div>
      </div>
      <div class="command-grid">
        <label><span>启动命令</span><el-input v-model="container.command" type="textarea" :rows="3" placeholder="/bin/sh" /></label>
        <label
          ><span>命令参数</span
          ><el-input v-model="container.args" type="textarea" :rows="3" placeholder="-c&#10;while true; do sleep 30; done"
        /></label>
      </div>
    </section>

    <section v-if="container.kind !== 'init'" class="advanced-section">
      <div class="advanced-heading">
        <div>
          <h3>健康探针</h3>
          <p>存活探针失败会重启容器；就绪探针失败会从 Service Endpoints 摘除；启动探针保护慢启动容器。</p>
        </div>
      </div>
      <el-collapse>
        <el-collapse-item v-for="probe in probeEntries" :key="probe.key" :name="probe.key">
          <template #title>
            <span class="probe-title">{{ probe.label }}</span>
            <el-switch v-model="probe.value.enabled" class="probe-switch" @click.stop />
          </template>
          <div v-if="probe.value.enabled" class="probe-body">
            <div class="probe-method">
              <span>检测方式</span>
              <el-radio-group v-model="probe.value.method">
                <el-radio-button value="httpGet">HTTP</el-radio-button>
                <el-radio-button value="tcpSocket">TCP</el-radio-button>
                <el-radio-button value="exec">命令</el-radio-button>
              </el-radio-group>
            </div>
            <div v-if="probe.value.method === 'httpGet'" class="probe-grid">
              <el-input v-model="probe.value.path" placeholder="/healthz" />
              <el-input-number v-model="probe.value.port" :min="1" :max="65535" :controls="false" />
              <el-input v-model="probe.value.host" placeholder="Host（选填）" />
            </div>
            <div v-else-if="probe.value.method === 'tcpSocket'" class="probe-grid">
              <el-input-number v-model="probe.value.port" :min="1" :max="65535" :controls="false" />
              <el-input v-model="probe.value.host" placeholder="Host（选填）" />
            </div>
            <el-input
              v-else
              v-model="probe.value.command"
              type="textarea"
              :rows="3"
              placeholder="每行一个命令参数，例如 cat /tmp/healthy"
            />
            <div class="probe-grid probe-grid--timing">
              <label><span>初始等待（秒）</span><el-input-number v-model="probe.value.initialDelaySeconds" :min="0" /></label>
              <label><span>检测间隔（秒）</span><el-input-number v-model="probe.value.periodSeconds" :min="1" /></label>
              <label><span>超时（秒）</span><el-input-number v-model="probe.value.timeoutSeconds" :min="1" /></label>
              <label><span>失败阈值</span><el-input-number v-model="probe.value.failureThreshold" :min="1" /></label>
              <label><span>成功阈值</span><el-input-number v-model="probe.value.successThreshold" :min="1" /></label>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { ContainerForm } from '@/domain/workload'

defineProps<{ volumes: string[] }>()
const container = defineModel<ContainerForm>('container', { required: true })
const probeEntries = computed(() => [
  { key: 'liveness', label: '存活探针 Liveness', value: container.value.liveness },
  { key: 'readiness', label: '就绪探针 Readiness', value: container.value.readiness },
  { key: 'startup', label: '启动探针 Startup', value: container.value.startup },
])
</script>
<style scoped>
.container-advanced {
  display: grid;
  gap: 22px;
  margin-top: 24px;
}
.advanced-section {
  padding: 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-muted);
}
.advanced-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.advanced-heading h3 {
  font-size: 14px;
}
.advanced-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.advanced-row,
.env-row,
.mount-row {
  display: grid;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.advanced-row--port {
  grid-template-columns: minmax(120px, 1fr) 110px 100px 32px;
}
.env-row {
  grid-template-columns: minmax(120px, 0.8fr) 120px minmax(120px, 1fr) minmax(100px, 0.7fr) auto 32px;
}
.env-row > .el-input:only-of-type {
  grid-column: span 2;
}
.mount-row {
  grid-template-columns: minmax(120px, 0.8fr) minmax(140px, 1fr) minmax(100px, 0.7fr) auto 32px;
}
.command-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.command-grid label,
.probe-grid label {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}
.probe-title {
  font-weight: 600;
}
.probe-switch {
  margin-left: 12px;
}
.probe-body {
  display: grid;
  gap: 14px;
}
.probe-method {
  display: flex;
  align-items: center;
  gap: 14px;
}
.probe-method > span {
  color: var(--text-secondary);
  font-size: 12px;
}
.probe-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 10px;
}
.probe-grid--timing {
  grid-template-columns: repeat(5, minmax(90px, 1fr));
}
@media (max-width: 900px) {
  .env-row,
  .mount-row,
  .command-grid,
  .probe-grid,
  .probe-grid--timing {
    grid-template-columns: 1fr;
  }
}
</style>
