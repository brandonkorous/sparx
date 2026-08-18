// Credential plumbing for integrations — how a stored secret ref becomes a real
// secret, for every kind that reads one.
//
// WHAT MOVED, AND WHY. This used to also register provider bundles, and it registered
// exactly one (Shippo) — which is how easypost, taxjar and avalara came to ship
// complete and never be reachable. Registration now happens in ONE place for every
// category (`./integrations-bootstrap.ts`); what stays here is the secret reader and
// the payment gateways, which are inseparable because the same call installs the
// reader those gateways resolve their own credentials through.
//
// The `catch` that regex-matched "already registered" is gone with it. The shared
// plane's registrations are last-wins, so a second boot is a no-op and there is no
// benign exception left to tell apart from a real one.

import { setSecretReader, envSecretReader, mapSecretReader } from '@wizeworks/commerce';
import { SecretNotFoundError, type SecretReader } from '@wizeworks/integration-framework';

import { bootstrapIntegrations } from './integrations-bootstrap.js';
import { bootstrapPayments } from './payments-bootstrap.js';

let booted = false;

export function bootstrapProviders(): void {
  if (booted) return;
  booted = true;

  setSecretReader(buildSecretReader());

  // The payment surface (@wizeworks/payments gateways + their secret reader). This also
  // publishes the gateway catalog to the shared integration plane.
  bootstrapPayments();

  // Every other category — providers, channels, social, dropship, AI.
  bootstrapIntegrations();
}

/** env: refs hit process.env directly. projects/… refs hit Google Secret
 *  Manager via lazy import — the dep is optional so this service can
 *  run without GCP creds in development. */
function buildSecretReader(): SecretReader {
  const env = envSecretReader();
  let gsmClient: { accessSecretVersion: (req: { name: string }) => Promise<unknown> } | null = null;

  return {
    async read(ref: string): Promise<string> {
      if (ref.startsWith('env:')) return env.read(ref);
      if (ref.startsWith('projects/')) {
        if (!gsmClient) {
          const mod = (await import('@google-cloud/secret-manager').catch(() => null)) as {
            SecretManagerServiceClient: new () => typeof gsmClient;
          } | null;
          if (!mod) {
            throw new SecretNotFoundError(
              `${ref} (install @google-cloud/secret-manager to enable GSM secret resolution)`
            );
          }
          gsmClient = new mod.SecretManagerServiceClient();
        }
        const [response] = (await gsmClient!.accessSecretVersion({ name: ref })) as [
          { payload?: { data?: Buffer | Uint8Array | string } },
        ];
        const data = response?.payload?.data;
        if (!data) throw new SecretNotFoundError(ref);
        return typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
      }
      throw new SecretNotFoundError(ref);
    },
  };
}

/** Test-only escape hatch: swap the registry's secret resolution for
 *  fixed values. */
export function _setTestSecrets(entries: Record<string, string>): void {
  setSecretReader(mapSecretReader(entries));
}
