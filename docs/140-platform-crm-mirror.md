# 140 — Platform CRM mirror: every signup lands in sparx's own CRM

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-29

---

## 1. Why

sparx already runs itself as a tenant of record — the WizeWorks tenant (`wizeworks`), the
dogfood tenant of [80-marketing-attribution-analytics.md](80-marketing-attribution-analytics.md)
§2. The `/early` waitlist and the careers form on the marketing site already write into it.

The one thing that did **not** reach it was the most important one: a business signing up for
sparx. A signup created a tenant, a site, a subdomain, legal pages, a welcome email — and left no
trace in our own CRM. We were selling a CRM while tracking our own customers nowhere.

This document is how a signup becomes a contact and a deal on our own board, and how that deal
keeps up with the tenant afterwards. It is the same engine a customer of ours uses on their own
leads, which is the point: if the funnel view isn't good enough for us, it isn't good enough to
sell.

## 2. What lands in the CRM

On `tenant.created`, three rows appear in the platform tenant, scoped to its primary site:

| Row          | What it is                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contact**  | The person who signed up. Prospect, `lifecycleStage: lead`, `leadStatus: new`, company = their workspace name, tagged `tenant-signup` + `channel:<acquisition channel>`.        |
| **Deal**     | Their tenant, on the "Tenant Signups" pipeline at stage **Trial**. Title `<workspace name> (<slug>)`, expected close date = the trial's end date, value 0 until they subscribe. |
| **Activity** | An `account.created` entry on the timeline: what they signed up for, when the trial runs out, which channel they came in through.                                               |

**One contact per person, one deal per tenant** — deliberately different grains. The same person
can own more than one sparx tenant (an agency spinning up a second workspace), and each of those
is its own trial to win or lose. So the deal carries the tenant link (`metadata.sparxTenantId`)
and every lifecycle update targets the deal.

**A signup is not a marketing opt-in.** The mirror uses `customerService.captureLead` (prospect,
no `marketing` consent) — the same distinction `POST /v1/public/signup` draws for a tenant's own
storefront. Marketing email to these contacts needs its own opt-in, exactly as it would for
anyone else's customers.

## 3. The pipeline

`Tenant Signups` (`tenant-signups`), created on first use, editable like any other pipeline:

| #   | Stage             | Type | Meaning                                       |
| --- | ----------------- | ---- | --------------------------------------------- |
| 0   | **Trial**         | open | Signed up, nothing switched on yet            |
| 1   | **Activated**     | open | Turned a module on — building something real  |
| 2   | **Paying**        | won  | Platform subscription is active               |
| 3   | **Trial expired** | lost | Never converted — an activation problem       |
| 4   | **Churned**       | lost | Converted and then left — a retention problem |

Two lost stages, on purpose. "Never converted" and "converted then left" look the same in a single
Closed Lost column and are completely different problems to fix.

Stages are addressed by `sortOrder`, never by name, so renaming a stage on the board doesn't break
the mirror. This pipeline is **not** a `@sparx/crm-schemas` built-in: built-ins are seeded into
every tenant on CRM activation, and no customer of ours wants a pipeline modelling sparx's trials.

## 4. How a signup gets there

All three account-creation paths — email/password (`signUpMerchant`), Google OAuth
(`oauth-provisioning`), and invited-owner provisioning — already converge on
`publishTenantCreated`. Consuming `tenant.created` therefore covers every signup path, including
ones added later, without touching the signup transaction.

```
signUpMerchant / oauth / invited owner
        └── tenant.created ──▶ legal-seed-worker      (starter legal pages, docs/42)
                          └──▶ platform-crm-worker    (contact + deal, this doc)
```

Two independent push subscriptions on one topic: a CRM failure must not re-run legal seeding, and
each keeps its own retry and dead-letter behaviour.

The worker reads the tenant's own rows rather than trusting the event payload. That keeps owner
PII off the bus, makes a redelivered message reflect **current** state instead of a stale
snapshot, and lets the same code backfill tenants created before any of this existed (§7).

**Local dev.** There is no in-process twin. Point the publishers at the running worker with
`SPARX_DEV_WORKER_ROUTES` — in both api-rest's env and the workbench's, since `tenant.created` is
published from the workbench's signup action:

