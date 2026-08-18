// Shippo SDK client construction + error translation. Every provider
// method routes its raw SDK calls through callShippo() so the platform's
// error vocabulary (Configuration / Hard / Transient) stays consistent
// regardless of which Shippo endpoint failed.

import { Shippo } from 'shippo';
import { HTTPClientError } from 'shippo/models/errors/httpclienterrors';
import { ShippoError } from 'shippo/models/errors/shippoerror';

import {
  ProviderConfigurationError,
  ProviderHardError,
  ProviderTransientError,
} from '@wizeworks/integration-framework';
import type { ProviderRunContext } from '@wizeworks/integration-framework';

export async function shippoClientFor(ctx: ProviderRunContext): Promise<Shippo> {
  const apiToken = ctx.config.apiToken;
  if (typeof apiToken !== 'string' || apiToken.length === 0) {
    throw new ProviderConfigurationError(
      'shippo',
      'This Shippo installation is missing an API token.',
      ['apiToken']
    );
  }
  let apiKeyHeader: string;
  try {
    // By the time it reaches here `apiToken` is an `enc:` ref (provider-service.ts
    // encrypts it on install) or, for a manually-provisioned installation, a
    // legacy env:/GSM ref — ctx.secrets.read() resolves either transparently.
    apiKeyHeader = await ctx.secrets.read(apiToken);
  } catch (err) {
    throw new ProviderConfigurationError(
      'shippo',
      `Could not resolve the Shippo API token: ${err instanceof Error ? err.message : String(err)}`,
      ['apiToken']
    );
  }
  return new Shippo({ apiKeyHeader });
}

/** Wrap a raw Shippo SDK call, translating its typed HTTP errors into the
 *  platform's provider error vocabulary so callers can decide whether to
 *  retry, surface to the tenant, or fail the transaction outright. */
export async function callShippo<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (
      err instanceof ProviderConfigurationError ||
      err instanceof ProviderHardError ||
      err instanceof ProviderTransientError
    ) {
      throw err;
    }
    if (err instanceof ShippoError) {
      throw mapShippoError(err);
    }
    if (err instanceof HTTPClientError) {
      throw new ProviderTransientError('shippo', `Could not reach Shippo: ${err.message}`);
    }
    throw new ProviderTransientError(
      'shippo',
      err instanceof Error ? err.message : 'Shippo request failed unexpectedly'
    );
  }
}

function mapShippoError(err: ShippoError): Error {
  const status = err.statusCode;
  if (status === 401 || status === 403) {
    return new ProviderConfigurationError(
      'shippo',
      `Shippo rejected the request (${status}): the API token is invalid or lacks permission.`,
      ['apiToken']
    );
  }
  if (status === 429 || status >= 500) {
    const retryAfterHeader = err.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader == null ? undefined : Number(retryAfterHeader);
    return new ProviderTransientError(
      'shippo',
      `Shippo request failed (${status}): ${err.message}`,
      retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined
    );
  }
  return new ProviderHardError(
    'shippo',
    `Shippo request failed (${status}): ${err.message}`,
    String(status)
  );
}
