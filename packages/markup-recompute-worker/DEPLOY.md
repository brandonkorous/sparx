# markup-recompute-worker — deploy notes

Cost-driven price recompute for catalog markup (docs/48 Phase 4). Subscribes to
`variant.cost.updated` (published by the commerce variant editor on a direct cost
edit, and by the dropship catalog sync on a supplier cost move). For each bound
variant it re-derives the list price from the markup rule and either auto-applies
it (within the rule's tolerance band) or stages it for human approval.

## Topology

```
variant cost edit ─┐                          ┌─ price.recomputed  (auto-applied)
                   ├─▶ variant.cost.updated ──▶│  + product.updated (reindex)
dropship sync ─────┘   (Pub/Sub topic)      worker
                                               └─ price.recompute.staged → review queue
```

- **Runtime:** Cloud Run (Pub/Sub PUSH), scale-to-zero. Same shape as
  `push-worker` / `email-worker`.
- **Terraform:** `module "markup_recompute_worker_cloudrun"` + the
  `sparx-markup-recompute-worker` runtime SA in
  `terraform/envs/prod/serverless.tf`; the `variant.cost.updated`,
  `price.recomputed`, and `price.recompute.staged` topics in
  `terraform/envs/prod/main.tf`.
- **Image:** built by `.github/workflows/build-images-gcp.yml` (matrix entry
  `markup-recompute-worker`) and rolled by the standard tag → deploy pipeline.

## Env

| Var                 | Required | Notes                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------- |
| `DATABASE_URL`      | prod     | Cloud SQL via the VPC connector (Secret Manager `database-url`).      |
| `GCP_PROJECT_ID`    | prod     | Set → publishes downstream events; unset → logging (no-op) publisher. |
| `PUBSUB_INVOKER_SA` | prod     | OIDC `email` claim the push subscription presents (defense in depth). |
| `PORT`              | no       | Cloud Run injects it (default 8080).                                  |

## Notes

- **Idempotent.** `recomputeBoundVariant` settles to the same state on replay, so
  a Pub/Sub redelivery (after a transient publish failure → HTTP 500) is safe.
- **No silent reprice on a spike.** A rule in `review` mode, or in `auto` mode
  when the price moves beyond `recomputeTolerancePct`, stages the change in
  `markup_recompute_reviews` instead of writing the price. The dashboard
  Price changes queue (`/commerce/price-reviews`) approves or rejects.
- **One pending proposal per variant** — a partial unique index enforces it; a
  re-trigger replaces the prior proposal in the same transaction.
- **Pure engine reuse.** Pricing math + the snapshot come from
  `@sparx/commerce-schemas` `priceVariantByRule`, the same function the catalog
  `markup-service` uses, so the two write paths never drift. The worker does NOT
  import `@sparx/commerce` (it carries React deps a backend must not pull).
