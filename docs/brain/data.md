---
title: Data
type: map
status: active
---

# data

The persistence layer — Prisma against Cloud SQL Postgres, with RLS as the tenant backstop ([[rls-multi-tenancy]]).

## Notes

- [[prisma-schema]] — the split multi-file schema (277 models across 85 numbered files).
- [[customer-spine]] — one `Customer` table, three types; everything FKs into it.
- [[migration-pipeline]] — the Cloud-SQL pipeline + the FORCE-RLS backfill footgun.

## Sources of truth

`packages/db/prisma/schema/**` (85 numbered files) · `packages/db/CLAUDE.md` · `packages/db/src/tenant-context.ts` · the `db-migration` skill.
