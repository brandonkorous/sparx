// Payments boot (docs/94 ADR §4, §5). Registers the built-in gateways and wires the
// payment secret reader. Runs once per process from bootstrapProviders().
//
// How the gateways resolve credentials (they call getPaymentSecretReader().read):
//
//   payments/{tenantId}/sparx_pay/stripe_account_id
//       The tenant's Stripe Connect connected account id (`acct_…`) — a NON-secret
//       identifier the platform mints at onboarding. It lives on the tenant ROOT row
//       (tenant.stripeAccountId), readable by the app service account with no Secret
//       Manager grant. Resolved here from that column.
//
//   payments/{tenantId}/{gatewayId}/{name}   (genuine secrets — e.g. stripe_direct
//       secret_key / webhook_secret)
//       Google Secret Manager at projects/{project}/secrets/
//       payments-{tenantId}-{gatewayId}-{name}/versions/latest. The app SA holds
//       secretAccessor (read); secret VALUES are provisioned out-of-band — the
//       established "configEncrypted holds refs, values live in GSM" pattern. Never
//       in the DB.
//
//   env:NAME   process.env (dev / test).
//   projects/… a fully-qualified GSM resource name, passed straight through.

import { prisma } from '@sparx/db';
import {
  PaymentSecretNotFoundError,
  registerSparxGateways,
  setPaymentSecretReader,
  type PaymentSecretReader,
} from '@sparx/payments';

// payments/{uuid}/sparx_pay/stripe_account_id — the non-secret connected account id.
const SPARX_PAY_ACCOUNT_REF = /^payments\/([0-9a-f-]{36})\/sparx_pay\/stripe_account_id$/i;
// Any other payments/{uuid}/{gateway}/{name} — a genuine secret in Secret Manager.
const PAYMENTS_SECRET_REF = /^payments\/([0-9a-f-]{36})\/([a-z0-9_]+)\/([a-z0-9_]+)$/i;

let booted = false;

/** Register gateways + the payment secret reader. Idempotent across createApp()
 *  calls (tests build the app many times). */
export function bootstrapPayments(): void {
  if (booted) return;
  booted = true;
  try {
    registerSparxGateways();
  } catch (err) {
    // "already registered" — a parallel test/HMR boot beat us to it. Anything else
    // is a real bug.
    if (!(err instanceof Error) || !/already registered/i.test(err.message)) throw err;
  }
  setPaymentSecretReader(buildPaymentSecretReader());
}

function buildPaymentSecretReader(): PaymentSecretReader {
  let gsm: { accessSecretVersion: (req: { name: string }) => Promise<unknown> } | null = null;

  async function readGsm(name: string): Promise<string> {
    if (!gsm) {
      const mod = (await import('@google-cloud/secret-manager').catch(() => null)) as {
        SecretManagerServiceClient: new () => typeof gsm;
      } | null;
      if (!mod) {
        throw new PaymentSecretNotFoundError(
          `${name} (install @google-cloud/secret-manager to enable GSM secret resolution)`
        );
      }
      gsm = new mod.SecretManagerServiceClient();
    }
    const [resp] = (await gsm!.accessSecretVersion({ name })) as [
      { payload?: { data?: Buffer | Uint8Array | string } },
    ];
    const data = resp?.payload?.data;
    if (!data) throw new PaymentSecretNotFoundError(name);
    return typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
  }

  return {
    async read(ref: string): Promise<string> {
      if (ref.startsWith('env:')) {
        const value = process.env[ref.slice('env:'.length)];
        if (!value) throw new PaymentSecretNotFoundError(ref);
        return value;
      }
      if (ref.startsWith('projects/')) return readGsm(ref);

      // Sparx Pay connected account id — non-secret, on the tenant root row.
      const acct = SPARX_PAY_ACCOUNT_REF.exec(ref);
      if (acct) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: acct[1] },
          select: { stripeAccountId: true },
        });
        const accountId = tenant?.stripeAccountId?.trim();
        if (!accountId) throw new PaymentSecretNotFoundError(ref);
        return accountId;
      }

      // Genuine per-tenant gateway secret — Secret Manager (read-only).
      const parts = PAYMENTS_SECRET_REF.exec(ref);
      if (parts) {
        const project = process.env.GCP_PROJECT_ID?.trim();
        if (!project) throw new PaymentSecretNotFoundError(`${ref} (GCP_PROJECT_ID unset)`);
        const [, tenantId, gatewayId, name] = parts;
        const secretId = `payments-${tenantId}-${gatewayId}-${name}`;
        return readGsm(`projects/${project}/secrets/${secretId}/versions/latest`);
      }

      throw new PaymentSecretNotFoundError(ref);
    },
  };
}
