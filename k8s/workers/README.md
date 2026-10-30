# Background Workers

> **GCP-era.** On AKS the fleet is three Deployments (`event-worker`, `media-worker`, `import-worker`) in [../self-hosted/workers.yaml](../self-hosted/workers.yaml), and a new handler is a package under `wizeworks/packages/<name>-worker`, not a new Deployment (see [wizeworks/services/CLAUDE.md](../../wizeworks/services/CLAUDE.md)). A new event still needs its Pub/Sub topic in wize-infrastructure's `terraform/envs/prod/main.tf` (a pull request there; `pnpm check:events` and CI enforce the parity). The workflows named in "Adding a worker" below are deleted; [release.yml](../../.github/workflows/release.yml) builds and rolls every image.

Pub/Sub consumers — one Deployment per logical worker, one Pub/Sub subscription per topic-to-consumer pair. Naming convention: `<function>-worker` (matches `media-worker`, `email-worker`).

| Worker            | Subscribes to                         | Purpose                                          |
| ----------------- | ------------------------------------- | ------------------------------------------------ |
| `media-worker`    | `media.uploaded`                      | sharp variants + blurhash + dominant color       |
| `email-worker`    | `email.send`                          | Render MJML + Handlebars, relay through Postal   |
| `domain-worker`   | `domain.purchased`, `domain.verified` | CNAME validation + post-purchase DNS config      |
| `dropship-worker` | (cron + `dropship.sync`)              | Pull supplier catalog updates                    |
| `billing-worker`  | `stripe.webhook`                      | Process invoice paid / subscription updated      |
| `webhook-worker`  | `*` (subset)                          | Dispatch outbound webhooks to merchant endpoints |

## Pub/Sub subscriptions

Subscriptions are declared in Terraform alongside topics — see wize-infrastructure's [`terraform/envs/prod/main.tf`](https://github.com/wizeworksllc/wize-infrastructure/blob/main/terraform/envs/prod/main.tf) (`topics` map under the `pubsub` module). Adding a consumer is a one-line change there; the module generates `<topic>.<consumer>` subscriptions via `for_each`.

## Adding a worker

1. Copy `worker.example.yaml` to `<name>-worker.yaml`, replace every `REPLACE_NAME` and `REPLACE_TOPIC` placeholder.
2. Add the consumer to the relevant topic in wize-infrastructure's `terraform/envs/prod/main.tf`, as a pull request there, released by that repository.
3. Add `<name>-worker.yaml` to `kustomization.yaml`.
4. Add `<name>-worker` to the build-images matrix in `.github/workflows/build-images-gcp.yml`.
5. Add `<name>-worker` to the deploy-prod rollout loop in `.github/workflows/deploy-gcp.yml`.
6. Push to `main` → image builds → bootstrap apps/workers → deploy-prod rolls.
