// A site's published writing by month, for the archive block (`cms.archive`).
//
// A journal at two hundred pieces cannot be browsed as one list, and a pager only says
// "older". Readers browse an archive by when: a row of years, then the months of one
// year with what went out in each. Months fall on the business's own clock, so a piece
// out at 00:30 on the 1st in London is in that month, not the one before.

import { kindLayout, type KindFieldLike } from '@wizeworks/silica-catalog';

import type { ServedKindInfo } from './author-credits.js';
import { entryPublicPath } from './content-paths.js';

export interface ArchiveEntryRow {
  typeKey: string;
  slug: string | null;
  body: unknown;
  publishedAt: Date | null;
}

export interface ArchivePiece {
  title: string;
  path: string;
  publishedAt: string;
  kindName: string;
  /** The piece's first single choice, by its label ("Field"), when its kind has one. */
  section: string | null;
}

export interface ArchiveMonth {
  /** `2026-10`. */
  month: string;
  pieces: ArchivePiece[];
}

/** The year and month a moment falls in on a clock — `2026-10`. */
export function monthOn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(at);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

/** Every year with something published, newest first, with how much. */
export function archiveYears(
  dates: readonly Date[],
  timeZone: string
): { year: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const at of dates) {
    const year = Number(monthOn(at, timeZone).slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => b - a).map(([year, count]) => ({ year, count }));
}

function sectionOf(fields: readonly KindFieldLike[], body: Record<string, unknown>): string | null {
  const field = kindLayout(fields).facts.find((f) => f.type === 'enum');
  if (!field) return null;
  const value = body[field.key];
  if (typeof value !== 'string' || value === '') return null;
  return field.options?.find((o) => o.value === value)?.label ?? value;
}

/** One year's pieces, newest month first, newest piece first within it. A piece whose
 *  kind the website does not serve, or with no headline, is left out: the archive only
 *  lists what a reader can open. */
export function archiveMonths(
  rows: readonly ArchiveEntryRow[],
  kinds: ReadonlyMap<string, ServedKindInfo>,
  timeZone: string,
  year: number
): ArchiveMonth[] {
  const byMonth = new Map<string, ArchivePiece[]>();
  const sorted = [...rows].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  );
  for (const row of sorted) {
    if (!row.publishedAt) continue;
    const kind = kinds.get(row.typeKey);
    if (!kind) continue;
    const month = monthOn(row.publishedAt, timeZone);
    if (Number(month.slice(0, 4)) !== year) continue;
    const path = entryPublicPath(kind.key, kind.urlPattern, row.slug);
    const fields = kind.fields as KindFieldLike[];
    const body = (row.body ?? {}) as Record<string, unknown>;
    const headline = kindLayout(fields).headline;
    const title = headline && typeof body[headline] === 'string' ? body[headline] : '';
    if (!path || !title) continue;
    const list = byMonth.get(month) ?? [];
    list.push({
      title,
      path,
      publishedAt: row.publishedAt.toISOString(),
      kindName: kind.name,
      section: sectionOf(fields, body),
    });
    byMonth.set(month, list);
  }
  return [...byMonth.entries()].map(([month, pieces]) => ({ month, pieces }));
}
