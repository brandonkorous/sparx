---
title: Conventions
type: map
status: active
---

# conventions

How we work — the process commitments. Mostly these **index** the binding rules in the root `CLAUDE.md`, `.githooks/`, and `.github/workflows/`, with the *why* attached so they're not just rules to obey but rules to understand.

## Building

- [[production-not-mvp]] — everything ships production-complete; nothing deferred.
- [[file-and-function-size]] — ≤250 lines/file, ≤50/function; cohesion over count; boy-scout.

## Shipping

- [[conventional-commits]] — commit messages drive the release bump.
- [[releases-are-automated]] — tags, not PRs; release.yml's `tag` job cuts it LAST, only if the release shipped.
- [[pre-push-guard]] — the local check that must be green before every push.

## Writing

- [[doc-style]] — version/author/date headers; the brain is the map over the docs.

## Sources of truth

Root `CLAUDE.md` · `.githooks/pre-push` · `.github/workflows/release.yml` · `eslint.config.js`.

_Note: operator **session** preferences (who runs commits, dev-lifecycle ownership) live in `.claude` memory, not here — this node is repo-durable process only._
