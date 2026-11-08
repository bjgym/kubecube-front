import { describe, expect, it } from 'vitest'
import { buildAlertReceiver, newAlertReceiver } from '@/domain/alertmanager'

describe('Alertmanager receiver form', () => {
  it('groups WeCom, email and webhook channels into one receiver', () => {
    const wechat = newAlertReceiver('wechat')
    wechat.toUser = 'ops'
    wechat.secretName = 'wechat-secret'
    wechat.secretKey = 'token'
    const email = newAlertReceiver('email')
    email.to = 'ops@example.com'
    email.smarthost = 'smtp.example.com:465'
    email.authUsername = 'alert'
    email.authPassword = 'secret'
    const webhook = newAlertReceiver('webhook')
    webhook.url = 'https://hooks.example.com/alert'
    webhook.maxAlerts = 5
    expect(buildAlertReceiver([wechat, email, webhook], 'oncall', { extra: true })).toEqual({
      name: 'oncall',
      extra: true,
      wechatConfigs: [
        {
          sendResolved: true,
          toUser: 'ops',
          apiSecret: { name: 'wechat-secret', key: 'token' },
        },
      ],
      emailConfigs: [
        {
          sendResolved: true,
          to: 'ops@example.com',
          smarthost: 'smtp.example.com:465',
          authUsername: 'alert',
          authPassword: 'secret',
        },
      ],
      webhookConfigs: [{ sendResolved: true, url: 'https://hooks.example.com/alert', maxAlerts: 5 }],
    })
  })

  it('drops channels without a target and clears old channel arrays', () => {
    const wechat = newAlertReceiver('wechat')
    expect(buildAlertReceiver([wechat], 'oncall', { wechatConfigs: [{ toUser: 'old' }] })).toEqual({ name: 'oncall' })
  })
})
