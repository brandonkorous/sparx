// A business setting itself up from the account app (routes/auth/platform-business.ts).
//
// It ran in the app, on the app's own database client, until the apps came off
// the database (docs/154). The rules are unchanged; what moved is where they
// run, and one thing became generic on the way: which zone a site address lives
// in is read off the address itself (`zoneOf`), never off the brand, so a third
// brand needs no edit here.

import { type Prisma, prisma, withTenant } from '@wizeworks/db';

import { zoneOf } from './domain.js';

/** Thrown when the web address belongs to somebody else, or to the platform. */
export class AddressTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`web address already taken: ${slug}`);
    this.name = 'AddressTakenError';
  }
}

export type AddressVerdict = 'free' | 'taken' | 'reserved' | 'yours';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Whether this business may take `slug` as its web address. `reserved` is a
 *  name the platform keeps for itself; the caller passes its own list. */
export async function addressVerdict(
  db: Prisma.TransactionClient,
  tenantId: string,
  slug: string,
  reserved: ReadonlySet<string>
): Promise<AddressVerdict> {
  if (reserved.has(slug)) return 'reserved';
  const holder = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!holder) return 'free';
  return holder.id === tenantId ? 'yours' : 'taken';
}

/**
 * Bring this business's free site addresses into line with its web address.
 *
 * Sign-up writes a `domains` row with a placeholder name, and nothing else
 * rewrites it: a salon called Halo & Hem had a web address of `halo-and-hem`
 * and a stored site address of `swift-horizon-4860` (Piggles issue #089). The
 * row is a mirror (the site renderer reads the business out of the host), so a
 * stale row names an address that resolves to nothing.
 *
 * Best-effort per row: an address somebody else holds leaves that row alone
 * rather than failing a sign-up. Only `subdomain` rows in a zone this platform
 * serves are touched; a domain the customer owns is theirs.
 */
async function claimSubdomainHosts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  slug: string
): Promise<void> {
  const rows = await tx.domain.findMany({
    where: { tenantId, type: 'subdomain' },
    select: { id: true, host: true },
  });
  for (const row of rows) {
    const zone = zoneOf(row.host);
    if (!zone || row.host === zone) continue;
    // `<business>.<zone>` or `<site>.<business>.<zone>`. A rename must not
    // flatten the second into the first.
    const labels = row.host.slice(0, -(zone.length + 1)).split('.');
    const siteLabel = labels.length === 2 ? labels[0] : null;
    const wanted = siteLabel ? `${siteLabel}.${slug}.${zone}` : `${slug}.${zone}`;
    if (wanted === row.host) continue;
    const taken = await tx.domain.findUnique({ where: { host: wanted }, select: { id: true } });
    if (taken && taken.id !== row.id) continue;
    await tx.domain.update({ where: { id: row.id }, data: { host: wanted } });
  }
}

export interface BusinessSetup {
  tenantId: string;
  /** The platform brand: its key names the slice of `settings` the brand owns. */
  brand: string;
  name: string;
  /** The web address, already made into a slug by the caller. Null keeps it. */
  slug: string | null;
  /** The apps on the business's rail, when the caller chose them. */
  railApps?: string[];
  /** Merged into `settings[brand]`, key by key. */
  brandSettings?: Record<string, unknown>;
  reserved: ReadonlySet<string>;
}

/**
 * Save the answers to the setup questions, in one transaction: the business
 * name (on the business and on its main site), the rail, the brand's own
 * settings, and the web address with the site addresses that follow it.
 *
 * Throws `AddressTakenError` when the address belongs to somebody else. Nothing
 * is saved then.
 *
 * `withTenant`, never the raw client: `properties` is under FORCE row-level
 * security, so an UPDATE without `app.tenant_id` set matches nothing and
 * `updateMany` reports `{ count: 0 }` rather than an error. The first version
 * renamed the business and silently not its site, which went on sending
 * receipts under "Marta's workspace".
 *
 * `settings` is MERGED, never assigned: other parts of the platform write to it.
 * Neither `modules` nor `industry` is written here. A module flag is only half
 * an activation (furnishing does the whole), and `industry` is written by the
 * starter installer as its last step, so setting it here would mark the trade
 * chosen before its setup existed.
 */
