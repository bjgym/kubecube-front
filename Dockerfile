# Copyright 2021 The KubeCube Authors. All rights reserved.
# Use of this source code is governed by a Apache license
# that can be found in the LICENSE file.

# The bundle is produced inside the image. `public/` is a build output: it is
# not in the repository (config/vue.config.js sets outputDir to 'public'), so a
# single-stage Dockerfile that copies it can only be built on a machine that has
# already run `npm run build`.
#
# The builder stage is pinned to $BUILDPLATFORM so a multi-arch build (buildx)
# always runs node on the docker host's architecture: node-sass v4.14.1
# publishes a prebuilt binding for linux/amd64 only, and compiling it on arm64
# needs a Python 2 toolchain this image does not carry. The produced bundle is
# plain static files with no architecture of its own, so the final stage can
# safely be any platform's nginx. Build frontend images with buildx from an
# amd64 docker host; a native arm64 node build will fail.
FROM --platform=$BUILDPLATFORM node:12.18.0 AS builder

WORKDIR /app

# node-sass downloads its prebuilt binding from GitHub unless told otherwise.
# v4.14.1 publishes bindings for linux/amd64 only, so an arm64 build compiles
# node-sass instead and needs a Python 2 toolchain this image does not carry.
ARG SASS_BINARY_SITE=https://registry.npmmirror.com/-/binary/node-sass
ENV SASS_BINARY_SITE=${SASS_BINARY_SITE}

# Kept apart from the source copy so that a source-only change does not
# invalidate the dependency install.
COPY package.json .npmrc ./
RUN npm install --no-audit --no-fund

COPY . .

# Inlined into the bundle by DefinePlugin, see plugins/enhance-webpack.js.
ARG KUBECUBE_BRAND_NAME=Kubecube
ENV KUBECUBE_BRAND_NAME=${KUBECUBE_BRAND_NAME}

RUN npm run build

FROM nginx
COPY --from=builder /app/public /usr/share/nginx/html/public
