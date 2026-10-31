import 'server-only';

import { platformRequest, PlatformRequestError } from '@wizeworks/auth-client-server';
import type { CapacityReport, Meter, MeterState } from '@wizeworks/usage';
import { readBilling } from './billing';
import { readConsent } from './consent';

// Everything the account home reads, started at once: one wave, not three.
// Each read is a call to api-rest, as the person signed in (docs/154).

/** The person's active business, as api-rest describes it. */
export interface Business {
  name: string;
  slug: string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  /** The address her site is really served at, READ rather than composed
   *  (issue #089). Null when no site address exists yet. */
  siteHost: string | null;
  /** The modules switched on. */
  modulesEnabled: string[];
  /** What Piggles keeps in its own slice of the business settings. */
  brandSettings: Record<string, unknown>;
}

type WireBusiness = Omit<Business, 'trialEndsAt'> & { trialEndsAt: string | null };

/** The active business, or null when it no longer exists. */
export async function readBusiness(): Promise<Business | null> {
  try {
    const { business } = await platformRequest<{ business: WireBusiness }>('business');
    return {
      ...business,
      trialEndsAt: business.trialEndsAt ? new Date(business.trialEndsAt) : null,
    };
  } catch (err) {
    if (err instanceof PlatformRequestError && err.status === 404) return null;
    throw err;
  }
}

interface WireCapacity {
  meters: {
    meter: Meter;
    used: string | null;
    limit: string | null;
    fraction: number | null;
    state: MeterState;
  }[];
  measuredAt: string | null;
  allowanceSource: CapacityReport['allowanceSource'];
}

/** Byte counts travel as decimal strings (JSON cannot carry a bigint) and the
 *  measuring time as ISO. Null stays null: "not measured" is not zero.
 *  Exported for its test. */
export function capacityFromWire(wire: WireCapacity): CapacityReport {
  const big = (value: string | null) => (value === null ? null : BigInt(value));
  return {
    meters: wire.meters.map((m) => ({ ...m, used: big(m.used), limit: big(m.limit) })),
    measuredAt: wire.measuredAt ? new Date(wire.measuredAt) : null,
    allowanceSource: wire.allowanceSource,
    // api-rest logs a misread allowance; nothing here shows one.
    rejected: [],
  };
}

async function readCapacity(): Promise<CapacityReport> {
  const { capacity } = await platformRequest<{ capacity: WireCapacity }>('business/capacity');
  return capacityFromWire(capacity);
}

export async function loadAccountHome() {
  const [business, billing, consent, capacity] = await Promise.all([
    readBusiness(),
    readBilling(),
    readConsent(),
    readCapacity(),
  ]);
  return { business, billing, consent, capacity };
}
