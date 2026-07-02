// Public directory reads (docs/114 §B.6) — the unauthenticated, no-tenant surface
// sparx.works/partners + /bootcamp consume. Runs under withSystem, so the
// `partners_visibility` / `bootcamps_visibility` RLS policies expose only
// active/published rows. Facet algebra is in-memory (the catalog is small, like
// the marketplace); the response shape is stable for a future search backend.

import { withSystem } from '@sparx/db';
import { BootcampDirectoryQuery, PartnerDirectoryQuery } from '@sparx/partner-schemas';

const TIER_ORDER: Record<string, number> = { certified: 0, registered: 1, informal: 2 };

export interface PartnerCard {
  id: string;
  displayName: string;
  tier: string;
  kind: string;
  bio: string | null;
  locationCity: string | null;
  locationState: string | null;
  isRemote: boolean;
  specialties: string[];
  websiteUrl: string | null;
  photoUrl: string | null;
}

export interface BootcampCard {
  id: string;
  title: string;
  slug: string;
  format: string;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string;
  startsAt: string;
  endsAt: string;
  seatsTotal: number | null;
  seatsFilled: number;
  priceCents: number;
  currency: string;
  host: { displayName: string; tier: string };
}

interface Bucket {
  value: string;
  count: number;
}

function tally(values: string[]): Bucket[] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function paginate<T>(items: T[], cursor: string | undefined, limit: number) {
  const offset = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
  const page = items.slice(offset, offset + limit);
  const next = offset + limit;
  return { page, next_cursor: next < items.length ? String(next) : null };
}

export const directoryService = {
  async listPartners(raw: Record<string, unknown>) {
    const q = PartnerDirectoryQuery.parse(raw);
    const rows = await withSystem((tx) =>
      tx.partner.findMany({
        where: { status: 'active', directoryVisible: true, deletedAt: null },
      })
    );

    const needle = q.q?.toLowerCase();
    const loc = q.location?.toLowerCase();
    const items = rows.filter((p) => {
      if (q.tier && p.tier !== q.tier) return false;
      if (q.remote && !p.isRemote) return false;
      if (q.specialty && !p.specialties.includes(q.specialty)) return false;
      if (loc) {
        const hay = `${p.locationCity ?? ''} ${p.locationState ?? ''}`.toLowerCase();
        if (!(hay.includes(loc) || (loc === 'remote' && p.isRemote))) return false;
      }
      if (needle) {
        const hay = `${p.displayName} ${p.bio ?? ''} ${p.specialties.join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });

    // Certified-first, then alphabetical (docs/114 §B.6 / partners spec sort).
    items.sort(
      (a, b) =>
        (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) ||
        a.displayName.localeCompare(b.displayName)
    );

    const facets = {
      tier: tally(rows.map((p) => p.tier)),
      specialty: tally(rows.flatMap((p) => p.specialties)),
    };
    const { page, next_cursor } = paginate(items, q.cursor, q.limit);
    return {
      items: page.map(toPartnerCard),
      facets,
      next_cursor,
      total: items.length,
    };
  },

  async getPartner(id: string): Promise<PartnerCard | null> {
    const row = await withSystem((tx) =>
      tx.partner.findFirst({
        where: { id, status: 'active', directoryVisible: true, deletedAt: null },
      })
    );
    return row ? toPartnerCard(row) : null;
  },

  async listBootcamps(raw: Record<string, unknown>) {
    const q = BootcampDirectoryQuery.parse(raw);
    const now = new Date();
    const from = q.from ? new Date(q.from) : null;
    const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : null;

    const { rows, hosts } = await withSystem(async (tx) => {
      const rows = await tx.bootcamp.findMany({
        where: { status: 'published', deletedAt: null },
        orderBy: { startsAt: 'asc' },
      });
      const partnerIds = [...new Set(rows.map((r) => r.partnerId))];
      const hosts = await tx.partner.findMany({
        where: { id: { in: partnerIds } },
        select: { id: true, displayName: true, tier: true },
      });
      return { rows, hosts };
    });
    const hostMap = new Map(hosts.map((h) => [h.id, { displayName: h.displayName, tier: h.tier }]));

    const needle = q.q?.toLowerCase();
    const loc = q.location?.toLowerCase();
    const items = rows.filter((b) => {
      // Hide finished cohorts unless an explicit date range asks for them.
      if (!from && !to && b.endsAt < now) return false;
      if (from && b.startsAt < from) return false;
      if (to && b.startsAt > to) return false;
      if (q.format && b.format !== q.format) return false;
      if (loc) {
        const hay = `${b.locationCity ?? ''} ${b.locationState ?? ''}`.toLowerCase();
        if (!hay.includes(loc)) return false;
      }
      if (needle && !b.title.toLowerCase().includes(needle)) return false;
      return true;
    });

    const facets = { format: tally(rows.map((b) => b.format)) };
    const { page, next_cursor } = paginate(items, q.cursor, q.limit);
    return {
      items: page.map((b) => toBootcampCard(b, hostMap.get(b.partnerId))),
      facets,
      next_cursor,
      total: items.length,
    };
  },

  async getBootcamp(slug: string) {
    return withSystem(async (tx) => {
      const b = await tx.bootcamp.findFirst({
        where: { slug, status: 'published', deletedAt: null },
      });
      if (!b) return null;
      const host = await tx.partner.findFirst({
        where: { id: b.partnerId },
        select: { id: true, displayName: true, tier: true, websiteUrl: true },
      });
      return {
        ...toBootcampCard(b, host ? { displayName: host.displayName, tier: host.tier } : undefined),
        description: b.description,
        registrationMode: b.registrationMode,
        registrationUrl: b.registrationUrl,
      };
    });
  },
};

function toPartnerCard(p: {
  id: string;
  displayName: string;
  tier: string;
  kind: string;
  bio: string | null;
  locationCity: string | null;
  locationState: string | null;
  isRemote: boolean;
  specialties: string[];
  websiteUrl: string | null;
  photoUrl: string | null;
}): PartnerCard {
  return {
    id: p.id,
    displayName: p.displayName,
    tier: p.tier,
    kind: p.kind,
    bio: p.bio,
    locationCity: p.locationCity,
    locationState: p.locationState,
    isRemote: p.isRemote,
    specialties: p.specialties,
    websiteUrl: p.websiteUrl,
    photoUrl: p.photoUrl,
  };
}

function toBootcampCard(
  b: {
    id: string;
    title: string;
    slug: string;
    format: string;
    locationCity: string | null;
    locationState: string | null;
    locationCountry: string;
    startsAt: Date;
    endsAt: Date;
    seatsTotal: number | null;
    seatsFilled: number;
    priceCents: number;
    currency: string;
  },
  host: { displayName: string; tier: string } | undefined
): BootcampCard {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    format: b.format,
    locationCity: b.locationCity,
    locationState: b.locationState,
    locationCountry: b.locationCountry,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    seatsTotal: b.seatsTotal,
    seatsFilled: b.seatsFilled,
    priceCents: b.priceCents,
    currency: b.currency,
    host: host ?? { displayName: 'Sparx Partner', tier: 'informal' },
  };
}
