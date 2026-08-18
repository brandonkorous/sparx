# import-worker runtime image.
#
# THREE LINES OF METADATA ON A SHARED BASE. The workspace, its dependency
# closure and the generated Prisma client all live in Dockerfile.base, which is
# built once per release and shared by every Node service — so the node stores
# that tree once instead of once per image. Read Dockerfile.base for why (it is
# the difference between ~18 GB and well under 1 GB per release generation, and
# it is what stopped the single node running out of disk mid-rollout).
#
# This file used to hand-list its own workspace closure, from the Cloud Run era
# when it was built standalone. It fell ~30 packages behind while nothing built
# it — which is the same reason to stop hand-listing that every other service
# already acted on.
#
# ARG BASE is supplied by the release as the base image built from THIS commit.
# The default keeps a local `docker build -f wizeworks/services/import-worker/Dockerfile .` working.
ARG BASE=sparx-base:local
FROM ${BASE}

WORKDIR /app/wizeworks/services/import-worker

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "node", "--import", "tsx", "src/index.ts"]
