// One-time backfill: encrypt any plaintext webhook signing secrets at rest.
//
// Before @sparx/api-core/webhook-secret-crypto shipped, webhook_subscriptions
// .signing_secret was stored PLAINTEXT. New rows are now encrypted on write and
// the delivery/read paths tolerate legacy plaintext, so nothing breaks without
// this — but the old rows remain a secret sitting in cleartext. This rewrites
// each plaintext row as an `enc:` bundle. Idempotent: already-encrypted rows
// are skipped, so it is safe to run repeatedly.
//
// Run locally against docker Postgres (requires the key to be set):
//
//   WEBHOOK_SIGNING_SECRET_KEY=$(openssl rand -base64 32) \
//     pnpm --filter @sparx/api-rest backfill:webhook-secrets
//
// In prod it runs as a one-off Job with the app env (Cloud SQL + the Secret
// Manager-backed WEBHOOK_SIGNING_SECRET_KEY), the same way the marketplace
// scripts do. It must run AFTER the key is provisioned and the encrypting build
// is deployed.
//
// RLS: webhook_subscriptions is FORCE row-level-security + tenant-scoped, so
// sparx_owner (a non-superuser in prod) sees zero rows without app.tenant_id
// set. We loop tenants and read/write each inside withTenant — the same idiom
// the tenant-scoped data migrations use.

import { prisma, withTenant } from '@sparx/db';
import {
  encryptWebhookSecret,
  isEncryptedWebhookSecret,
  isWebhookSecretCryptoConfigured,
} from '@sparx/api-core/webhook-secret-crypto';

async function main(): Promise<void> {
  if (!isWebhookSecretCryptoConfigured()) {
    console.error(
      '[backfill-webhook-secrets] WEBHOOK_SIGNING_SECRET_KEY is not set — cannot encrypt. ' +
        'Set the 32-byte key and re-run.'
    );
    process.exit(1);
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let encrypted = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    await withTenant({ tenantId: tenant.id }, async (tx) => {
      const subs = await tx.webhookSubscription.findMany({
        select: { id: true, signingSecret: true },
      });
      for (const sub of subs) {
        if (isEncryptedWebhookSecret(sub.signingSecret)) {
          skipped += 1;
          continue;
        }
        await tx.webhookSubscription.update({
          where: { id: sub.id },
          data: { signingSecret: encryptWebhookSecret(sub.signingSecret) },
        });
        encrypted += 1;
      }
    });
  }

  console.log(
    `[backfill-webhook-secrets] done — encrypted ${encrypted}, skipped ${skipped} already-encrypted ` +
      `across ${tenants.length} tenant(s).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[backfill-webhook-secrets] failed:', err);
    process.exit(1);
  });
