import 'vue-router'
import type { ManagerRole } from './api'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    title?: string
    requiresManager?: boolean
    requiresRoles?: ManagerRole[]
    feature?: 'audit' | 'logseer' | 'kubecube-monitoring'
  }
}

export {}
