# push-worker — provisioning

The Web Push stack (docs/69 A-6) is **fully wired in code + Terraform** — the
push-worker Cloud Run service, the `push.send` topic/subscription, and the
`vapid-private-key` secret container are all declared (serverless.tf, main.tf).
The only remaining steps are the same "add the value once" steps every other
secret has, because VAPID keys are _generated_ rather than vendor-issued.

Until they're done the feature **degrades gracefully**: the dashboard toggle
shows "not configured", and push-worker acks every `push.send` as a no-op.

## 1. Generate the VAPID key pair (once)

```bash
npx web-push generate-vapid-keys
# → Public Key:  B....   (non-secret — handed to browsers at subscribe time)
# → Private Key: x....   (secret — signs push requests)
```

## 2. Provision the values

- **Private key** → the TF-managed `vapid-private-key` secret (add a version,
  exactly like `stripe-secret-key` etc.):
  ```bash
  printf '%s' '<private-key>' \
    | gcloud secrets versions add vapid-private-key --data-file=- --project=sparxworks
  ```
- **Public key** (non-secret) → two plain config spots, same value:
  - `terraform/envs/prod/terraform.tfvars` → `vapid_public_key = "<public-key>"`
    (push-worker's Cloud Run env).
  - `k8s/sparx-prod/app-env-configmap.yaml` → `VAPID_PUBLIC_KEY: '<public-key>'`
    (the dashboard reads it at runtime).

## 3. Apply

1. Push to `main` → **Build & push images** builds `push-worker` (in the matrix)
   and **DB Migrate** applies `push_subscriptions`.
2. Run the **platform-apply** (Terraform) workflow → creates the push-worker
   Cloud Run service, the `push.send` topic + `push.send.push-worker-cloudrun`
   subscription, and the `vapid-private-key` secret container.
3. Run **Bootstrap** with `components=app-env` → pushes the configmap
   (`VAPID_PUBLIC_KEY`) to the dashboard.

Once live: a staff member opens **Settings → Notifications**, flips the toggle
(grants permission), and an escalated chat publishes `push.send` →
push-worker → their browser.
