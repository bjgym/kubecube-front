/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_BRAND_NAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
