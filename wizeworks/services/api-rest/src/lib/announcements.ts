// The header notice bar — reads, writes and the one rule that decides whether a
// row is on screen.
//
// Shared by two seams that must not disagree: the operator console writes rows
// and lists ALL of them (drafts and expired included, because that is where a
// notice is retired), while the public endpoint serves only what is live. If
// "live" were computed twice it would eventually be computed differently, and
// the failure mode is an operator looking at a row marked running that nobody
// can see. So it is computed once, here.
//
// NOT the same thing as `lib/platform-notice.ts`, which writes in-app
// NOTIFICATION rows to one tenant's staff. This is a public banner, addressed to
// nobody in particular, and it has no recipient at all.

import { prisma, type Prisma } from '@wizeworks/db';
import type {
  OperatorAnnouncement,
  OperatorAnnouncementSurface,
  OperatorAnnouncementTone,
} from '@wizeworks/operator';

export const ANNOUNCEMENT_SURFACES = ['marketing', 'account', 'console'] as const;
export const ANNOUNCEMENT_TONES = ['primary', 'info', 'success', 'warning', 'danger'] as const;

/** The row shape as Prisma returns it. */
type AnnouncementRow = Prisma.PlatformAnnouncementGetPayload<object>;

/**
 * Is this row on screen right now?
 *
 * Two independent facts, and both have to hold. `isActive` is the SWITCH an
 * operator flips; the dates are the WINDOW they intended. Keeping them separate
 * is what lets somebody schedule next month's notice and still pull this
 * month's down immediately without editing the record of what was planned.
 *
 * An absent bound is open-ended, not zero: a notice with no `endsAt` runs until
 * somebody switches it off, which is the common case.
 */
export function isLive(row: AnnouncementRow, now: Date = new Date()): boolean {
  if (!row.isActive) return false;
  if (row.startsAt && row.startsAt > now) return false;
  if (row.endsAt && row.endsAt <= now) return false;
  return true;
}

/** Row → wire shape. Dates become ISO strings; `live` is computed, never read. */
export function serializeAnnouncement(
  row: AnnouncementRow,
  now = new Date()
): OperatorAnnouncement {
  return {
    id: row.id,
    platformBrand: row.platformBrand,
    surfaces: row.surfaces as OperatorAnnouncementSurface[],
    message: row.message,
    linkLabel: row.linkLabel,
    linkHref: row.linkHref,
    tone: row.tone as OperatorAnnouncementTone,
    dismissible: row.dismissible,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isActive: row.isActive,
    priority: row.priority,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    live: isLive(row, now),
  };
}

/**
 * The one notice a surface should render, or null.
 *
 * ONE, not a list. Two stacked bars above a page is a page that begins with its
 * own chrome, and every extra line pushes the thing somebody actually came for
 * further down. When two are live, `priority` breaks the tie and the newer row
 * wins after that — an operator who writes a second notice today meant it to
 * replace, not to queue behind.
 *
 * The window is filtered in SQL so a long-retired backlog never leaves the
 * database, and `isLive` is re-checked in memory only as the shared definition
 * (the SQL predicate below is that definition, expressed for the planner).
 */
export async function activeAnnouncement(
  brand: string,
  surface: OperatorAnnouncementSurface,
  now: Date = new Date()
): Promise<OperatorAnnouncement | null> {
  const row = await prisma.platformAnnouncement.findFirst({
    where: {
      platformBrand: brand,
      isActive: true,
      surfaces: { has: surface },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  return row ? serializeAnnouncement(row, now) : null;
}

/** Every announcement an operator may need to see — live, scheduled, expired and
 *  never switched on. Newest first, because that is the order they are written
 *  in and the one somebody is looking for is almost always the last one. */
export async function listAnnouncements(filter: {
  brand?: string;
  surface?: OperatorAnnouncementSurface;
}): Promise<OperatorAnnouncement[]> {
  const now = new Date();
  const rows = await prisma.platformAnnouncement.findMany({
    where: {
      ...(filter.brand ? { platformBrand: filter.brand } : {}),
      ...(filter.surface ? { surfaces: { has: filter.surface } } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
  });
  return rows.map((row) => serializeAnnouncement(row, now));
}
