export interface AlertReceiverForm {
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

export function newAlertReceiver(type: AlertReceiverForm['type'] = 'wechat'): AlertReceiverForm {
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

export function alertReceiverToKube(channel: AlertReceiverForm): Record<string, unknown> {
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

export function buildAlertReceiver(channels: AlertReceiverForm[], name: string, existing: Record<string, any> = {}): Record<string, any> {
  const receiver: Record<string, any> = { ...existing, name }
  delete receiver.wechatConfigs
  delete receiver.webhookConfigs
  delete receiver.emailConfigs
  for (const channel of channels) {
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
  return receiver
}
