---
name: new-workspace-package
description: Scaffold a new pnpm workspace package (@sparx/*) and wire it through every consumer so image builds don't break. Use when creating a new package under packages/ or a new service under services/, or when "module not found" / "does not provide an export" appears only in a Docker build. Encodes the Dockerfile COPY transitive-closure footgun and server-safe subpath rule.

The killer footgun: `tsc`, `lint`, and `typecheck` all pass locally, but the production image build fails because the new package was never COPY'd into a consumer's Dockerfile. This skill prevents that.
---

# Add a workspace package and wire it everywhere

## 1. Scaffold

Create `packages/<name>/` with `package.json` (`"name": "@sparx/<name>"`, `"type": "module"`), `tsconfig.json` extending [tsconfig.base.json](../../../tsconfig.base.json), and `src/index.ts`. Match an existing sibling package's shape exactly (e.g. `wizeworks/packages/events`).

- `declaration: false` is the house default — no `.d.ts` emit; consumers read source types via project references.
- If the package will be imported by a **backend service**, expose **server-safe subpaths** (e.g. `@sparx/<name>/serialize`) so React/client deps never get pulled into a Node service bundle. See how `@wizeworks/cms-editor/serialize` is used.

## 2. Add it as a dependency where used

`"@sparx/<name>": "workspace:*"` in each consumer's `package.json`, then `pnpm install`.

## 3. Wire EVERY consumer Dockerfile — the transitive closure

This is the step that local checks cannot catch. For each app/service that depends on the new package **directly or transitively**, add a `COPY` line for the package source in that Dockerfile's build stage.

```bash
# Find every consumer (direct dependents):
```
Grep for `@sparx/<name>` across `packages/*/package.json`, `apps/*/package.json`, `services/*/package.json`. Then for each consumer, follow ITS dependents too — a service that depends on a package that depends on `<name>` also needs the COPY line. Check each consumer's `Dockerfile` for the existing `COPY packages/...` block and add the new one alongside.

## 4. Verify the build, not just the types

`pnpm typecheck` passing is NOT sufficient proof. Before pushing, confirm at least one affected image builds, or be explicit in the PR that image builds are unverified. A missing COPY surfaces as an ESM `does not provide an export named X` crash at container boot — which has caused a prod outage before (the v0.65.0 api-rest incident).

## 5. Gate + push

```bash
pnpm format && pnpm lint && pnpm typecheck && pnpm build
```

Note: the pre-push hook validates files **on disk**, not the committed snapshot — an uncommitted-but-present export passes locally then crashes prod. Make sure everything is committed before relying on a green local gate.
