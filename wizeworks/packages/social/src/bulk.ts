// Bulk scheduling from a spreadsheet (docs/social-audit slice 21).
//
// A month of posts planned in a spreadsheet is how agencies, multi-location businesses
// and anyone with a marketing calendar actually work — and it is the one thing that makes
// moving off another tool tolerable. Without it, "import your plan" means retyping thirty
// posts one at a time.
//
// Two halves, both pure enough to test without a database:
//   · `parseSocialCsv` — text in, rows + per-row problems out. It never throws on bad
//     input; it REPORTS, because the whole point is showing someone what is wrong with
//     line 14 before anything is created.
//   · `createSocialPostsBulk` — rows in, drafts out, one transaction per row so a single
//     bad row cannot roll back the twenty-nine good ones.
//
// Everything imported lands as an ordinary post — a draft, or scheduled if the row has a
// time and the tenant's approval gate allows it. Nothing is special-cased downstream.

import { withTenant } from '@wizeworks/db';

import { wallTimeToInstant } from './cadence.js';
import type { SocialContext } from './context.js';
import { getSocialSettings } from './lifecycle.js';

/** One row as the file describes it, before it touches the database. */
export interface SocialCsvRow {
  /** 1-based line number in the source file, for error messages people can act on. */
  line: number;
  body: string;
  link: string | null;
  /** Parsed from the row's date column; null when the row has no time. */
  scheduledAt: Date | null;
  /** Destination NAMES as typed in the file — resolved to ids at import time, because
   *  nobody is pasting uuids into a spreadsheet. */
  targetNames: string[];
}

export interface SocialCsvProblem {
  line: number;
  message: string;
}

export interface SocialCsvParse {
  rows: SocialCsvRow[];
  problems: SocialCsvProblem[];
}

/** Split one CSV line, honouring quoted fields (a post body with a comma in it is the
 *  normal case, not the edge case) and doubled quotes as an escaped quote. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      out.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/** Column aliases, so a file exported from anywhere lines up without anyone editing
 *  headers. Matched case- and space-insensitively. */
const COLUMN_ALIASES: Record<string, keyof SocialCsvRow | 'targets'> = {
  body: 'body',
  text: 'body',
  post: 'body',
  message: 'body',
  caption: 'body',
  content: 'body',
  link: 'link',
  url: 'link',
  when: 'scheduledAt',
  date: 'scheduledAt',
  time: 'scheduledAt',
  scheduledat: 'scheduledAt',
  'scheduled at': 'scheduledAt',
  'publish at': 'scheduledAt',
  accounts: 'targets',
  account: 'targets',
  targets: 'targets',
  destinations: 'targets',
  channels: 'targets',
};

function normalizeHeader(raw: string): keyof SocialCsvRow | 'targets' | null {
  return COLUMN_ALIASES[raw.trim().toLowerCase()] ?? null;
}

/* ── Whose clock a spreadsheet's times are on ─────────────────────────────── */

// A time typed in a spreadsheet ("2026-10-15 09:00") names no zone, and it was read on
// THE SERVER's clock, which is UTC: a business in London planned 09:00 and her post went
// at 10:00 her time all summer (piggles persona issue 990). A time with no zone of its
// own is now read on the business's clock. One that names its zone ("...Z",
// "...+01:00", "GMT") is taken as written.

/** A zone this runtime can read, or UTC. A bad zone must never throw mid-import. */
export function readableZone(zone: string | null | undefined): string {
  const candidate = zone?.trim();
  if (!candidate) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

/** A time that says which zone it is on: a trailing Z or offset after a clock time, or
 *  the words UTC/GMT. */
const NAMES_ITS_ZONE =
  /\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})$|\b(?:UTC|GMT)\b/i;

/** "2026-10-15", "2026-10-15 09:00", "2026-10-15T09:00:30": a wall time and nothing else. */
const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function onZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const at = wallTimeToInstant(year, month, day, hour * 60 + minute, timeZone);
  const instant = new Date(at.getTime() + second * 1000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * One cell of the date column, as an instant. A time that names no zone is read on
 * `timeZone`'s clock. Null for something that is not a date.
 */
export function readScheduleCell(value: string, timeZone: string): Date | null {
  const text = value.trim();
  if (!text) return null;

  if (NAMES_ITS_ZONE.test(text)) {
    const at = new Date(text);
    return Number.isNaN(at.getTime()) ? null : at;
  }

  const wall = WALL_TIME.exec(text);
  if (wall) {
    const [, y, mo, d, h, mi, sec] = wall;
    return onZone(
      Number(y),
      Number(mo),
      Number(d),
      Number(h ?? 0),
      Number(mi ?? 0),
      Number(sec ?? 0),
      timeZone
    );
  }

  // Any other way a spreadsheet writes a date ("10/15/2026 9:00 AM"). The engine reads
  // such a string on the runtime's own clock, so its local fields ARE what was typed;
  // read them again on the business's clock.
  const loose = new Date(text);
  if (Number.isNaN(loose.getTime())) return null;
  return onZone(
    loose.getFullYear(),
    loose.getMonth() + 1,
    loose.getDate(),
    loose.getHours(),
    loose.getMinutes(),
    loose.getSeconds(),
    timeZone
  );
}

/**
 * The zone an import's times are read on: the business's own when it has set one,
 * otherwise `fallback` (the zone of the computer the file was sent from, which is what
 * the import screen tells the person), otherwise UTC.
 */
export async function importTimeZone(
  ctx: SocialContext,
  fallback?: string | null
): Promise<string> {
  const business = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.tenantBusiness.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { timezone: true },
    })
  );
  const own = business?.timezone?.trim();
  if (own && readableZone(own) === own) return own;
  return readableZone(fallback);
}

