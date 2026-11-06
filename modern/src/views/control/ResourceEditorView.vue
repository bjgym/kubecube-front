<template>
  <div class="page page-stack editor-page">
    <PageHeader
      :title="pageTitle"
      :description="isUpdateImage ? '更新容器镜像并触发一次滚动发布，过程中服务保持按策略可用。' : config.description"
      :breadcrumbs="['资源控制台', config.title, isUpdateImage ? '滚动更新' : isEdit ? '设置' : '创建']"
    >
      <template #actions
        ><el-button @click="router.back()">取消</el-button
        ><el-button type="primary" :loading="submitting" @click="submit">{{ isEdit ? '保存并应用' : '确认创建' }}</el-button></template
      >
    </PageHeader>

    <template v-if="isUpdateImage">
      <section class="surface surface-padded">
        <div class="section-heading">
          <div>
            <h2>容器镜像</h2>
            <p>修改一个或多个容器镜像，保存后立即触发滚动更新。</p>
          </div>
          <el-tag type="warning" effect="plain">滚动更新</el-tag>
        </div>
        <div v-for="(container, index) in form.containers" :key="index" class="image-row">
          <el-input v-model="container.name" disabled><template #prepend>容器</template></el-input
          ><el-input v-model="container.image" placeholder="registry/project/image:tag"><template #prepend>镜像</template></el-input>
        </div>
      </section>
    </template>
    <template v-else>
      <div class="editor-mode surface">
        <el-steps :active="currentStep" align-center finish-status="success" class="editor-steps"
          ><el-step title="基本信息" /><el-step title="资源配置" /><el-step title="确认提交" /></el-steps
        ><el-radio-group v-model="mode" size="small"
          ><el-radio-button value="guided">向导配置</el-radio-button
          ><el-radio-button value="yaml">YAML 配置</el-radio-button></el-radio-group
        >
      </div>
      <el-form v-if="mode === 'guided'" ref="formRef" :model="form" label-position="top" @submit.prevent>
        <section v-show="currentStep === 0" class="surface surface-padded form-section">
          <div class="section-heading">
            <div>
              <h2>基本信息</h2>
              <p>资源名称创建后不可修改；请使用有意义的名称和标签。</p>
            </div>
          </div>
          <div class="form-grid">
            <el-form-item label="资源名称" required :error="nameError"
              ><el-input
                v-model="form.name"
                :disabled="isEdit"
                placeholder="例如：order-service"
                maxlength="63"
                @blur="validateName" /></el-form-item
            ><el-form-item label="命名空间"
              ><el-input v-if="isNetwork" v-model="networkNamespace" :disabled="isEdit" placeholder="目标命名空间" /><el-input
                v-else
                :model-value="contextNamespace"
                disabled /></el-form-item
            ><el-form-item v-if="isScalable" label="期望副本数"
              ><el-input-number v-model="form.replicas" :min="0" :max="1000" /></el-form-item
            ><el-form-item v-if="config.key === 'cronjobs'" label="Cron 调度规则" required
              ><el-input v-model="form.schedule" placeholder="0 2 * * *"
            /></el-form-item>
          </div>
          <div class="field-header">
            <span>标签</span
            ><el-button text type="primary" @click="form.labels.push({ key: '', value: '' })"
              ><el-icon><Plus /></el-icon>添加标签</el-button
            >
          </div>
          <div v-for="(label, index) in form.labels" :key="index" class="key-value-row">
            <el-input v-model="label.key" placeholder="键，例如 app" /><el-input
              v-model="label.value"
              placeholder="值，例如 shop-web"
            /><el-button text type="danger" aria-label="删除标签" @click="form.labels.splice(index, 1)"
              ><el-icon><Delete /></el-icon
            ></el-button>
          </div>
        </section>

        <section v-show="currentStep === 1" class="surface surface-padded form-section">
          <div class="section-heading">
            <div>
              <h2>{{ resourceSectionTitle }}</h2>
              <p>常用配置通过向导完成，高级配置可切换 YAML 编辑器。</p>
            </div>
            <div v-if="isWorkload" class="heading-actions">
              <el-button text type="primary" @click="addContainer('normal')"
                ><el-icon><Plus /></el-icon>添加容器</el-button
              ><el-button text type="primary" @click="addContainer('init')"
                ><el-icon><Plus /></el-icon>添加 Init 容器</el-button
              >
            </div>
          </div>
          <template v-if="isWorkload"
            ><el-tabs v-model="activeContainer" type="card" closable @tab-remove="removeContainer"
              ><el-tab-pane
                v-for="(container, index) in form.containers"
                :key="index"
                :name="String(index)"
                :label="`${container.name || `容器 ${Number(index) + 1}`}${container.kind === 'init' ? '（Init）' : ''}`"
                ><div class="form-grid">
                  <el-form-item label="容器名称" required><el-input v-model="container.name" /></el-form-item
                  ><el-form-item label="容器镜像" required><el-input v-model="container.image" placeholder="nginx:1.27" /></el-form-item
                  ><el-form-item label="镜像拉取策略"
                    ><el-select v-model="container.imagePullPolicy"
                      ><el-option value="IfNotPresent" /><el-option value="Always" /><el-option value="Never" /></el-select></el-form-item
                  ><el-form-item label="CPU 请求"><el-input v-model="container.cpuRequest" placeholder="500m" /></el-form-item
                  ><el-form-item label="CPU 限制"><el-input v-model="container.cpuLimit" placeholder="1" /></el-form-item
                  ><el-form-item label="内存请求"><el-input v-model="container.memoryRequest" placeholder="512Mi" /></el-form-item
                  ><el-form-item label="内存限制"
                    ><el-input v-model="container.memoryLimit" placeholder="1Gi"
                  /></el-form-item></div></el-tab-pane
            ></el-tabs>
            <ContainerAdvancedForm v-if="activeContainerModel" :container="activeContainerModel" :volumes="volumeNames" />
            <PodSettingsForm v-model="form.pod" :config-key="config.key" />
          </template>
          <template v-else-if="isNetwork"><NetworkPolicyForm v-model="form.network" /></template>
          <template v-else-if="config.key === 'configmaps'"
            ><div class="field-header">
              <span>配置数据</span
              ><el-button text type="primary" @click="form.data.push({ key: '', value: '' })"
                ><el-icon><Plus /></el-icon>添加配置项</el-button
              >
            </div>
            <div v-for="(entry, index) in form.data" :key="index" class="data-row">
              <el-input v-model="entry.key" placeholder="键 / 文件名" /><el-input
                v-model="entry.value"
                type="textarea"
                :rows="2"
                placeholder="值或文件内容"
              /><el-button text type="danger" @click="form.data.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button></div
          ></template>
          <template v-else-if="config.key === 'secrets'"
            ><el-form-item label="Secret 类型"
              ><el-select v-model="form.secretType"
                ><el-option label="Opaque（通用）" value="Opaque" /><el-option label="TLS 证书" value="kubernetes.io/tls" /><el-option
                  label="镜像仓库凭据"
                  value="kubernetes.io/dockerconfigjson" /></el-select
            ></el-form-item>
            <template v-if="form.secretType === 'kubernetes.io/tls'">
              <el-alert
                title="TLS Secret 需要 tls.crt 与 tls.key。证书链和私钥仅在保存时提交，不会写入日志。"
                type="info"
                :closable="false"
                show-icon
              />
              <div class="tls-grid">
                <label
                  ><span>证书 tls.crt</span
                  ><el-input v-model="form.tlsCrt" type="textarea" :rows="8" placeholder="-----BEGIN CERTIFICATE-----"
                /></label>
                <label
                  ><span>私钥 tls.key</span
                  ><el-input v-model="form.tlsKey" type="textarea" :rows="8" placeholder="-----BEGIN PRIVATE KEY-----"
                /></label>
              </div>
              <div class="tls-actions">
                <el-upload :auto-upload="false" :show-file-list="false" accept=".crt,.pem" :on-change="onTlsCrtChange"
                  ><el-button>从文件读取证书</el-button></el-upload
                >
                <el-upload :auto-upload="false" :show-file-list="false" accept=".key,.pem" :on-change="onTlsKeyChange"
                  ><el-button>从文件读取私钥</el-button></el-upload
                >
              </div>
            </template>
            <div v-else-if="form.secretType === 'kubernetes.io/dockerconfigjson'" class="form-grid">
              <el-form-item label="仓库地址"
                ><el-input v-model="form.registryServer" placeholder="https://index.docker.io/v1/"
              /></el-form-item>
              <el-form-item label="用户名"><el-input v-model="form.registryUsername" /></el-form-item>
              <el-form-item label="密码"
                ><el-input v-model="form.registryPassword" type="password" show-password autocomplete="new-password"
              /></el-form-item>
              <el-form-item label="邮箱（选填）"><el-input v-model="form.registryEmail" /></el-form-item>
              <el-alert
                class="registry-help"
                title="保存时会生成 .dockerconfigjson，并自动计算 auth 字段。"
                type="info"
                :closable="false"
              />
            </div>
            <template v-else>
              <div class="field-header">
                <span>敏感数据（stringData）</span
                ><el-button text type="primary" @click="form.data.push({ key: '', value: '' })"
                  ><el-icon><Plus /></el-icon>添加配置项</el-button
                >
              </div>
              <div v-for="(entry, index) in form.data" :key="index" class="data-row">
                <el-input v-model="entry.key" placeholder="键 / 文件名" /><el-input
                  v-model="entry.value"
                  type="textarea"
                  :rows="2"
                  placeholder="值或文件内容"
                /><el-button text type="danger" @click="form.data.splice(index, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
              <p class="form-help">已有键保持原值；删除行会从 Secret 中移除该键。留空不会覆盖已有值。</p></template
            ></template
          >
          <template v-else-if="config.key === 'services'"
            ><div class="form-grid">
              <el-form-item label="目标工作负载（可选）"
                ><el-select
                  v-model="form.serviceTarget"
                  clearable
                  filterable
                  :loading="serviceWorkloadsLoading"
                  placeholder="选择 Deployment / StatefulSet / DaemonSet"
                  @change="applyServiceTarget"
                  ><el-option
                    v-for="option in serviceWorkloadOptions"
                    :key="option.value"
                    :label="`${option.kind} / ${option.name}`"
                    :value="option.value" /></el-select
                ><span class="form-help"
                  >选择后按目标工作负载的 Pod 模板标签重建 selector；编辑时留空则完整保留原 selector。</span
                ></el-form-item
              ><el-form-item label="服务类型"
                ><el-select v-model="form.serviceType"
                  ><el-option value="ClusterIP" /><el-option value="NodePort" /><el-option value="LoadBalancer" /><el-option
                    value="ExternalName" /></el-select></el-form-item
              ><el-form-item v-if="form.serviceType === 'ExternalName'" label="ExternalName"
                ><el-input v-model="form.serviceExternalName" placeholder="shop.example.com" /></el-form-item
              ><el-form-item label="Headless 服务"><el-switch v-model="form.serviceHeadless" /></el-form-item
              ><el-form-item label="会话保持"
                ><el-select v-model="form.serviceSessionAffinity"
                  ><el-option label="不启用" value="None" /><el-option label="按客户端 IP" value="ClientIP" /></el-select></el-form-item
              ><el-form-item v-if="form.serviceSessionAffinity === 'ClientIP'" label="会话超时（秒）"
                ><el-input-number v-model="form.serviceSessionAffinitySeconds" :min="0" /></el-form-item
              ><el-form-item label="External IPs（逗号分隔）"
                ><el-input v-model="form.serviceExternalIps" placeholder="203.0.113.10, 203.0.113.11" /></el-form-item
              ><el-form-item label="类型说明"
                ><span class="form-help"
                  >Headless 会设置 clusterIP=None；ExternalName 不生成 selector；修改已有 ClusterIP 由 Kubernetes 拒绝不可变字段。</span
                ></el-form-item
              >
            </div>
            <div class="field-header">
              <span>服务端口</span
              ><el-button text type="primary" @click="form.servicePorts.push({ name: '', port: 80, targetPort: 8080, protocol: 'TCP' })"
                ><el-icon><Plus /></el-icon>添加端口</el-button
              >
            </div>
            <div v-for="(port, index) in form.servicePorts" :key="index" class="service-port-row">
              <el-input v-model="port.name" placeholder="端口名称，例如 http" /><el-input-number
                v-model="port.port"
                :min="1"
                :max="65535"
                :controls="false"
              /><el-input-number v-model="port.targetPort" :min="1" :max="65535" :controls="false" /><el-select v-model="port.protocol"
                ><el-option value="TCP" /><el-option value="UDP" /><el-option value="SCTP" /></el-select
              ><el-input-number
                v-if="form.serviceType === 'NodePort'"
                v-model="port.nodePort"
                :min="30000"
                :max="32767"
                :controls="false"
                placeholder="NodePort"
              /><el-button text type="danger" aria-label="删除服务端口" @click="form.servicePorts.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button>
            </div>
            <div class="field-header">
              <span>Pod 选择器</span
              ><el-button text type="primary" @click="form.serviceSelector.push({ key: '', value: '' })"
                ><el-icon><Plus /></el-icon>添加选择器</el-button
              >
            </div>
            <div v-for="(selector, index) in form.serviceSelector" :key="index" class="key-value-row">
              <el-input v-model="selector.key" placeholder="标签键，例如 app" /><el-input
                v-model="selector.value"
                placeholder="标签值，例如 shop-web"
              /><el-button text type="danger" aria-label="删除选择器" @click="form.serviceSelector.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button>
            </div>
            <p class="form-help">
              编辑已有 Service 时会保留未修改的 selector；新建 Service 时应填写与目标 Pod 标签一致的选择器，留空表示不使用选择器。
            </p></template
          >
          <template v-else-if="config.key === 'ingresses'"
            ><div class="form-grid">
              <el-form-item label="Ingress Class"><el-input v-model="form.ingressClass" /></el-form-item>
            </div>
            <div class="field-header">
              <span>Ingress 规则</span
              ><el-button
                text
                type="primary"
                @click="form.ingressRules.push({ host: '', paths: [{ path: '/', pathType: 'Prefix', serviceName: '', servicePort: 80 }] })"
                ><el-icon><Plus /></el-icon>添加域名</el-button
              >
            </div>
            <div v-for="(rule, ruleIndex) in form.ingressRules" :key="ruleIndex" class="ingress-rule-card">
              <div class="ingress-rule-head">
                <el-input v-model="rule.host" placeholder="访问域名，例如 shop.example.com" />
                <el-button text type="danger" aria-label="删除域名规则" @click="form.ingressRules.splice(ruleIndex, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
              <div v-for="(path, pathIndex) in rule.paths" :key="pathIndex" class="ingress-path-row">
                <el-input v-model="path.path" placeholder="/" />
                <el-select v-model="path.pathType"
                  ><el-option value="Prefix" /><el-option value="Exact" /><el-option value="ImplementationSpecific" /></el-select
                ><el-input v-model="path.serviceName" placeholder="后端 Service" /><el-input-number
                  v-model="path.servicePort"
                  :min="1"
                  :max="65535"
                  :controls="false"
                /><el-button text type="danger" aria-label="删除路径" @click="rule.paths.splice(pathIndex, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
              <el-button text type="primary" @click="rule.paths.push({ path: '/', pathType: 'Prefix', serviceName: '', servicePort: 80 })"
                ><el-icon><Plus /></el-icon>添加路径</el-button
              >
            </div>
            <div class="field-header">
              <span>TLS 证书</span
              ><el-button text type="primary" @click="form.ingressTls.push({ hosts: '', secretName: '' })"
                ><el-icon><Plus /></el-icon>添加 TLS</el-button
              >
            </div>
            <div v-for="(tls, index) in form.ingressTls" :key="index" class="ingress-tls-row">
              <el-input v-model="tls.hosts" placeholder="域名列表，逗号分隔；留空表示全部" /><el-input
                v-model="tls.secretName"
                placeholder="TLS Secret 名称"
              /><el-button text type="danger" aria-label="删除 TLS" @click="form.ingressTls.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button></div
          ></template>
          <template v-else-if="config.key === 'persistentvolumeclaims'"
            ><div class="form-grid">
              <el-form-item label="存储容量"><el-input v-model="form.storage" placeholder="10Gi" /></el-form-item
              ><el-form-item label="存储类别"><el-input v-model="form.storageClass" placeholder="local-path" /></el-form-item
              ><el-form-item label="访问模式"
                ><el-select v-model="form.accessMode"
                  ><el-option label="独占读写 (ReadWriteOnce)" value="ReadWriteOnce" /><el-option
                    label="只读共享 (ReadOnlyMany)"
                    value="ReadOnlyMany" /><el-option label="共享读写 (ReadWriteMany)" value="ReadWriteMany" /></el-select
              ></el-form-item></div
          ></template>
          <template v-else-if="config.key === 'PrometheusRule'"
            ><div class="form-grid">
              <el-form-item label="规则组名称"><el-input v-model="form.ruleGroup" /></el-form-item
              ><el-form-item label="告警名称"><el-input v-model="form.alertName" /></el-form-item
              ><el-form-item label="持续时间"><el-input v-model="form.duration" placeholder="5m" /></el-form-item
              ><el-form-item label="级别"
                ><el-select v-model="form.severity"
                  ><el-option value="critical" /><el-option value="warning" /><el-option value="info" /></el-select
              ></el-form-item>
            </div>
            <el-form-item label="PromQL 表达式"><el-input v-model="form.expression" type="textarea" :rows="4" class="mono" /></el-form-item
          ></template>
          <template v-else-if="config.key === 'AlertmanagerConfig'"
            ><div class="form-grid">
              <el-form-item label="接收人名称"><el-input v-model="form.receiver" /></el-form-item
              ><el-form-item label="路由分组键"><el-input v-model="form.groupBy" placeholder="alertname, cluster" /></el-form-item
              ><el-form-item label="groupWait"><el-input v-model="form.groupWait" placeholder="30s" /></el-form-item
              ><el-form-item label="groupInterval"><el-input v-model="form.groupInterval" placeholder="5m" /></el-form-item
              ><el-form-item label="repeatInterval"><el-input v-model="form.repeatInterval" placeholder="4h" /></el-form-item>
            </div>
            <div class="field-header">
              <span>通知渠道</span
              ><el-button text type="primary" @click="form.receivers.push(newAlertReceiver())"
                ><el-icon><Plus /></el-icon>添加渠道</el-button
              >
            </div>
            <div v-if="!form.receivers.length" class="form-help">至少添加一个邮件、企业微信或 Webhook 渠道。</div>
            <div v-for="(channel, index) in form.receivers" :key="index" class="alert-channel-card">
              <div class="alert-channel-head">
                <el-select v-model="channel.type">
                  <el-option label="企业微信" value="wechat" /><el-option label="邮件" value="email" /><el-option
                    label="Webhook"
                    value="webhook"
                  />
                </el-select>
                <label class="inline-check"><el-switch v-model="channel.sendResolved" /><span>发送恢复通知</span></label>
                <el-button text type="danger" aria-label="删除通知渠道" @click="form.receivers.splice(index, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
              <div v-if="channel.type === 'wechat'" class="form-grid">
                <el-form-item label="企业微信用户名"><el-input v-model="channel.toUser" placeholder="企业微信用户 ID" /></el-form-item>
                <el-form-item label="用户组"><el-input v-model="channel.toParty" placeholder="企业微信部门 ID" /></el-form-item>
                <el-form-item label="用户标签"><el-input v-model="channel.toTag" placeholder="企业微信标签" /></el-form-item>
                <el-form-item label="apiURL"><el-input v-model="channel.apiURL" placeholder="留空使用默认地址" /></el-form-item>
                <el-form-item label="corpID"><el-input v-model="channel.corpID" placeholder="企业 ID" /></el-form-item>
                <el-form-item label="agentID"><el-input v-model="channel.agentID" placeholder="应用 ID" /></el-form-item>
                <el-form-item label="apiSecret 名称"><el-input v-model="channel.secretName" placeholder="Secret 名称" /></el-form-item>
                <el-form-item label="apiSecret 键"><el-input v-model="channel.secretKey" placeholder="data 键" /></el-form-item>
              </div>
              <div v-else-if="channel.type === 'email'" class="form-grid">
                <el-form-item label="收件人"><el-input v-model="channel.to" placeholder="ops@example.com" /></el-form-item>
                <el-form-item label="发件人"><el-input v-model="channel.from" placeholder="alert@example.com" /></el-form-item>
                <el-form-item label="SMTP 地址"><el-input v-model="channel.smarthost" placeholder="smtp.example.com:465" /></el-form-item>
                <el-form-item label="认证用户名"><el-input v-model="channel.authUsername" placeholder="SMTP 用户名" /></el-form-item>
                <el-form-item label="认证密码"
                  ><el-input v-model="channel.authPassword" type="password" show-password autocomplete="new-password"
                /></el-form-item>
                <el-form-item label="认证 Secret 名称"><el-input v-model="channel.secretName" /></el-form-item>
                <el-form-item label="认证 Secret 名称"><el-input v-model="channel.secretKey" /></el-form-item>
              </div>
              <div v-else class="form-grid">
                <el-form-item label="Webhook URL"
                  ><el-input v-model="channel.url" placeholder="https://hooks.example.com/alert"
                /></el-form-item>
                <el-form-item label="maxAlerts"><el-input-number v-model="channel.maxAlerts" :min="0" /></el-form-item>
              </div></div
          ></template>
          <template v-else-if="config.key === 'logconfigs'"
            ><div class="form-grid">
              <el-form-item label="日志类型"
                ><el-select v-model="form.logType"
                  ><el-option label="容器标准输出" value="dockerStdout" /><el-option label="容器日志文件" value="k8sLogfile" /><el-option
                    label="节点日志文件"
                    value="logfile" /></el-select></el-form-item
              ><el-form-item label="采集路径"><el-input v-model="form.logPath" /></el-form-item
              ><el-form-item label="容器名称（选填）"
                ><el-input v-model="form.logContainerName" placeholder="留空表示全部容器" /></el-form-item
              ><el-form-item label="忽略早于"><el-input v-model="form.logIgnoreOlder" placeholder="24h" /></el-form-item
              ><el-form-item label="保留天数"><el-input-number v-model="form.logRetainDays" :min="0" /></el-form-item
              ><el-form-item label="排除文件"><el-input v-model="form.logExcludeFiles" placeholder="*.tmp, *.log.gz" /></el-form-item>
            </div>
            <div class="field-header">
              <span>Pod 标签选择器</span
              ><el-button text type="primary" @click="form.logLabelSelector.push({ key: '', value: '' })"
                ><el-icon><Plus /></el-icon>添加标签</el-button
              >
            </div>
            <div v-for="(selector, index) in form.logLabelSelector" :key="index" class="key-value-row">
              <el-input v-model="selector.key" placeholder="标签键，例如 app" /><el-input
                v-model="selector.value"
                placeholder="标签值，例如 shop-web"
              /><el-button text type="danger" aria-label="删除日志标签" @click="form.logLabelSelector.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button>
            </div>
            <div class="field-header"><span>多行日志</span><el-switch v-model="form.logMultiline" /></div>
            <el-input v-if="form.logMultiline" v-model="form.logMultilinePattern" placeholder="多行匹配正则，例如^\s" />
            <div class="field-header">
              <span>匹配字段与追加字段</span
              ><el-button text type="primary" @click="form.logFields.push({ key: '', value: '' })"
                ><el-icon><Plus /></el-icon>添加字段</el-button
              >
            </div>
            <div v-for="(field, index) in form.logFields" :key="index" class="key-value-row">
              <el-input v-model="field.key" placeholder="字段名，例如 service" /><el-input
                v-model="field.value"
                placeholder="字段值或提取表达式"
              /><el-button text type="danger" aria-label="删除日志字段" @click="form.logFields.splice(index, 1)"
                ><el-icon><Delete /></el-icon
              ></el-button>
            </div>
          </template>
          <template v-else
            ><el-alert type="info" title="该资源使用标准 Kubernetes 声明式配置，请切换到 YAML 完成详细设置。" :closable="false" show-icon
          /></template>
        </section>

        <section v-show="currentStep === 2" class="surface surface-padded">
          <div class="section-heading">
            <div>
              <h2>确认资源声明</h2>
              <p>请核对集群、空间和 YAML。提交后由 Kubernetes 执行实际变更。</p>
            </div>
            <el-tag>{{ contextCluster }} / {{ contextNamespace }}</el-tag>
          </div>
          <CodeEditor :model-value="previewYaml" :read-only="true" height="440px" />
        </section>
        <div class="editor-navigation">
          <el-button :disabled="currentStep === 0" @click="currentStep--">上一步</el-button
          ><el-button v-if="currentStep < 2" type="primary" @click="nextStep">下一步</el-button
          ><el-button v-else type="primary" :loading="submitting" @click="submit">{{ isEdit ? '保存并应用' : '确认创建' }}</el-button>
        </div>
      </el-form>
      <section v-else class="surface surface-padded">
        <div class="section-heading">
          <div>
            <h2>YAML 资源声明</h2>
            <p>可配置当前资源的全部字段。保存前会校验 YAML 格式。</p>
          </div>
          <el-tag type="info">高级模式</el-tag>
        </div>
        <CodeEditor v-model="yamlContent" height="560px" /><el-alert
          v-if="yamlError"
          class="yaml-error"
          type="error"
          :title="yamlError"
          :closable="false"
        />
      </section>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type UploadFile } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import CodeEditor from '@/components/CodeEditor.vue'