export async function saveBusinessSetup(input: BusinessSetup): Promise<void> {
  await withTenant({ tenantId: input.tenantId }, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({
      where: { id: input.tenantId },
      select: { settings: true, slug: true },
    });
    const settings = record(current.settings);
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        name: input.name,
        settings: {
          ...settings,
          ...(input.railApps ? { rail: { ...record(settings.rail), apps: input.railApps } } : {}),
          ...(input.brandSettings
            ? { [input.brand]: { ...record(settings[input.brand]), ...input.brandSettings } }
            : {}),
        },
      },
    });

    // The main site carries the business name too. A business with no main
    // site is a broken sign-up, and saying so beats a silent half-save.
    const renamed = await tx.property.updateMany({
      where: { tenantId: input.tenantId, isPrimary: true },
      data: { name: input.name },
    });
    if (renamed.count === 0) {
      throw new Error(`setup: no main site renamed for tenant ${input.tenantId}`);
    }

    if (input.slug) {
      if (input.slug !== current.slug) {
        const verdict = await addressVerdict(tx, input.tenantId, input.slug, input.reserved);
        if (verdict === 'taken' || verdict === 'reserved') throw new AddressTakenError(input.slug);
        await tx.tenant.update({ where: { id: input.tenantId }, data: { slug: input.slug } });
      }
      await claimSubdomainHosts(tx, input.tenantId, input.slug);
    }
  });
}

/** Merge `values` into `settings[brand]`, key by key. */
export async function mergeBrandSettings(
  tenantId: string,
  brand: string,
  values: Record<string, unknown>
): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = record(current.settings);
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          [brand]: { ...record(settings[brand]), ...values },
        } as Prisma.InputJsonObject,
      },
    });
  });
}

/** Record where the person heard about the platform, once asked. */
export async function saveHeardAbout(tenantId: string, answer: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const current = await tx.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = record(current.settings);
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...settings,
          acquisition: {
            ...record(settings.acquisition),
            heardAbout: answer,
            heardAboutAt: new Date().toISOString(),
          },
        },
      },
    });
  });
}

/** An acquisition link counts only this long after sign-up. */
const FRESH_MS = 60 * 60 * 1000;

/**
 * Record how a new business found the platform, when sign-up could not.
 *
 * A Google sign-up passes through the provider's redirect and loses the link's
 * attribution on the way, so the first page after it records it here instead.
 * Only once, and only for a business made within the hour that has none yet:
 * an old business following a campaign link later is not a new acquisition.
 */
export interface Acquisition {
  channel: string | null;
  source: string | null;
  campaign: string | null;
  /** The first and last attribution snapshots, kept whole for a later
   *  recompute (docs/80 §8.3). */
  firstTouch: object | null;
  lastTouch: object | null;
}

export async function recordAcquisitionOnce(tenantId: string, acq: Acquisition): Promise<void> {
  await prisma.tenant.updateMany({
    where: {
      id: tenantId,
      acquiredAt: null,
      acquisitionChannel: null,
      acquisitionSource: null,
      createdAt: { gte: new Date(Date.now() - FRESH_MS) },
    },
    data: {
      acquisitionChannel: acq.channel,
      acquisitionSource: acq.source,
      acquisitionCampaign: acq.campaign,
      acquiredAt: new Date(),
      ...(acq.firstTouch && {
        acquisitionFirstTouch: acq.firstTouch,
      }),
      ...(acq.lastTouch && {
        acquisitionLastTouch: acq.lastTouch,
      }),
    },
  });
}
