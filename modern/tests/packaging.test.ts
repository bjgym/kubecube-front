import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (name: string) => readFileSync(resolve(process.cwd(), '..', name), 'utf8')

describe('container packaging contracts', () => {
  it('keeps the portable Dockerfile build and brand arguments aligned', () => {
    const dockerfile = read('Dockerfile')
    expect(dockerfile).toContain('FROM docker.io/library/node:24-alpine AS builder')
    expect(dockerfile).toContain('RUN npm ci --no-audit --no-fund')
    expect(dockerfile).toContain('RUN npm run build')
    expect(dockerfile).toContain('ARG KUBECUBE_BRAND_NAME=KubeCube')
    expect(dockerfile).toContain('ARG VITE_BRAND_NAME=KubeCube')
    expect(dockerfile).toContain('COPY --from=builder /app/public /usr/share/nginx/html/public')
  })

  it('builds the multi-arch image natively on BUILDPLATFORM', () => {
    const dockerfile = read('Dockerfile.multiarch')
    expect(dockerfile).toContain('ARG BUILDPLATFORM')
    expect(dockerfile).toContain('FROM --platform=$BUILDPLATFORM docker.io/library/node:24-alpine AS builder')
    expect(dockerfile).toContain('ARG KUBECUBE_BRAND_NAME=KubeCube')
    expect(dockerfile).toContain('ARG VITE_BRAND_NAME=KubeCube')
    expect(dockerfile).toContain('COPY --from=builder /app/public /usr/share/nginx/html/public')
    expect(dockerfile).toContain('FROM docker.io/library/nginx:1.27')
  })

  it('passes both brand arguments from the Makefile', () => {
    const makefile = read('Makefile')
    expect(makefile).toContain('KUBECUBE_BRAND_NAME')
    expect(makefile).toContain('VITE_BRAND_NAME')
    expect(makefile).toContain('Dockerfile.multiarch')
  })
})
