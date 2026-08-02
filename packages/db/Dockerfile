# The migration + seed runner.
#
# THREE LINES OF METADATA ON A SHARED BASE. The workspace, its dependency
# closure and the generated Prisma client all live in Dockerfile.base, which is
# built once per release and shared by every Node service — so the node stores
# that tree once instead of once per image. Read Dockerfile.base for why (it is
# the difference between ~18 GB and well under 1 GB per release generation, and
# it is what stopped the single node running out of disk mid-rollout).
#
# NOT a Deployment. The release's data stage runs this as a Kubernetes Job:
# first with the entrypoint below (`prisma migrate deploy`, plus the hand-edited
# RLS SQL), then again with the command overridden to prisma/seed-platform.ts
# for the platform rows. Both connect as the OWNER role — see
# k8s/azure/jobs/db-seed-platform.yaml.
#
# `pnpm exec` is safe at runtime here because the base installs pnpm globally
# into /usr/local rather than preparing a root-owned corepack cache the runtime
# `node` user cannot read. That was the old failure mode: a cold start
# re-downloaded pnpm from the registry before it could run anything.
#
# ARG BASE is supplied by the release as the base image built from THIS commit.
# The default keeps a local `docker build -f packages/db/Dockerfile .` working.
ARG BASE=sparx-base:local
FROM ${BASE}

WORKDIR /app/packages/db

ENTRYPOINT ["pnpm", "exec", "tsx", "scripts/run-migrations.ts"]
