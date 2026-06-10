# push-worker — deploy / provisioning

The Web Push code (docs/69 A-6) ships fully wired, but it won't deliver until the
VAPID keys + Cloud Run service are provisioned. These are the one-time manual
steps. Until they're done the feature **degrades gracefully**: the dashboard
toggle shows "not configured", and the worker (if deployed) acks every
`push.send` as a no-op.

## 1. Generate the VAPID key pair (once)

```bash
npx web-push generate-vapid-keys
# → Public Key:  B....   (safe to expose to browsers)
# → Private Key: x....   (secret — signs push requests)
```

## 2. Provision the keys

- **Public key** → `k8s/sparx-prod/app-env-configmap.yaml` `VAPID_PUBLIC_KEY`
  (the dashboard reads it at runtime). Re-apply: run the **Bootstrap** workflow
  with `components=app-env`.
- **Private key** → GCP Secret Manager as `vapid-private-key`, then add it to the
  secrets list:
  - `terraform/envs/prod/main.tf` → `module "secrets"` → `secret_ids` (add
    `"vapid-private-key"`).
  - `k8s/scripts/sync-secrets.ps1` → `$secretKeys` (add `"vapid-private-key"` →
    syncs to `VAPID_PRIVATE_KEY` in `sparx-app-secrets`).
  ```bash
  npx web-push generate-vapid-keys --json | jq -r .privateKey \
    | gcloud secrets create vapid-private-key --data-file=- --project=sparxworks
  ```

## 3. Cloud Run service + Pub/Sub topic (Terraform)

push-worker mirrors `email-worker`. Add to `terraform/envs/prod`:

- **`main.tf`** → `module "pubsub"` → `topics` map: `"push.send" = ["push-worker"]`
- **`serverless.tf`**:
  - a `google_service_account` `push_worker` (id `sparx-push-worker`) with
    `roles/cloudsql.client` + `roles/secretmanager.secretAccessor`;
  - a `module "push_worker_cloudrun"` (source `../../modules/cloud-run-worker`)
    copied from `email_worker_cloudrun` with:
    - `name = "push-worker"`, image `.../sparx/push-worker:latest`
    - `pubsub_topic = "push.send"`,
      `pubsub_subscription_name = "push.send.push-worker-cloudrun"`
    - `env_vars` add `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (e.g.
      `mailto:support@sparx.works`)
    - `secrets` add `{ name = "VAPID_PRIVATE_KEY", secret_id = "vapid-private-key" }`
      (keep `DATABASE_URL` from the email-worker template)
    - `container_concurrency = 4`, `timeout_seconds = 60`

Apply via the platform-apply workflow (not `terraform apply` locally).

## 4. Order of operations

1. Push `main` → **Build & push images** builds `push-worker` (already in the
   matrix) + **DB Migrate** applies `push_subscriptions`.
2. Generate VAPID keys (step 1).
3. Provision secret + configmap (step 2) → Bootstrap `app-env`.
4. Add + apply the Terraform (step 3) → creates the Cloud Run service + the
   `push.send` topic/subscription.

Once live: a staff member opens **Settings → Notifications**, flips the toggle
(grants permission), and an escalated chat publishes `push.send` →
push-worker → their browser.