```
SPARX_DEV_WORKER_ROUTES=[{"url":"http://localhost:8093","events":["tenant.created","tenant.updated","tenant.subscription.changed","module.activated","module.deactivated"]}]
```

This exercises the same HTTP entry point Pub/Sub pushes to in production, which is better parity
than an in-process call — and it keeps the CRM service layer out of every app that can sign a
tenant up.

## 5. Lifecycle after signup

The deal is not a write-once record. Four more topics keep it current:

| Topic                         | Published by                   | Effect on the deal                                                    |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `tenant.updated`              | `PATCH /v1/tenant`             | Retitles the deal and updates the contact's company                   |
| `module.activated`            | module toggle (api-rest)       | Trial → **Activated**, plus a timeline note                           |
| `module.deactivated`          | module toggle (api-rest)       | Timeline note only                                                    |
| `tenant.subscription.changed` | the Stripe **billing** webhook | Moves the stage per the rules below, sets deal value to MRR, notes it |

`tenant.updated` matters more than it sounds: a workspace is born named "Sam's workspace" and
becomes the real business name during onboarding — which is exactly when a board that never
refreshes stops being readable.

**Stage rules** (`packages/platform-crm/src/lifecycle.ts`, unit-tested):

- **Never move backwards.** Stripe re-sends `customer.subscription.updated` for unrelated field
  changes, so a late `trialing` status must not drag an activated or paying tenant back to Trial.
- **Ending is only churn if they ever paid.** Cancel or pause from **Paying** → Churned; the same
  status from Trial or Activated → Trial expired.
- **Payment trouble is not a stage change.** `past_due` / `unpaid` tag the deal
  `payment-trouble` and write a timeline note; the tenant is still a customer through the dunning
  window. The tag is removed when payments recover.

`tenant.subscription.changed` is the tenant's **platform** bill. It is deliberately not one of the
`subscription.*` topics — those are a tenant's own customers' commerce subscriptions. Same word,
different customer. Its `mrrCents` is normalized to one month at the publisher, so an annual plan
reports its monthly equivalent and a board summing deal values isn't mixing yearly with monthly
figures.

## 6. Idempotency and failure

Every entry point re-derives the mirror before acting, so redelivery, a rename, and a backfill all
take the identical path:

- `captureLead` is idempotent on `(tenant, property, email)` and fills blanks rather than
  clobbering — a re-capture never overwrites what a human edited.
- The deal is found by `metadata.sparxTenantId` within the pipeline; a second `tenant.created`
  updates it instead of minting a duplicate.
- A lifecycle event for a tenant with no mirror yet **creates** it, then applies the change. A
  subscription webhook is never dropped for arriving first.

Failure model matches the other push workers: an unhandled topic acks (a redelivery would be
rejected identically); a transient DB error returns 500 and Pub/Sub redelivers up to 5 times
before dead-lettering.

**Skips are loud.** With no platform tenant resolved, or CRM disabled on it, the worker logs a
warning and acks rather than guessing a tenant — writing a signup into an arbitrary tenant's CRM
would be a cross-tenant leak. The worker also refuses to start if neither
`SPARX_PLATFORM_TENANT_ID` nor `SPARX_PLATFORM_TENANT_SLUG` is set, so a misconfigured deployment
fails visibly instead of silently skipping every signup.

## 7. Backfill

Tenants that existed before this shipped — plus anything published while the subscriptions didn't
exist yet, since a Pub/Sub subscription only receives what is published after it is created — get
onto the board through the `platform-crm-backfill` Cloud Run **job**:

Run it through the **Platform CRM Backfill** workflow — `workflow_dispatch` only, with a `mode`
input that defaults to `dry-run`:

```bash
gh workflow run platform-crm-backfill.yml -f mode=dry-run   # reports; writes nothing
gh workflow run platform-crm-backfill.yml -f mode=apply     # performs the backfill
```

Not a laptop command, for the same reason migrations aren't: the workflow authenticates via
Workload Identity Federation (no personal credentials), leaves a run record, and streams the
execution's logs into it. `apply` overrides the job's container args for that execution only, so
the dry-run-by-default stays in Terraform state and choosing `apply` never causes drift.

