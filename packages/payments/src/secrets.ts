// Gateway credential reader (docs/94 ADR §5). Gateway credentials never live in the
// DB — only a Secret Manager reference does. The host (api-rest, workers) injects a
// real Google Secret Manager reader at boot; dev/test default to env-backed refs
// (`env:NAME`) so `pnpm dev` works without GCP credentials.
//
// Key patterns (the ref stored on tenant_payment_configs.credentials_ref, or derived):
//   payments/{tenantId}/sparx_pay/stripe_account_id
//   payments/{tenantId}/stripe_direct/secret_key

export interface PaymentSecretReader {
  read(ref: string): Promise<string>;
}

export class PaymentSecretNotFoundError extends Error {
  constructor(ref: string) {
    super(`Payment secret not found: ${ref}`);
    this.name = 'PaymentSecretNotFoundError';
  }
}

/** Dev default — resolves only `env:NAME` refs from process.env. */
export function envPaymentSecretReader(): PaymentSecretReader {
  return {
    read(ref: string): Promise<string> {
      if (!ref.startsWith('env:')) throw new PaymentSecretNotFoundError(ref);
      const value = process.env[ref.slice('env:'.length)];
      if (!value) throw new PaymentSecretNotFoundError(ref);
      return Promise.resolve(value);
    },
  };
}

/** Test seam — an in-memory map of ref → value. */
export function mapPaymentSecretReader(entries: Record<string, string>): PaymentSecretReader {
  return {
    read(ref: string): Promise<string> {
      const value = entries[ref];
      if (value === undefined) return Promise.reject(new PaymentSecretNotFoundError(ref));
      return Promise.resolve(value);
    },
  };
}

let activeReader: PaymentSecretReader = envPaymentSecretReader();

export function setPaymentSecretReader(reader: PaymentSecretReader): void {
  activeReader = reader;
}

export function getPaymentSecretReader(): PaymentSecretReader {
  return activeReader;
}

/** The Secret Manager ref for a gateway credential, per the ADR key pattern. */
export function credentialRef(tenantId: string, gatewayId: string, name: string): string {
  return `payments/${tenantId}/${gatewayId}/${name}`;
}