import ContainerAdvancedForm from '@/components/workload/ContainerAdvancedForm.vue'
import PodSettingsForm from '@/components/workload/PodSettingsForm.vue'
import NetworkPolicyForm from '@/components/workload/NetworkPolicyForm.vue'
import { resourceApi } from '@/api/resource'
import { getResourceConfig, type ResourceConfig } from '@/config/resources'
import { useScopeStore } from '@/stores/scope'
import { mergeServiceSpec, serviceSelectorFromWorkload } from '@/domain/service'
import { mergeIngressSpec, type IngressRuleForm, type IngressTlsForm } from '@/domain/ingress'
import { mergeNetworkPolicySpec, networkPolicyToForm, newNetworkPolicyForm } from '@/domain/network-policy'
import {
  buildAffinity,
  buildContainer,
  buildPodVolumes,
  containerToForm,
  newContainer,
  newWorkloadPodForm,
  podFormFromSpec,
  toToleration,
  type ContainerForm,
  type KeyValue,
  type PodVolumeForm,
  type VolumeClaimTemplateForm,
} from '@/domain/workload'
import { fromYAML, toYAML, validateYAML } from '@/utils/yaml'
import type { KubeResource } from '@/types/api'
const networkConfig: ResourceConfig = {
  key: 'networkpolicies',
  plural: 'networkpolicies',
  kind: 'NetworkPolicy',
  group: 'networking.k8s.io',
  version: 'v1',
  namespaced: true,
  title: '网络策略',
  shortTitle: 'NetworkPolicy',
  description: '管理 Pod 网络访问策略',
  canCreate: true,
  canEdit: true,
  columns: [],
  tabs: ['info'],
}
const route = useRoute()
const router = useRouter()
const scope = useScopeStore()
const config = computed(() => getResourceConfig(String(route.params.workload || '')) || networkConfig)
const isNetwork = computed(() => route.path.includes('/network/'))
const networkNamespace = ref(String(route.params.namespace || route.query.namespace || scope.namespace))
const isEdit = computed(() => Boolean(route.params.instance))
const isUpdateImage = computed(() => route.path.endsWith('/updateImage'))
const isWorkload = computed(() => ['deployments', 'statefulsets', 'daemonsets', 'jobs', 'cronjobs'].includes(config.value.key))
const isScalable = computed(() => ['deployments', 'statefulsets'].includes(config.value.key))
const pageTitle = computed(() =>
  isUpdateImage.value ? `滚动更新 · ${String(route.params.instance)}` : `${isEdit.value ? '设置' : '创建'} ${config.value.shortTitle}`,
)
const contextNamespace = computed(() =>
  isNetwork.value
    ? String(route.params.namespace || networkNamespace.value || scope.namespace)
    : ['PrometheusRule', 'AlertmanagerConfig'].includes(config.value.key)
      ? String((scope.currentProject?.spec as Record<string, unknown> | undefined)?.namespace || scope.namespace)
      : scope.namespace,
)
const contextCluster = computed(() => (isNetwork.value ? String(route.params.name) : scope.cluster))
const formRef = ref<FormInstance>()
const currentStep = ref(0)
const mode = ref<'guided' | 'yaml'>('guided')
const submitting = ref(false)
const loaded = ref(false)
const dirty = ref(false)
const nameError = ref('')
const yamlContent = ref('')
const yamlError = ref('')
const activeContainer = ref('0')
const rawResource = ref<KubeResource>()
interface AlertReceiverForm {
  type: 'wechat' | 'email' | 'webhook'
  sendResolved: boolean
  toUser: string
  toParty: string
  toTag: string
  apiURL: string
  corpID: string
  agentID: string
  to: string
  from: string
  smarthost: string
  authUsername: string
  authPassword: string
  secretName: string
  secretKey: string
  url: string
  maxAlerts: number
}
function newAlertReceiver(type: AlertReceiverForm['type'] = 'wechat'): AlertReceiverForm {
  return {
    type,
    sendResolved: true,
    toUser: '',
    toParty: '',
    toTag: '',
    apiURL: '',
    corpID: '',
    agentID: '',
    to: '',
    from: '',
    smarthost: '',
    authUsername: '',
    authPassword: '',
    secretName: '',
    secretKey: '',
    url: '',
    maxAlerts: 0,
  }
}
function alertReceiverToKube(channel: AlertReceiverForm): Record<string, unknown> {
  const secret = channel.secretName ? { name: channel.secretName, ...(channel.secretKey ? { key: channel.secretKey } : {}) } : undefined
  if (channel.type === 'wechat')
    return {
      sendResolved: channel.sendResolved,
      ...(channel.toUser ? { toUser: channel.toUser } : {}),
      ...(channel.toParty ? { toParty: channel.toParty } : {}),
      ...(channel.toTag ? { toTag: channel.toTag } : {}),
      ...(channel.apiURL ? { apiURL: channel.apiURL } : {}),
      ...(channel.corpID ? { corpID: channel.corpID } : {}),
      ...(channel.agentID ? { agentID: channel.agentID } : {}),
      ...(secret ? { apiSecret: secret } : {}),
    }
  if (channel.type === 'email')
    return {
      sendResolved: channel.sendResolved,
      to: channel.to,
      ...(channel.from ? { from: channel.from } : {}),
      ...(channel.smarthost ? { smarthost: channel.smarthost } : {}),
      ...(channel.authUsername ? { authUsername: channel.authUsername } : {}),
      ...(channel.authPassword ? { authPassword: channel.authPassword } : {}),
      ...(secret ? { authSecret: secret } : {}),
    }
  return {
    sendResolved: channel.sendResolved,
    url: channel.url,
    ...(channel.maxAlerts ? { maxAlerts: channel.maxAlerts } : {}),
  }
}
const form: any = reactive({
  name: '',
  replicas: 1,
  schedule: '0 2 * * *',
  containers: [
    {
      ...newContainer(1),
      name: 'app',
      image: 'nginx:1.27',
      ports: [{ name: 'http', port: 8080, protocol: 'TCP' }],
    },
  ] as ContainerForm[],
  pod: newWorkloadPodForm(),
  network: newNetworkPolicyForm(),
  labels: [{ key: 'app', value: '' }] as KeyValue[],
  data: [{ key: 'app.properties', value: 'key=value' }] as KeyValue[],
  secretType: 'Opaque',
  tlsCrt: '',
  tlsKey: '',
  registryServer: 'https://index.docker.io/v1/',
  registryUsername: '',
  registryPassword: '',
  registryEmail: '',
  serviceType: 'ClusterIP',
  serviceTarget: '',
  serviceExternalName: '',
  serviceSelector: [] as KeyValue[],
  servicePorts: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' as const }] as Array<{
    name: string
    port: number
    targetPort: number
    protocol: 'TCP' | 'UDP' | 'SCTP'
    nodePort?: number
  }>,
  serviceHeadless: false,
  serviceExternalIps: '',
  serviceSessionAffinity: 'None' as 'None' | 'ClientIP',
  serviceSessionAffinitySeconds: 10800,
  ingressRules: [
    {
      host: 'app.example.com',
      paths: [{ path: '/', pathType: 'Prefix' as const, serviceName: '', servicePort: 80 }],
    },
  ] as IngressRuleForm[],
  ingressTls: [] as IngressTlsForm[],
  port: 80,
  targetPort: 8080,
  ingressClass: 'nginx',
  host: 'app.example.com',
  path: '/',
  backendService: '',
  storage: '10Gi',
  storageClass: 'local-path',
  accessMode: 'ReadWriteOnce',
  ruleGroup: 'availability',
  alertName: 'HighErrorRate',
  duration: '5m',
  severity: 'critical',
  expression: 'rate(http_requests_total{code=~"5.."}[5m]) > 0.1',
  receiver: 'feishu-oncall',
  groupBy: 'alertname, cluster',
  groupWait: '30s',
  groupInterval: '5m',
  repeatInterval: '4h',
  receivers: [] as AlertReceiverForm[],
  logType: 'dockerStdout',
  logPath: '/var/log/containers',
  logContainerName: '',
  logIgnoreOlder: '0h',
  logRetainDays: 0,
  logExcludeFiles: '',
  logMultiline: false,
  logMultilinePattern: '',
  logLabelSelector: [] as KeyValue[],
  logFields: [] as KeyValue[],
})
interface ServiceWorkloadOption {
  value: string
  kind: string
  name: string
  selector: Record<string, string>
}
const serviceWorkloadOptions = ref<ServiceWorkloadOption[]>([])
const serviceWorkloadsLoading = ref(false)
async function loadServiceWorkloads() {
  if (config.value.key !== 'services' || !contextCluster.value || !contextNamespace.value) return
  serviceWorkloadsLoading.value = true
  try {
    const definitions = ['deployments', 'statefulsets', 'daemonsets']
      .map((key) => getResourceConfig(key))
      .filter((definition): definition is ResourceConfig => Boolean(definition))
    const responses = await Promise.all(
      definitions.map((definition) =>
        resourceApi.list(definition, { cluster: contextCluster.value, namespace: contextNamespace.value }, { pageNum: 1, pageSize: 500 }),
      ),
    )
    serviceWorkloadOptions.value = responses.flatMap((response, index) =>
      (response.items || []).flatMap((item) => {
        const selector = serviceSelectorFromWorkload((item.spec || {}) as Record<string, any>)
        const entries = Object.entries(selector)
        if (!entries.length) return []
        return [
          {
            value: `${definitions[index]!.kind}/${item.metadata.name}`,
            kind: definitions[index]!.kind,
            name: item.metadata.name,
            selector,
          },
        ]
      }),
    )
  } catch {
    serviceWorkloadOptions.value = []
  } finally {
    serviceWorkloadsLoading.value = false
  }
}
function applyServiceTarget(value: string) {
  if (!value) return
  const option = serviceWorkloadOptions.value.find((item) => item.value === value)
  if (!option) return
  form.serviceSelector = Object.entries(option.selector).map(([key, selectorValue]) => ({ key, value: selectorValue }))
}
const resourceSectionTitle = computed(() => (isWorkload.value ? '容器与资源' : config.value.shortTitle + ' 配置'))
const volumeNames = computed(() =>
  [
    ...form.pod.volumes.map((volume: PodVolumeForm) => volume.name),
    ...form.pod.volumeClaimTemplates.map((template: VolumeClaimTemplateForm) => template.name),
  ].filter(Boolean),
)
const activeContainerModel = computed(() => form.containers[Number(activeContainer.value)])
function pairs(items: KeyValue[]) {
  return Object.fromEntries(items.filter((item) => item.key).map((item) => [item.key, item.value]))
}
function decodeBase64(value: string | undefined): string {
  if (!value) return ''
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)))
  } catch {
    return ''
  }
}
async function readTlsFile(file: UploadFile, kind: 'crt' | 'key') {
  const text = await file.raw?.text()
  if (!text) return
  if (kind === 'crt') form.tlsCrt = text
  else form.tlsKey = text
}
function onTlsCrtChange(file: UploadFile) {
  void readTlsFile(file, 'crt')
}
function onTlsKeyChange(file: UploadFile) {
  void readTlsFile(file, 'key')
}
function mergedContainers(existing: Array<Record<string, any>> = [], kind: 'normal' | 'init' = 'normal') {
  return form.containers
    .filter((container: ContainerForm) => container.kind === kind)
    .map((container: ContainerForm) =>
      buildContainer(
        container,
        existing.find((item) => item.name === container.name),
      ),
    )
}
function containersWithUpdatedImages(existing: Array<Record<string, any>> = []) {
  return existing.map((container) => ({
    ...container,
    image: form.containers.find((item: ContainerForm) => item.name === container.name)?.image || container.image,
  }))
}
function podTemplate(existing: Record<string, any> = {}, restartPolicy?: string) {
  const podSpec = existing.spec || {}
  const spec: Record<string, any> = {
    ...podSpec,
    ...(restartPolicy ? { restartPolicy } : {}),
    containers: mergedContainers(podSpec.containers),
  }
  const initContainers = mergedContainers(podSpec.initContainers, 'init')
  if (initContainers.length) spec.initContainers = initContainers
  else delete spec.initContainers
  if (form.pod.volumes.length || podSpec.volumes) spec.volumes = buildPodVolumes(form.pod.volumes)
  else delete spec.volumes
  if (form.pod.imagePullSecrets.length) spec.imagePullSecrets = form.pod.imagePullSecrets.map((name: string) => ({ name }))
  else delete spec.imagePullSecrets
  const nodeSelector = pairs(form.pod.nodeSelector)
  if (Object.keys(nodeSelector).length) spec.nodeSelector = nodeSelector
  else delete spec.nodeSelector
  const tolerations = toToleration(form.pod.tolerations)
  if (tolerations.length) spec.tolerations = tolerations
  else delete spec.tolerations
  const affinity = buildAffinity(form.pod)
  if (affinity) spec.affinity = affinity
  else delete spec.affinity
  if (form.pod.hostNetwork) spec.hostNetwork = true
  else delete spec.hostNetwork
  return {
    ...existing,
    metadata: { ...existing.metadata, labels: { ...existing.metadata?.labels, app: form.name, ...pairs(form.labels) } },
    spec,
  }
}
function buildResource(): KubeResource {
  const base: KubeResource = rawResource.value
    ? (JSON.parse(JSON.stringify(rawResource.value)) as KubeResource)
    : {
        apiVersion: config.value.group ? `${config.value.group}/${config.value.version}` : config.value.version,
        kind: config.value.kind,
        metadata: { name: form.name, namespace: contextNamespace.value },
      }
  base.apiVersion = config.value.group ? `${config.value.group}/${config.value.version}` : config.value.version
  base.kind = config.value.kind
  base.metadata = {
    ...base.metadata,
    name: form.name,
    namespace: contextNamespace.value,
    labels: isEdit.value ? pairs(form.labels) : { ...base.metadata.labels, ...pairs(form.labels) },
  }
  if (isNetwork.value) {
    base.spec = mergeNetworkPolicySpec((base.spec || {}) as Record<string, any>, form.network)
  } else if (isWorkload.value) {
    const spec = (base.spec || {}) as Record<string, any>
    if (config.value.key === 'cronjobs') {
      const jobTemplate = spec.jobTemplate || {}
      const jobSpec: Record<string, any> = { ...jobTemplate.spec, template: podTemplate(jobTemplate.spec?.template, 'OnFailure') }
      for (const [key, value] of [
        ['completions', form.pod.jobCompletions],
        ['parallelism', form.pod.jobParallelism],
        ['backoffLimit', form.pod.jobBackoffLimit],
        ['activeDeadlineSeconds', form.pod.jobActiveDeadlineSeconds],
      ] as const) {
        if (value !== undefined && value !== null) jobSpec[key] = value
        else delete jobSpec[key]
      }
      base.spec = {
        ...spec,
        schedule: form.schedule,
        concurrencyPolicy: form.pod.cronConcurrencyPolicy,
        suspend: form.pod.cronSuspend,
        successfulJobsHistoryLimit: form.pod.cronSuccessfulHistoryLimit,
        failedJobsHistoryLimit: form.pod.cronFailedHistoryLimit,
        jobTemplate: { ...jobTemplate, spec: jobSpec },
      }
    } else if (config.value.key === 'jobs') {
      const jobSpec: Record<string, any> = {
        ...spec,
        template: podTemplate(spec.template, 'Never'),
      }
      for (const [key, value] of [
        ['completions', form.pod.jobCompletions],
        ['parallelism', form.pod.jobParallelism],
        ['backoffLimit', form.pod.jobBackoffLimit],
        ['activeDeadlineSeconds', form.pod.jobActiveDeadlineSeconds],
      ] as const) {
        if (value !== undefined && value !== null) jobSpec[key] = value
        else delete jobSpec[key]
      }
      base.spec = jobSpec
    } else {
      const workloadSpec: Record<string, any> = {
        ...spec,
        ...(isScalable.value ? { replicas: form.replicas } : {}),
        selector: { ...spec.selector, matchLabels: { ...spec.selector?.matchLabels, app: form.name } },
        template: podTemplate(spec.template),
      }
      if (config.value.key === 'deployments') {
        workloadSpec.strategy =
          form.pod.strategyType === 'Recreate'
            ? { type: 'Recreate' }
            : {
                type: 'RollingUpdate',
                rollingUpdate: { maxUnavailable: form.pod.maxUnavailable, maxSurge: form.pod.maxSurge },
              }
      }
      if (config.value.key === 'statefulsets') {
        workloadSpec.volumeClaimTemplates = form.pod.volumeClaimTemplates
          .filter((template: VolumeClaimTemplateForm) => template.name)
          .map((template: VolumeClaimTemplateForm) => ({
            apiVersion: 'v1',
            kind: 'PersistentVolumeClaim',
            metadata: { name: template.name },
            spec: {
              accessModes: [template.accessMode],
              storageClassName: template.storageClassName || undefined,
              resources: { requests: { storage: template.storage } },
            },
          }))
        workloadSpec.updateStrategy =
          form.pod.updateType === 'OnDelete'
            ? { type: 'OnDelete' }
            : { type: 'RollingUpdate', rollingUpdate: { partition: form.pod.partition } }
      }
      if (config.value.key === 'daemonsets') {
        workloadSpec.updateStrategy =
          form.pod.updateType === 'OnDelete'
            ? { type: 'OnDelete' }
            : { type: 'RollingUpdate', rollingUpdate: { maxUnavailable: form.pod.maxUnavailable } }
      }
      base.spec = workloadSpec
    }
  } else if (config.value.key === 'configmaps') base.data = pairs(form.data)
  else if (config.value.key === 'secrets') {
    const existingData = (base.data || {}) as Record<string, string>
    base.type = form.secretType
    if (form.secretType === 'kubernetes.io/tls') {
      base.stringData = {
        ...(form.tlsCrt ? { 'tls.crt': form.tlsCrt } : {}),
        ...(form.tlsKey ? { 'tls.key': form.tlsKey } : {}),
      }
    } else if (form.secretType === 'kubernetes.io/dockerconfigjson') {
      if (form.registryUsername || form.registryPassword) {
        const server = form.registryServer.trim() || 'https://index.docker.io/v1/'
        base.stringData = {
          '.dockerconfigjson': JSON.stringify({
            auths: {
              [server]: {
                username: form.registryUsername,
                password: form.registryPassword,
                email: form.registryEmail || undefined,
                auth: btoa(`${form.registryUsername}:${form.registryPassword}`),
              },
            },
          }),
        }
      }
    } else {
      const desiredKeys = new Set(form.data.filter((item: KeyValue) => item.key).map((item: KeyValue) => item.key))
      base.data = Object.fromEntries(Object.entries(existingData).filter(([key]) => desiredKeys.has(key)))
      base.stringData = Object.fromEntries(
        form.data
          .filter((item: KeyValue) => item.key && (!Object.hasOwn(existingData, item.key) || item.value !== ''))
          .map((item: KeyValue) => [item.key, item.value]),
      )
    }
  } else if (config.value.key === 'services') {
    base.spec = mergeServiceSpec((base.spec || {}) as Record<string, any>, {
      type: form.serviceType,
      ports: form.servicePorts,
      selector: pairs(form.serviceSelector),
      editing: isEdit.value,
      headless: form.serviceHeadless,
      externalIPs: form.serviceExternalIps
        .split(',')
        .map((ip: string) => ip.trim())
        .filter(Boolean),
      sessionAffinity: form.serviceSessionAffinity,
      sessionAffinitySeconds: form.serviceSessionAffinitySeconds,
      externalName: form.serviceExternalName,
    })
  } else if (config.value.key === 'ingresses') {
    base.spec = mergeIngressSpec((base.spec || {}) as Record<string, any>, {
      className: form.ingressClass,
      rules: form.ingressRules,
      tls: form.ingressTls,
      editing: isEdit.value,
    })
  } else if (config.value.key === 'persistentvolumeclaims')
    base.spec = {
      ...base.spec,
      accessModes: [form.accessMode],
      storageClassName: form.storageClass,
      resources: { requests: { storage: form.storage } },
    }
  else if (config.value.key === 'PrometheusRule') {
    const spec = (base.spec || {}) as Record<string, any>
    const groups = spec.groups || []
    const group = groups[0] || {}
    const rules = group.rules || []
    base.spec = {
      ...spec,
      groups: [
        {
          ...group,
          name: form.ruleGroup,
          rules: [
            {
              ...rules[0],
              alert: form.alertName,
              expr: form.expression,
              for: form.duration,
              labels: { ...rules[0]?.labels, severity: form.severity },
            },
            ...rules.slice(1),
          ],
        },
        ...groups.slice(1),
      ],
    }
  } else if (config.value.key === 'AlertmanagerConfig') {
    const spec = (base.spec || {}) as Record<string, any>
    const receivers = Array.isArray(spec.receivers) ? spec.receivers : []
    const receiverName = form.receiver.trim() || form.name
    const owner = [scope.tenant, scope.project, form.name].filter(Boolean).join('-')
    const receiver: Record<string, any> = { ...receivers[0], name: receiverName }
    delete receiver.wechatConfigs
    delete receiver.webhookConfigs
    delete receiver.emailConfigs
    for (const channel of form.receivers) {
      const payload = alertReceiverToKube(channel)
      if (channel.type === 'wechat') {
        if (!channel.toUser && !channel.toParty && !channel.toTag) continue
        ;(receiver.wechatConfigs ||= []).push(payload)
      } else if (channel.type === 'email') {
        if (!channel.to) continue
        ;(receiver.emailConfigs ||= []).push(payload)
      } else {
        if (!channel.url) continue
        ;(receiver.webhookConfigs ||= []).push(payload)
      }
    }
    base.metadata.labels = { ...base.metadata.labels, 'kubecube.io/owner': owner }
    base.spec = {
      ...spec,
      route: {
        ...spec.route,
        receiver: receiverName,
        groupBy: form.groupBy
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean),
        ...(form.groupWait.trim() ? { groupWait: form.groupWait.trim() } : {}),
        ...(form.groupInterval.trim() ? { groupInterval: form.groupInterval.trim() } : {}),
        ...(form.repeatInterval.trim() ? { repeatInterval: form.repeatInterval.trim() } : {}),
        matchers:
          Array.isArray(spec.route?.matchers) && spec.route.matchers.length
            ? spec.route.matchers
            : [{ name: 'kubecube_io_owner', value: owner }],
      },
      receivers: [receiver, ...receivers.slice(1)],
    }
  } else if (config.value.key === 'logconfigs') {
    const spec = (base.spec || {}) as Record<string, any>
    const { type: _legacyType, path: _legacyPath, ...rest } = spec
    const inputs = Array.isArray(spec.inputs) ? spec.inputs : []
    const first = inputs[0] || {
      name: form.name,
      containerName: '',
      matchFields: {},
      fields: {},
      multiline: { active: false, pattern: '' },
      ignoreOlder: '0h',
      excludeFiles: [],
      cleanLogs: { retainDays: 0 },
    }
    const paths = form.logType === 'dockerStdout' ? ['stdout'] : [form.logPath.trim() || '/var/log/containers']
    base.spec = {
      ...rest,
      name: form.name,
      cluster: contextCluster.value,
      namespace: contextNamespace.value,
      labelSelector: pairs(form.logLabelSelector),
      inputs: [
        {
          ...first,
          name: first.name || form.name,
          paths,
          containerName: form.logContainerName,
          fields: pairs(form.logFields),
          multiline: { active: form.logMultiline, pattern: form.logMultilinePattern },
          ignoreOlder: form.logIgnoreOlder,
          excludeFiles: form.logExcludeFiles
            .split(',')
            .map((item: string) => item.trim())
            .filter(Boolean),
          cleanLogs: { retainDays: form.logRetainDays },
        },
        ...inputs.slice(1),
      ],
    }
  }
  return base
}
const previewYaml = computed(() => toYAML(buildResource()))
watch(
  () => ({ ...form }),
  () => {
    if (loaded.value) dirty.value = true
  },
  { deep: true },
)
watch(mode, (value) => {
  if (value === 'yaml') yamlContent.value = previewYaml.value
})
function validateName() {
  nameError.value = !form.name
    ? '请输入资源名称'
    : !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(form.name)
      ? '仅支持小写字母、数字和中划线，且不能以中划线开头或结尾'
      : ''
  return !nameError.value
}
async function nextStep() {
  if (currentStep.value === 0 && !validateName()) return
  if (currentStep.value === 1 && isWorkload.value && form.containers.some((item: ContainerForm) => !item.name || !item.image)) {
    ElMessage.warning('请完整填写容器名称和镜像')
    return
  }
  currentStep.value++
}
function addContainer(kind: 'normal' | 'init' = 'normal') {
  form.containers.push(newContainer(form.containers.length + 1, kind))
  activeContainer.value = String(form.containers.length - 1)
}
function removeContainer(name: string | number) {
  const index = Number(name)
  const container = form.containers[index]
  if (!container) return
  if (container.kind === 'normal' && form.containers.filter((item: ContainerForm) => item.kind === 'normal').length === 1) return
  form.containers.splice(index, 1)
  activeContainer.value = '0'
}
function fillForm(resource: KubeResource) {
  rawResource.value = resource
  form.name = resource.metadata.name
  nameError.value = ''
  form.labels = Object.entries(resource.metadata.labels || {}).map(([key, value]) => ({ key, value }))
  if (!form.labels.length) form.labels = [{ key: 'app', value: form.name }]
  const spec = resource.spec as Record<string, any> | undefined
  if (isNetwork.value) form.network = networkPolicyToForm(spec)
  form.replicas = Number(spec?.replicas || 1)
  form.schedule = spec?.schedule || form.schedule
  const podSpec = spec?.template?.spec || spec?.jobTemplate?.spec?.template?.spec || undefined
  const containers = podSpec?.containers
  const initContainers = podSpec?.initContainers || []
  if (containers)
    form.containers = [...containers, ...initContainers].map((item: Record<string, any>, index: number) =>
      containerToForm(item, index < containers.length ? 'normal' : 'init'),
    )
  form.pod = podFormFromSpec(podSpec, spec, config.value.key)
  if (config.value.key === 'secrets') {
    const entries = new Map(Object.keys(resource.data || {}).map((key) => [key, '']))
    Object.entries((resource.stringData || {}) as Record<string, string>).forEach(([key, value]) => entries.set(key, value))
    form.data = [...entries].map(([key, value]) => ({ key, value }))
  } else form.data = Object.entries((resource.data || {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  form.secretType = String(resource.type || 'Opaque')
  const stringData = (resource.stringData || {}) as Record<string, string>
  form.tlsCrt = stringData['tls.crt'] || decodeBase64(resource.data?.['tls.crt'])
  form.tlsKey = stringData['tls.key'] || decodeBase64(resource.data?.['tls.key'])
  const dockerConfig = stringData['.dockerconfigjson'] || decodeBase64(resource.data?.['.dockerconfigjson'])
  if (dockerConfig) {
    try {
      const parsed = JSON.parse(dockerConfig) as { auths?: Record<string, Record<string, string>> }
      const [server, auth] = Object.entries(parsed.auths || {})[0] || []
      if (server && auth) {
        form.registryServer = server
        form.registryUsername = auth.username || ''
        form.registryPassword = auth.password || ''
        form.registryEmail = auth.email || ''
      }
    } catch {
      form.registryServer = 'https://index.docker.io/v1/'
    }
  }
  form.serviceType = String(spec?.type || 'ClusterIP')
  form.serviceTarget = ''
  form.serviceExternalName = String(spec?.externalName || '')
  form.serviceSelector = Object.entries((spec?.selector || {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  form.servicePorts = (Array.isArray(spec?.ports) ? spec.ports : []).map((port: Record<string, any>) => ({
    name: String(port.name || ''),
    port: Number(port.port || 80),
    targetPort: Number(port.targetPort || port.port || 8080),
    protocol: port.protocol || 'TCP',
    nodePort: port.nodePort ? Number(port.nodePort) : undefined,
  }))
  form.serviceHeadless = spec?.clusterIP === 'None'
  form.serviceExternalIps = (Array.isArray(spec?.externalIPs) ? spec.externalIPs : []).join(', ')
  form.serviceSessionAffinity = spec?.sessionAffinity === 'ClientIP' ? 'ClientIP' : 'None'
  form.serviceSessionAffinitySeconds = Number(spec?.sessionAffinityConfig?.clientIP?.timeoutSeconds ?? 10800)
  form.ingressClass = spec?.ingressClassName || 'nginx'
  form.ingressRules = (Array.isArray(spec?.rules) ? spec.rules : []).map((rule: Record<string, any>) => ({
    host: String(rule.host || ''),
    paths: (Array.isArray(rule.http?.paths) ? rule.http.paths : []).map((path: Record<string, any>) => ({
      path: String(path.path || '/'),
      pathType: path.pathType || 'Prefix',
      serviceName: String(path.backend?.service?.name || ''),
      servicePort: Number(path.backend?.service?.port?.number || path.backend?.service?.port?.name || 80),
    })),
  }))
  form.ingressTls = (Array.isArray(spec?.tls) ? spec.tls : []).map((entry: Record<string, any>) => ({
    hosts: (entry.hosts || []).join(', '),
    secretName: String(entry.secretName || ''),
  }))
  form.storage = spec?.resources?.requests?.storage || '10Gi'
  form.storageClass = spec?.storageClassName || ''
  form.accessMode = spec?.accessModes?.[0] || 'ReadWriteOnce'
  form.storageClass = spec?.storageClassName || ''
  form.accessMode = spec?.accessModes?.[0] || 'ReadWriteOnce'
  const firstRule = spec?.groups?.[0]?.rules?.[0]
  form.ruleGroup = spec?.groups?.[0]?.name || form.ruleGroup
  form.alertName = firstRule?.alert || form.alertName
  form.expression = firstRule?.expr || form.expression
  form.duration = firstRule?.for || form.duration
  form.severity = firstRule?.labels?.severity || form.severity
  form.receiver = spec?.route?.receiver || spec?.receivers?.[0]?.name || form.receiver
  form.groupBy = (spec?.route?.groupBy || []).join(', ') || form.groupBy
  form.groupWait = String(spec?.route?.groupWait || form.groupWait)
  form.groupInterval = String(spec?.route?.groupInterval || form.groupInterval)
  form.repeatInterval = String(spec?.route?.repeatInterval || form.repeatInterval)
  const rawReceiver = spec?.receivers?.[0] || {}
  form.receivers = [
    ...(rawReceiver.wechatConfigs || []).map((config: Record<string, any>) => ({
      ...newAlertReceiver('wechat'),
      type: 'wechat' as const,
      sendResolved: Boolean(config.sendResolved),
      toUser: String(config.toUser || ''),
      toParty: String(config.toParty || ''),
      toTag: String(config.toTag || ''),
      apiURL: String(config.apiURL || ''),
      corpID: String(config.corpID || ''),
      agentID: String(config.agentID || ''),
      secretName: String(config.apiSecret?.name || ''),
      secretKey: String(config.apiSecret?.key || ''),
    })),
    ...(rawReceiver.emailConfigs || []).map((config: Record<string, any>) => ({
      ...newAlertReceiver('email'),
      type: 'email' as const,
      sendResolved: Boolean(config.sendResolved),
      to: String(config.to || ''),
      from: String(config.from || ''),
      smarthost: String(config.smarthost || ''),
      authUsername: String(config.authUsername || ''),
      authPassword: String(config.authPassword || ''),
      secretName: String(config.authSecret?.name || ''),
      secretKey: String(config.authSecret?.key || ''),
    })),
    ...(rawReceiver.webhookConfigs || []).map((config: Record<string, any>) => ({
      ...newAlertReceiver('webhook'),
      type: 'webhook' as const,
      sendResolved: Boolean(config.sendResolved),
      url: String(config.url || ''),
      maxAlerts: Number(config.maxAlerts || 0),
    })),
  ]
  form.logType = spec?.type || spec?.inputs?.[0]?.type || form.logType
  form.logPath = spec?.path || spec?.inputs?.[0]?.paths?.[0] || form.logPath
  const logInput = spec?.inputs?.[0] || {}
  form.logLabelSelector = Object.entries((spec?.labelSelector || {}) as Record<string, string>).map(([key, value]) => ({
    key,
    value,
  }))
  form.logContainerName = String(logInput.containerName || '')
  form.logIgnoreOlder = String(logInput.ignoreOlder || '0h')
  form.logRetainDays = Number(logInput.cleanLogs?.retainDays || 0)
  form.logExcludeFiles = (logInput.excludeFiles || []).join(', ')
  form.logMultiline = Boolean(logInput.multiline?.active)
  form.logMultilinePattern = String(logInput.multiline?.pattern || '')
  form.logFields = Object.entries((logInput.fields || {}) as Record<string, string>).map(([key, value]) => ({ key, value }))
  yamlContent.value = toYAML(resource)
}
onMounted(async () => {
  if (isEdit.value) {
    const resource = await resourceApi.get(config.value, {
      cluster: contextCluster.value,
      namespace: contextNamespace.value,
      name: String(route.params.instance),
    })
    fillForm(resource)
  } else {
    form.name = isNetwork.value ? 'default-policy' : 'example-app'
    form.labels[0]!.value = form.name
    yamlContent.value = previewYaml.value
  }
  if (config.value.key === 'services') await loadServiceWorkloads()
  await nextTick()
  loaded.value = true
  dirty.value = false
})
async function submit() {
  if (isUpdateImage.value) {
    submitting.value = true
    try {
      await resourceApi.patch(
        config.value,
        { cluster: contextCluster.value, namespace: contextNamespace.value, name: String(route.params.instance) },
        {
          spec: {
            template: {
              spec: {
                containers: containersWithUpdatedImages(
                  (rawResource.value?.spec as Record<string, any> | undefined)?.template?.spec?.containers || [],
                ),
              },
            },
          },
        },
      )
      ElMessage.success('滚动更新已触发')
      dirty.value = false
      router.push({ path: `/control/${config.value.key}/${String(route.params.instance)}/info`, query: scope.query })
    } finally {
      submitting.value = false
    }
    return
  }
  if (mode.value === 'guided' && !validateName()) {
    currentStep.value = 0
    return
  }
  submitting.value = true
  yamlError.value = ''
  try {
    const resource = mode.value === 'yaml' ? fromYAML<KubeResource>(yamlContent.value) : buildResource()
    if (mode.value === 'yaml') {
      const error = validateYAML(yamlContent.value)
      if (error) throw new Error(error)
    }
    const context = {
      cluster: contextCluster.value,
      namespace: contextNamespace.value,
      name: String(route.params.instance || resource.metadata.name),
    }
    if (isEdit.value) await resourceApi.replace(config.value, context, resource)
    else await resourceApi.create(config.value, context, resource)
    ElMessage.success(isEdit.value ? '资源配置已保存并应用' : `${resource.metadata.name} 创建成功`)
    dirty.value = false
    if (isNetwork.value) router.push(`/platform/cluster/${contextCluster.value}/network`)
    else router.push({ path: `/control/${config.value.key}/${resource.metadata.name}/info`, query: scope.query })
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && mode.value === 'yaml')) yamlError.value = error.message
  } finally {
    submitting.value = false
  }
}
onBeforeRouteLeave(async () => {
  if (!dirty.value || submitting.value) return true
  try {
    await ElMessageBox.confirm('当前页面有未保存的修改，确定离开吗？', '未保存的修改', {
      type: 'warning',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
    })
    return true
  } catch {
    return false
  }
})
</script>
<style scoped>
.editor-page {
  max-width: 1240px;
}
.editor-mode {
  display: flex;
  padding: 18px 24px;
  align-items: center;
  gap: 24px;
}
.editor-steps {
  flex: 1;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.section-heading h2 {
  font-size: 16px;
}
.section-heading p {
  margin-top: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}
.heading-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.service-port-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 100px 100px 90px 110px 32px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.ingress-rule-card {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-muted);
}
.ingress-rule-head {
  display: grid;
  grid-template-columns: 1fr 32px;
  align-items: center;
  gap: 10px;
}
.ingress-path-row {
  display: grid;
  grid-template-columns: 120px 160px minmax(130px, 1fr) 100px 32px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.ingress-tls-row {
  display: grid;
  grid-template-columns: 1fr 240px 32px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
@media (max-width: 900px) {
  .service-port-row,
  .ingress-path-row,
  .ingress-tls-row {
    grid-template-columns: 1fr;
  }
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
}
.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 12px;
  color: var(--text-regular);
  font-size: 13px;
  font-weight: 500;
}
.key-value-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr 36px;
  gap: 10px;
  margin-bottom: 10px;
}
.data-row {
  display: grid;
  grid-template-columns: minmax(160px, 0.6fr) minmax(240px, 1.4fr) 36px;
  gap: 10px;
  margin-bottom: 12px;
}
.tls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.tls-grid label {
  display: grid;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.tls-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.alert-channel-card {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-muted);
}
.alert-channel-head {
  display: grid;
  grid-template-columns: 180px 1fr 32px;
  align-items: center;
  gap: 14px;
}
.inline-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}
.registry-help {
  grid-column: 1 / -1;
}
.image-row {
  display: grid;
  grid-template-columns: minmax(180px, 0.6fr) minmax(280px, 1.4fr);
  gap: 16px;
  margin-top: 16px;
}
.editor-navigation {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.yaml-error {
  margin-top: 12px;
}
@media (max-width: 768px) {
  .editor-mode {
    align-items: stretch;
    flex-direction: column;
  }
  .form-grid,
  .image-row {
    grid-template-columns: 1fr;
  }
  .data-row {
    grid-template-columns: 1fr 36px;
  }
  .data-row > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
