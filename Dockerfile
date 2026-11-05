# Copyright 2021 The KubeCube Authors. All rights reserved.
# Use of this source code is governed by a Apache license
# that can be found in the LICENSE file.

FROM docker.io/library/node:24-alpine AS builder

WORKDIR /app/modern
COPY modern/package.json modern/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY modern ./
ARG KUBECUBE_BRAND_NAME=KubeCube
ARG VITE_BRAND_NAME=KubeCube
ENV KUBECUBE_BRAND_NAME=${KUBECUBE_BRAND_NAME}
ENV VITE_BRAND_NAME=${VITE_BRAND_NAME}
RUN npm run build

FROM docker.io/library/nginx:1.27
COPY --from=builder /app/public /usr/share/nginx/html/public
