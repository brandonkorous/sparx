// Gateway credential reader (docs/111 §2). Bring-your-own gateways (Square,
// Authorize.net, 1stPayGateway, custom) store the merchant's API keys as AES-256-GCM
// ciphertext in `tenant_gateway_credentials` — NOT Secret Manager (the app SA has no
// write grant; this mirrors how channel OAuth tokens + market bank accounts store
// merchant secrets). The adapters here need the DECRYPTED keys to call the vendor API,
// but @wizeworks/payments must not pull in the DB/crypto closure — so the host (api-rest)
// INJECTS a reader that reads the row + decrypts, exactly like the secret reader
// (secrets.ts). Dev/test default to a no-op reader (no configured gateways).

export interface GatewayCredentials {
  gatewayId: string;
  environment: 'sandbox' | 'production';
  /** Decrypted secret fields (api keys, transaction keys, …). */
  secrets: Record<string, string>;
  /** Non-secret captured fields (public client key, location id, hosted URL, …). */
  publicMeta: Record<string, string>;
}

export interface GatewayCredentialReader {
  /** The tenant's stored credentials for a gateway, or null when none are configured. */
  read(tenantId: string, gatewayId: string): Promise<GatewayCredentials | null>;
}

export class GatewayCredentialsMissingError extends Error {
  constructor(gatewayId: string) {
    super(`No credentials configured for gateway ${gatewayId}`);
    this.name = 'GatewayCredentialsMissingError';
  }
}

const noopReader: GatewayCredentialReader = {
  read: () => Promise.resolve(null),
};

let activeReader: GatewayCredentialReader = noopReader;

export function setGatewayCredentialReader(reader: GatewayCredentialReader): void {
  activeReader = reader;
}

export function getGatewayCredentialReader(): GatewayCredentialReader {
  return activeReader;
}

/** Read credentials or throw — the adapters call this; a missing config is a real,
 *  surfaced error (the merchant hasn't finished connecting the gateway). */
export async function requireGatewayCredentials(
  tenantId: string,
  gatewayId: string
): Promise<GatewayCredentials> {
  const creds = await activeReader.read(tenantId, gatewayId);
  if (!creds) throw new GatewayCredentialsMissingError(gatewayId);
  return creds;
}
