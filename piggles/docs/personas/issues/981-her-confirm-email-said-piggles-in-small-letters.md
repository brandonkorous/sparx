# 981 — Her confirm email said "piggles" in small letters

**Status:** confirmed
**Severity:** copy
**Found by:** P09 · The Marrow Review · act 10, reading her confirm email in the dev outbox ([980](980-dev-email-could-only-be-read-in-a-terminal.md))
**Surface:** every platform email rendered by the event worker, in dev
**Filed:** 2026-10-11
**Fixed:** 2026-10-11 (settings)
**Confirmed by:** P09 in the dev outbox, 2026-10-11
**Blocked on:** nothing

## What happened

The subject read "Confirm your piggles email".

## Why

`platformBrandIdentity` (`brand-core`) reads the brand's name from `PIGGLES_BRAND_NAME`
and falls back to the lowercase key. The event worker renders every queued email, and its
dev settings (`wizeworks/services/event-worker/.env`, `.env.example`) had no brand block;
api-rest's had one. Production is not affected: the cluster's app-env config map sets the
names for every service.

## The fix

- `event-worker/.env.example` and `.env`: `SPARX_BRAND_NAME`, `PIGGLES_BRAND_NAME`,
  `SPARX_ZONE_DOMAIN`, `PIGGLES_ZONE_DOMAIN`, as api-rest has them, with why.
- `scripts/check-service-env.mjs`, claim 4: a service that renders email (depends on
  `@wizeworks/email`, `@wizeworks/email-worker` or `@wizeworks/brand-core`) must set every
  brand's `*_BRAND_NAME` in its `.env.example`. Proved red with Piggles' line taken out
  ("renders email but its .env.example does not set PIGGLES_BRAND_NAME"), green restored.
  It reports how many services render email (2).

## Confirmed by

After Brandon restarted dev, Rosalind invited her sub-editor, Tomas Reyes, to her team.
The invitation in the dev outbox reads **"You're invited to join The Marrow Review on
Piggles"**, from **Piggles <noreply@sparx.email>**. Before, the From also read
"piggles". Reading that email found issue 989.