The job runs the `:latest` worker image — **ship the worker before backfilling**, or you are
backfilling with stale code.

**Why a job and not a `packages/db` backfill.** Cloud SQL is private-IP, so a backfill has to run
inside the VPC — which is exactly why the db-migrate Job exists and why `RUN_BACKFILL=true` lives
there. This one deliberately does not use that path: the db-migrate backfills run as the migration
OWNER doing raw data rewrites, while the mirror writes **through the CRM service layer under RLS**.
It must run as the same identity, on the same image, in the same runtime the worker uses in
production, or the backfill exercises a code path nobody ships. Reusing the worker's image also
keeps the CRM service layer out of the migration image.

It calls the mirror directly rather than replaying `tenant.created`, so each tenant lands in the
stage it actually belongs in — a tenant who already pays goes straight to Paying — instead of
replaying a signup that happened months ago. Idempotent: re-running updates the same contact and
deal rather than duplicating them.

## 8. Configuration

| Setting                      | Where                                            | Notes                                         |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `SPARX_PLATFORM_TENANT_ID`   | `var.platform_tenant_id` → the Cloud Run service | The immutable UUID; wins over the slug        |
| `SPARX_PLATFORM_TENANT_SLUG` | dev `.env` (`wizeworks`)                         | Dev default; the seed creates this tenant     |
| `DATABASE_URL`               | Secret Manager (`database-url-cloudrun`)         | Required — every message reads and writes     |
| Subscriptions                | `terraform/envs/prod/serverless.tf`              | One primary + four `additional_subscriptions` |
| Backfill job                 | `google_cloud_run_v2_job.platform_crm_backfill`  | Dry-run by default; `--apply` to write        |
| Backfill trigger             | `.github/workflows/platform-crm-backfill.yml`    | `workflow_dispatch`, `mode=dry-run \| apply`  |

## 9. Decisions

| ID  | Decision                                                                        | Why                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Consume `tenant.created` instead of calling the CRM from signup                 | Covers all three signup paths at once, keeps a cross-tenant write out of the request path, gets retries for free                                                                                    |
| D2  | A dedicated worker, not a second handler in `legal-seed-worker`                 | Independent retry and DLQ; a CRM failure must not re-run legal seeding. Scale-to-zero, so no meaningful cost                                                                                        |
| D3  | Hydrate from the tenant row, not the event payload                              | No owner PII on the bus; redelivery reflects current state; the backfill is the same code path                                                                                                      |
| D4  | `captureLead`, not `subscribe`                                                  | Signing up for a trial is not consent to marketing email                                                                                                                                            |
| D5  | Contact per person, deal per tenant                                             | One owner can hold several tenants, and each is its own trial to win                                                                                                                                |
| D6  | Two lost stages                                                                 | "Never converted" and "converted then left" are different problems; one Closed Lost column hides which                                                                                              |
| D7  | Pipeline lives in `@sparx/platform-crm`, not in the CRM built-ins               | Built-ins seed into every tenant; no customer wants a pipeline modelling sparx's own trials                                                                                                         |
| D8  | Dev parity via `SPARX_DEV_WORKER_ROUTES`, not an in-process twin                | Exercises the real HTTP entry point, and keeps the CRM service layer out of every app that can sign a tenant up                                                                                     |
| D9  | Backfill as a Cloud Run job on the worker's image, not a `packages/db` backfill | The mirror writes through the CRM service layer under RLS, so it must run as the worker's identity in the worker's runtime — the db-migrate backfills run as the migration owner doing raw rewrites |

## 10. Where the code lives

- [packages/platform-crm/](../packages/platform-crm/) — the mirror; `mirror.ts` orchestrates,
  `lifecycle.ts` holds the pure stage rules, `pipeline.ts` the board, `target.ts` resolves which
  tenant to write into.
- [services/platform-crm-worker/](../services/platform-crm-worker/) — the Cloud Run push entry
  point and the topic router, plus the backfill script.
- [terraform/envs/prod/serverless.tf](../terraform/envs/prod/serverless.tf) — the service, its
  service account, and the five subscriptions.
