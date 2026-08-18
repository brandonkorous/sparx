# CRM scheduled jobs

Four Kubernetes `CronJob` resources that POST to `/internal/crm/*` on api-rest. Each job runs once per day in a small `curlimages/curl` container and is the production wiring for the schedulers under [wizeworks/packages/crm/src/schedulers/](../../packages/crm/src/schedulers/).

| CronJob                   | Schedule    | Endpoint                                 | Why this time                              |
| ------------------------- | ----------- | ---------------------------------------- | ------------------------------------------ |
| `crm-partition-rollover`  | `0 2 * * *` | `POST /internal/crm/partition-rollover`  | Earliest — keeps `crm_activities` writable |
| `crm-automation-triggers` | `0 3 * * *` | `POST /internal/crm/automation-triggers` | After partition is guaranteed              |
| `crm-overdue-reminders`   | `0 4 * * *` | `POST /internal/crm/overdue-reminders`   | Mid-morning UTC ≈ early US workday         |
| `crm-segment-recompute`   | `0 5 * * *` | `POST /internal/crm/segment-recompute`   | Latest — heaviest, runs after the rest     |

## Commerce scheduled jobs

Wiring for the schedulers under [wizeworks/packages/commerce/src/schedulers/](../../packages/commerce/src/schedulers/).

| CronJob                            | Schedule      | Endpoint                                          | Why this time                                            |
| ---------------------------------- | ------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `commerce-reservation-reaper`      | `*/1 * * * *` | `POST /internal/commerce/reservation-reaper`      | Every minute — a stuck cart reservation holds stock      |
| `commerce-revenue-rollup`          | `0 6 * * *`   | `POST /internal/commerce/revenue-rollup`          | Nightly, after the day closes and the CRM jobs (docs/97) |
| `commerce-payment-reconcile-sweep` | `*/5 * * * *` | `POST /internal/commerce/payment-reconcile-sweep` | Every 5 min — heals rare orders stranded "Not paid"      |

`commerce-revenue-rollup` reconciles `rollup_commerce_daily_revenue` per active
tenant. It accepts an optional `?days=N` to widen the recomputed window for a
one-shot backfill (default 400 days). The read endpoint live-overlays "today",
so this job only keeps closed days correct.

`commerce-payment-reconcile-sweep` is the self-healing backstop for the
client-confirm payment race (BUG-002): a card `OrderPayment` left `pending` whose
gateway intent already `succeeded`. Unlike the two rollups it isn't a commerce
scheduler — it drives the api-rest payment reconciler
([lib/payment-webhook-reconcile.ts](../../services/api-rest/src/lib/payment-webhook-reconcile.ts),
`sweepStrandedCheckoutPayments`), because finishing the capture also sends the
tenant's order-confirmation email. Real-time capture at checkout-complete plus the
gateway webhook cover the common cases, so this only ever catches the rare
straggler both missed. Idempotent; a 2-minute grace window keeps it from touching
an in-flight completion.

## Invoicing scheduled jobs

Wiring for the invoicing schedulers under [wizeworks/packages/crm/src/schedulers/](../../packages/crm/src/schedulers/) (invoicing lives on the CRM customer spine, gated on its own `invoicing` module flag).

| CronJob                      | Schedule     | Endpoint                                    | Why this time                                          |
| ---------------------------- | ------------ | ------------------------------------------- | ------------------------------------------------------ |
| `invoicing-collected-rollup` | `30 6 * * *` | `POST /internal/invoicing/collected-rollup` | Nightly, after the commerce revenue rollup (06:00 UTC) |

`invoicing-collected-rollup` reconciles `rollup_invoicing_daily_collected` per
active tenant from the source-of-truth payments + finalized documents. Like the
commerce rollup it accepts an optional `?days=N` window override (default 400
days) and the read endpoint live-overlays "today", so this job only keeps closed
days correct.

## Dropship scheduled jobs

Wiring for the dropship reconcile, which lives on the commerce scheduler spine
([wizeworks/packages/commerce/src/schedulers/](../../packages/commerce/src/schedulers/)) —
`reportingService` owns the dropship margin/timeseries logic — but enumerates
the dropship-active tenant set, gated on its own `dropship` module flag.

| CronJob                  | Schedule    | Endpoint                                | Why this time                                                     |
| ------------------------ | ----------- | --------------------------------------- | ----------------------------------------------------------------- |
| `dropship-orders-rollup` | `0 7 * * *` | `POST /internal/dropship/orders-rollup` | Nightly, after the commerce (06:00) and invoicing (06:30) rollups |

`dropship-orders-rollup` reconciles `rollup_dropship_daily_orders` per
dropship-active tenant from the source-of-truth dropship orders + storefront
items (routed-order count, attributed revenue, supplier cost). Like the other
rollups it accepts an optional `?days=N` window override (default 400 days) and
the read endpoint live-overlays "today", so this job only keeps closed days
correct.

## Automation scheduled jobs

Wiring for the automation run-activity reconcile, which lives on the automation
engine's own scheduler spine
([wizeworks/packages/automation/src/schedulers/](../../packages/automation/src/schedulers/)).
Automations are a platform capability, not a gated module, so it enumerates
tenants that own ≥1 automation rather than a module-flag set.

| CronJob                  | Schedule    | Endpoint                                 | Why this time                                                                       |
| ------------------------ | ----------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `automation-runs-rollup` | `0 8 * * *` | `POST /internal/automations/runs-rollup` | Nightly, after the commerce (06:00), invoicing (06:30) and dropship (07:00) rollups |

`automation-runs-rollup` reconciles `rollup_automation_daily_runs` per tenant
that owns an automation from the source-of-truth `automation_runs` (runs
started + completed/failed/skipped counts, bucketed by `started_at`). Like the
other rollups it accepts an optional `?days=N` window override (default 400
days) and the read endpoint live-overlays "today", so this job only keeps
closed days correct.

All schedules are UTC. All endpoints are guarded by the
`X-Sparx-Internal-Cron-Token` shared secret, sourced from the
`sparx-app-secrets` Secret (key: `SPARX_INTERNAL_CRON_TOKEN`).

## Adding the secret

The CronJobs assume `sparx-app-secrets.SPARX_INTERNAL_CRON_TOKEN` is set.
If you bootstrap a fresh cluster:

```
openssl rand -hex 32 | \
  gcloud secrets create sparx-internal-cron-token --data-file=-
```

…then add `SPARX_INTERNAL_CRON_TOKEN` to the External Secrets / kustomize
mapping for `sparx-app-secrets`.

## Why CronJobs and not Cloud Scheduler

Cloud Scheduler would work too, but it would put authentication of an
in-cluster HTTP path behind a GCP-IAM concept (OIDC tokens) — which means
api-rest would have to verify Google-signed JWTs. The shared-secret
approach keeps the endpoint's trust boundary inside the cluster, which is
where it already lives (the route is `ClusterIP`-only).

## Applying

```
kubectl apply -k k8s/cronjobs/
```

…or it lands on a `components=all-platform` bootstrap run once it's
referenced by `.github/workflows/bootstrap.yml`.
