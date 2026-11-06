# Copyright 2021 The KubeCube Authors. All rights reserved.
# Use of this source code is governed by a Apache license
# that can be found in the LICENSE file.

# The bundle is built inside the image, so one docker build produces the image.
# The published tag carries a -multi suffix, which means buildx assembles the
# manifest from both architectures. The static Vite bundle and the Node.js 24
# builder need no architecture-specific native compilation.
IMG ?= kubecube/frontend:dev
BRAND ?= Kubecube

image:
	docker build -t ${IMG} \
		--build-arg VITE_BRAND_NAME="${BRAND}" .

image-multi-arch:
	docker buildx build -f Dockerfile.multiarch -t ${IMG} \
		--build-arg VITE_BRAND_NAME="${BRAND}" \
		--platform=linux/amd64,linux/arm64 . --push
