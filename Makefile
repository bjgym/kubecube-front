# Copyright 2021 The KubeCube Authors. All rights reserved.
# Use of this source code is governed by a Apache license
# that can be found in the LICENSE file.

# The bundle is built inside the image, so one docker build produces the image.
# The published tag carries a -multi suffix, which means buildx assembles the
# manifest from both architectures. The arm64 leg compiles node-sass, which
# needs a toolchain the builder does not carry; see the Dockerfile.
IMG ?= kubecube/frontend:dev
BRAND ?= Kubecube

image:
	docker build -t ${IMG} --build-arg KUBECUBE_BRAND_NAME="${BRAND}" .

image-multi-arch:
	docker buildx build -t ${IMG} --build-arg KUBECUBE_BRAND_NAME="${BRAND}" \
	  --platform=linux/amd64,linux/arm64 . --push
