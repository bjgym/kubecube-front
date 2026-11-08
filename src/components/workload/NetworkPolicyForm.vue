<template>
  <div class="network-policy-form">
    <section class="policy-section">
      <div class="policy-heading">
        <div>
          <h3>策略类型</h3>
          <p>Ingress 控制进入 Pod 的流量，Egress 控制 Pod 发出的流量。</p>
        </div>
      </div>
      <el-checkbox-group v-model="model.policyTypes">
        <el-checkbox value="Ingress">Ingress</el-checkbox>
        <el-checkbox value="Egress">Egress</el-checkbox>
      </el-checkbox-group>
    </section>

    <section class="policy-section">
      <div class="policy-heading">
        <div>
          <h3>Pod 选择器</h3>
          <p>策略作用于匹配这些标签的 Pod；留空表示命名空间内所有 Pod。</p>
        </div>
        <el-button text type="primary" @click="model.podSelector.push({ key: '', value: '' })"
          ><el-icon><Plus /></el-icon>添加标签</el-button
        >
      </div>
      <div v-for="(selector, index) in model.podSelector" :key="index" class="pair-row">
        <el-input v-model="selector.key" placeholder="标签键，例如 app" />
        <el-input v-model="selector.value" placeholder="标签值，例如 shop-web" />
        <el-button text type="danger" aria-label="删除 Pod 选择器" @click="model.podSelector.splice(index, 1)"
          ><el-icon><Delete /></el-icon
        ></el-button>
      </div>
    </section>

    <section v-for="direction in directions" :key="direction.key" class="policy-section">
      <template v-if="model.policyTypes.includes(direction.policyType)">
        <div class="policy-heading">
          <div>
            <h3>{{ direction.title }} 规则</h3>
            <p>{{ direction.description }}</p>
          </div>
          <el-button text type="primary" @click="model[direction.key].push(newPolicyRule())"
            ><el-icon><Plus /></el-icon>添加 {{ direction.title }} 规则</el-button
          >
        </div>
        <div v-for="(rule, ruleIndex) in model[direction.key]" :key="ruleIndex" class="policy-rule">
          <div class="policy-rule-head">
            <strong>{{ direction.title }} 规则 {{ ruleIndex + 1 }}</strong>
            <el-button text type="danger" @click="model[direction.key].splice(ruleIndex, 1)">删除规则</el-button>
          </div>
          <div class="rule-columns">
            <div>
              <div class="inline-heading">
                <span>{{ direction.peerLabel }}</span>
                <el-button text type="primary" @click="rule.peers.push(newPeer())">添加{{ direction.peerLabel }}</el-button>
              </div>
              <div v-for="(peer, peerIndex) in rule.peers" :key="peerIndex" class="peer-row">
                <el-select v-model="peer.type">
                  <el-option label="Pod 标签" value="podSelector" />
                  <el-option label="命名空间标签" value="namespaceSelector" />
                  <el-option label="IP 段" value="ipBlock" />
                </el-select>
                <template v-if="peer.type === 'ipBlock'">
                  <el-input v-model="peer.cidr" placeholder="CIDR，例如 203.0.113.0/24" />
                  <el-input v-model="peer.except" placeholder="排除 CIDR，逗号分隔" />
                </template>
                <template v-else>
                  <el-input v-model="peer.labelKey" placeholder="标签键" />
                  <el-input v-model="peer.labelValue" placeholder="标签值" />
                </template>
                <el-button text type="danger" aria-label="删除来源" @click="rule.peers.splice(peerIndex, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
            </div>
            <div>
              <div class="inline-heading">
                <span>端口</span>
                <el-button text type="primary" @click="rule.ports.push({ protocol: 'TCP', port: '' })">添加端口</el-button>
              </div>
              <div v-for="(port, portIndex) in rule.ports" :key="portIndex" class="policy-port-row">
                <el-select v-model="port.protocol"><el-option value="TCP" /><el-option value="UDP" /><el-option value="SCTP" /></el-select
                ><el-input v-model="port.port" placeholder="端口或端口名" /><el-input-number
                  v-model="port.endPort"
                  :min="1"
                  :max="65535"
                  :controls="false"
                  placeholder="endPort"
                /><el-button text type="danger" aria-label="删除端口" @click="rule.ports.splice(portIndex, 1)"
                  ><el-icon><Delete /></el-icon
                ></el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
<script setup lang="ts">
import { Delete, Plus } from '@element-plus/icons-vue'
import { newPeer, newPolicyRule, type NetworkPolicyForm, type PolicyDirection } from '@/domain/network-policy'

const model = defineModel<NetworkPolicyForm>({ required: true })
const directions: Array<{
  key: PolicyDirection
  policyType: 'Ingress' | 'Egress'
  title: string
  description: string
  peerLabel: string
}> = [
  { key: 'ingress', policyType: 'Ingress', title: 'Ingress', description: '允许来自指定 peer、指定端口的流量。', peerLabel: '来源' },
  { key: 'egress', policyType: 'Egress', title: 'Egress', description: '允许发往目标 peer、目标端口的流量。', peerLabel: '目标' },
]
</script>
<style scoped>
.network-policy-form {
  display: grid;
  gap: 20px;
}
.policy-section {
  padding: 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-muted);
}
.policy-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.policy-heading h3 {
  font-size: 14px;
}
.policy-heading p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}
.pair-row,
.peer-row,
.policy-port-row {
  display: grid;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.pair-row {
  grid-template-columns: 1fr 1fr 32px;
}
.policy-rule {
  margin-top: 12px;
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  background: var(--surface-page);
}
.policy-rule-head,
.inline-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.policy-rule-head {
  margin-bottom: 12px;
}
.inline-heading {
  color: var(--text-secondary);
  font-size: 12px;
}
.rule-columns {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 22px;
}
.peer-row {
  grid-template-columns: 130px 1fr 1fr 32px;
}
.policy-port-row {
  grid-template-columns: 90px 1fr 100px 32px;
}
@media (max-width: 900px) {
  .rule-columns,
  .peer-row,
  .policy-port-row,
  .pair-row {
    grid-template-columns: 1fr;
  }
}
</style>
