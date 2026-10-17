# Copyright 2021 The KubeCube Authors. All rights reserved.
# Use of this source code is governed by a Apache license
# that can be found in the LICENSE file.

# The bundle is produced inside the image. `public/` is a build output: it is
# not in the repository (config/vue.config.js sets outputDir to 'public'), so a
# single-stage Dockerfile that copies it can only be built on a machine that has
# already run `npm run build`.
#
# The builder stage is pinned to $BUILDPLATFORM so a multi-arch build (buildx)
# always runs node on the docker host's architecture. node-sass v4.14.1 publishes
# no prebuilt binding for linux/arm64, so an arm64 build compiles it from source
# instead — which was measured to work in this image and takes about four minutes
# on a four-core arm64 VM (node:12.18.0 carries the toolchain node-gyp needs;
# SASS_BINARY_SITE below has no arm64 binding to fetch, so the fallback is the
# source build). The produced bundle is plain static files with no architecture
# of its own, so the final stage can safely be any platform's nginx.
#
# Pinning to the build platform therefore stays: it keeps the common case (an
# amd64 docker host) from emulating node, and an arm64 host builds natively and
# only pays the compile once, in the image layer cache.
#
# It is declared, not merely used, and that is not decoration: an undeclared ARG
# is empty, an empty platform is a parse error, and the build fails before its
# first layer. buildx is the only caller that fills this variable in by itself —
# with the plain builder every build died on `failed to parse platform : "" is an
# invalid OS component`, so a caller using it has to pass the argument, as the
# offline bundle's builder does.
ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM node:12.18.0 AS builder

WORKDIR /app

# node-sass downloads its prebuilt binding unless told otherwise. There is none
# for linux/arm64, so an arm64 build compiles it; the site below is still worth
# setting because it makes the amd64 path independent of GitHub.
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

# Pinned: `nginx` on its own is whatever :latest happens to be that week, which
# is not something a release can reproduce.
FROM nginx:1.27
COPY --from=builder /app/public /usr/share/nginx/html/public