/**
 * Parse a pasted or uploaded CSV.
 *
 * Reports rather than throws: a file with three bad rows should import the other
 * twenty-seven and tell someone exactly which three, on which lines, and why.
 *
 * `timeZone` is the clock a time with no zone of its own is read on: the business's.
 */
export function parseSocialCsv(text: string, timeZone = 'UTC'): SocialCsvParse {
  const zone = readableZone(timeZone);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], problems: [{ line: 0, message: 'That file looks empty.' }] };
  }

  const headers = splitCsvLine(lines[0] ?? '').map(normalizeHeader);
  if (!headers.includes('body')) {
    return {
      rows: [],
      problems: [
        {
          line: 1,
          message:
            'The first row needs a column called "body" (or "text", "post", "caption") holding what each post says.',
        },
      ],
    };
  }

  const rows: SocialCsvRow[] = [];
  const problems: SocialCsvProblem[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = i + 1;
    const cells = splitCsvLine(lines[i] ?? '');
    let body = '';
    let link: string | null = null;
    let scheduledAt: Date | null = null;
    let targetNames: string[] = [];

    headers.forEach((header, index) => {
      const value = cells[index]?.trim() ?? '';
      if (!header || !value) return;
      if (header === 'body') body = value;
      else if (header === 'link') link = value;
      else if (header === 'targets') {
        // Semicolon or pipe between names, because a comma is already the delimiter.
        targetNames = value
          .split(/[;|]/)
          .map((n) => n.trim())
          .filter(Boolean);
      } else if (header === 'scheduledAt') {
        const parsed = readScheduleCell(value, zone);
        if (parsed === null) {
          problems.push({ line, message: `"${value}" isn't a date we could read.` });
        } else {
          scheduledAt = parsed;
        }
      }
    });

    if (!body) {
      problems.push({ line, message: 'This row has no post text, so it was skipped.' });
      continue;
    }
    rows.push({ line, body, link, scheduledAt, targetNames });
  }

  return { rows, problems };
}

export interface BulkImportResult {
  created: number;
  scheduled: number;
  problems: SocialCsvProblem[];
  postIds: string[];
}

/**
 * Create a draft (or scheduled post) per row.
 *
 * Destination names are resolved against the tenant's enabled destinations,
 * case-insensitively — a row naming an account that doesn't exist is a REPORTED problem,
 * not a silent drop, because "I imported thirty posts and four went nowhere" is the worst
 * possible outcome. A row with no accounts falls back to `defaultTargetIds`, which is what
 * the import screen pre-selects.
 *
 * One transaction per row: a bad row fails alone.
 */
export async function createSocialPostsBulk(
  ctx: SocialContext,
  rows: SocialCsvRow[],
  options: { propertyId?: string | null; defaultTargetIds?: string[] } = {}
): Promise<BulkImportResult> {
  const problems: SocialCsvProblem[] = [];
  const postIds: string[] = [];
  let scheduled = 0;

  const destinations = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialTarget.findMany({
      where: { tenantId: ctx.tenantId, enabled: true },
      select: { id: true, name: true, platform: true },
    })
  );
  const byName = new Map(destinations.map((d) => [d.name.trim().toLowerCase(), d]));
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const { requireApproval } = await getSocialSettings(ctx.tenantId);

  for (const row of rows) {
    const resolved: typeof destinations = [];
    for (const name of row.targetNames) {
      const match = byName.get(name.toLowerCase());
      if (match) resolved.push(match);
      else problems.push({ line: row.line, message: `No connected account called "${name}".` });
    }
    if (resolved.length === 0) {
      for (const id of options.defaultTargetIds ?? []) {
        const fallback = byId.get(id);
        if (fallback) resolved.push(fallback);
      }
    }
    if (resolved.length === 0) {
      problems.push({ line: row.line, message: 'No account to post this to, so it was skipped.' });
      continue;
    }

    // A time already past would be scheduled into the past and never fire; import it as
    // a draft instead and say so, rather than creating something that silently never runs.
    const future = row.scheduledAt !== null && row.scheduledAt.getTime() > Date.now();
    if (row.scheduledAt && !future) {
      problems.push({
        line: row.line,
        message: 'That time has already passed: imported as a draft instead.',
      });
    }

    // A dated row goes into the queue the same way any other scheduled post does —
    // through the approval gate when the tenant has one on. Importing straight to
    // `scheduled` would be the one path in the module that reaches live accounts
    // unreviewed, which is exactly what the gate exists to prevent.
    const status = future ? (requireApproval ? 'pending_approval' : 'scheduled') : 'draft';

    try {
      const post = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
        tx.socialPost.create({
          data: {
            tenantId: ctx.tenantId,
            propertyId: options.propertyId ?? null,
            body: row.body,
            link: row.link,
            source: 'import',
            status,
            scheduledAt: future ? row.scheduledAt : null,
            createdById: ctx.userId,
            targets: {
              create: resolved.map((d) => ({
                tenantId: ctx.tenantId,
                socialTargetId: d.id,
                targetName: d.name,
                platform: d.platform,
                status: 'pending',
              })),
            },
          },
          select: { id: true },
        })
      );
      postIds.push(post.id);
      if (future) scheduled += 1;
    } catch {
      problems.push({ line: row.line, message: 'This row could not be saved.' });
    }
  }

  return { created: postIds.length, scheduled, problems, postIds };
}
