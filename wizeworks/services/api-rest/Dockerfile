# api-rest runtime image.
#
# THREE LINES OF METADATA ON A SHARED BASE. The workspace, its dependency
# closure and the generated Prisma client all live in Dockerfile.base, which is
# built once per release and shared by every Node service — so the node stores
# that tree once instead of once per image. Read Dockerfile.base for why (it is
# the difference between ~18 GB and well under 1 GB per release generation, and
# it is what stopped the single node running out of disk mid-rollout).
#
# ARG BASE is supplied by the release as the base image built from THIS commit.
# The default keeps a local `docker build -f wizeworks/services/api-rest/Dockerfile .` working.
#
# Fastify; graceful shutdown on SIGTERM via the hook in src/index.ts.
ARG BASE=sparx-base:local
FROM ${BASE}

WORKDIR /app/wizeworks/services/api-rest

EXPOSE 3000

ENTRYPOINT ["node", "--import", "tsx", "src/index.ts"]
