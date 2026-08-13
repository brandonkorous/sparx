// Scheduled report delivery (docs/146 Phase 10.4).
//
// The reports built in 10.1 are good and nobody will open them, because opening
// them means remembering to log in on a Monday morning. So the report goes to
// the person instead.
//
// ── Three decisions worth knowing about ──────────────────────────────────────
//
// 1. `nextRunAt` is STORED, and computed by the pure `nextRunAt()` in
//    commerce-schemas. Stored so the sweep can find due rows with an index
//    rather than evaluating a cadence for every schedule on the platform;
//    computed by one function so the date the screen promises and the date the
//    sweep fires on cannot disagree.
//
// 2. A report with nothing in it is `skipped`, not sent. A weekly email saying
//    "nothing has expired" every week for a year is how somebody learns to
//    filter the sender, and the one week it matters is the week it goes unread.
//    `skipped` is recorded as a delivery so the history still shows the schedule
//    ran.
//
// 3. Failures are counted and the schedule is PAUSED after enough of them. A
//    standing instruction that cannot deliver — a mailbox that no longer exists,
//    a report that throws — must stop, visibly, rather than retrying into the
//    void every morning for a year. The count is what the surface shows to
//    explain why it stopped.

import {
  CreateReportScheduleInput,
  ReportFilters,
  UpdateReportScheduleInput,
  nextRunAt as computeNextRunAt,
  type ReportCadence,
} from '@sparx/commerce-schemas';
import { withTenant, withSystem } from '@sparx/db';
import type { EmailSendPayload } from '@sparx/events';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';

import { writeAuditLog } from '../audit';
import { toCsv } from '../csv';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { reportDefinition, runReport, type SummaryLine } from './report-registry';

/** After this many consecutive failures the schedule stops trying. Four is a
 *  working week of a daily report: long enough to survive a bad afternoon,
 *  short enough that nobody discovers a dead schedule in June. */
const FAILURE_LIMIT = 4;

/**
 * The most CSV that may ride inside an `email.send` event, before base64.
 *
 * JetStream's default maximum message size is 1 MB and the payload carries the
 * rendered props as well. 400 KB of CSV becomes about 540 KB base64, which
 * leaves room. A bigger report is not silently truncated — the email says it was
 * too large and points at the screen, which is honest and actionable, unlike an
 * event that the broker refuses and nobody sees.
 */
const MAX_ATTACHMENT_BYTES = 400_000;

const logger: PublisherLogger = {
  info: (obj, msg) =>
    console.log(JSON.stringify({ level: 'info', src: 'inventory-reports', ...obj, msg })),
  warn: (obj, msg) =>
    console.warn(JSON.stringify({ level: 'warn', src: 'inventory-reports', ...obj, msg })),
  error: (obj, msg) =>
    console.error(JSON.stringify({ level: 'error', src: 'inventory-reports', ...obj, msg })),
};

export interface ReportScheduleRow {
  id: string;
  reportKey: string;
  /** The report's own business name, resolved from the registry — so a list can
   *  show what a schedule sends without the caller knowing the key vocabulary. */
  reportLabel: string;
  name: string;
  cadence: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  timezone: string;
  recipients: string[];
  format: string;
  filters: ReportFilters;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  consecutiveFailures: number;
  /** True when repeated failures stopped it. The surface says so rather than
   *  showing an inactive switch with no explanation. */
  pausedByFailures: boolean;
  createdAt: string;
}

export interface ReportDeliveryRow {
  id: string;
  status: string;
  trigger: string;
  recipients: string[];
  rowCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
  sentAt: string;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listReportSchedules(
  ctx: ServiceContext
): Promise<{ items: ReportScheduleRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryReportSchedule.findMany({
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return { items: rows.map(serialize), total: rows.length };
  });
}

export async function getReportSchedule(
  ctx: ServiceContext,
  id: string
): Promise<ReportScheduleRow & { deliveries: ReportDeliveryRow[] }> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventoryReportSchedule.findFirst({
      where: { id },
      include: { deliveries: { orderBy: { sentAt: 'desc' }, take: 25 } },
    });
    if (!row) throw new InventoryNotFoundError('InventoryReportSchedule', id);
    return {
      ...serialize(row),
      deliveries: row.deliveries.map(serializeDelivery),
    };
  });
}

export async function createReportSchedule(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ReportScheduleRow> {
  const input = CreateReportScheduleInput.parse(rawInput);
  if (!reportDefinition(input.reportKey)) {
    throw new InventoryValidationError('There is no report by that name', [
      { field: 'reportKey', message: input.reportKey },
    ]);
  }

  const id = await withTenant(ctx, async (tx) => {
    const row = await tx.inventoryReportSchedule.create({
      data: {
        tenantId: ctx.tenantId,
        reportKey: input.reportKey,
        name: input.name,
        cadence: input.cadence,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        hour: input.hour,
        timezone: input.timezone,
        recipients: input.recipients,
        format: input.format,
        filters: input.filters,
        isActive: input.isActive,
        nextRunAt: input.isActive ? nextFire(input, new Date()) : null,
        createdBy: ctx.userId ?? null,
      },
      select: { id: true, name: true },
    });
    await audit(tx, ctx, row.id, 'created', {
      name: row.name,
      reportKey: input.reportKey,
      cadence: input.cadence,
      recipients: input.recipients.length,
    });
    return row.id;
  });

  const { deliveries: _deliveries, ...schedule } = await getReportSchedule(ctx, id);
  return schedule;
}

export async function updateReportSchedule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<ReportScheduleRow> {
  const input = UpdateReportScheduleInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryReportSchedule.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('InventoryReportSchedule', id);

    const merged = {
      cadence: (input.cadence ?? existing.cadence) as ReportCadence,
      dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
      dayOfMonth: input.dayOfMonth ?? existing.dayOfMonth,
      hour: input.hour ?? existing.hour,
      timezone: input.timezone ?? existing.timezone,
    };
    const isActive = input.isActive ?? existing.isActive;

    await tx.inventoryReportSchedule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        cadence: merged.cadence,
        dayOfWeek: merged.dayOfWeek,
        dayOfMonth: merged.dayOfMonth,
        hour: merged.hour,
        timezone: merged.timezone,
        ...(input.recipients !== undefined ? { recipients: input.recipients } : {}),
        ...(input.format !== undefined ? { format: input.format } : {}),
        ...(input.filters !== undefined ? { filters: input.filters } : {}),
        isActive,
        // Re-arming clears the failure count. Somebody switching a paused
        // schedule back on has, presumably, fixed the thing that broke it, and
        // arriving pre-loaded with three strikes would pause it again on the
        // next hiccup.
        ...(isActive && !existing.isActive ? { consecutiveFailures: 0 } : {}),
        nextRunAt: isActive ? nextFire(merged, new Date()) : null,
      },
    });
    await audit(tx, ctx, id, 'updated', { isActive });
  });

  const { deliveries: _deliveries, ...schedule } = await getReportSchedule(ctx, id);
  return schedule;
}

export async function deleteReportSchedule(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryReportSchedule.findFirst({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventoryReportSchedule', id);
    await audit(tx, ctx, id, 'deleted', { name: existing.name });
    await tx.inventoryReportSchedule.delete({ where: { id } });
  });
}

// ─── Sending ─────────────────────────────────────────────────────────────────

export interface DeliveryResult {
  scheduleId: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  recipients: number;
  rowCount: number | null;
  error: string | null;
}

/**
 * Run one schedule and email it.
 *
 * `trigger: 'manual'` is somebody pressing "send it now", which is how anyone
 * ever finds out whether a schedule they just set up actually works. It runs the
 * identical path — same report, same rendering, same recipients — because a test
 * send that takes a different route tests nothing.
 */
export async function runReportSchedule(
  ctx: ServiceContext,
  id: string,
  trigger: 'scheduled' | 'manual' = 'manual'
): Promise<DeliveryResult> {
  const schedule = await withTenant(ctx, async (tx) => {
    const row = await tx.inventoryReportSchedule.findFirst({ where: { id } });
    if (!row) throw new InventoryNotFoundError('InventoryReportSchedule', id);
    return row;
  });

  const definition = reportDefinition(schedule.reportKey);
  if (!definition) {
    return recordDelivery(ctx, schedule, trigger, {
      status: 'failed',
      rowCount: null,
      error: `This schedule points at a report that no longer exists (${schedule.reportKey})`,
      periodStart: null,
      periodEnd: null,
    });
  }

  let run: Awaited<ReturnType<typeof runReport>>;
  try {
    run = await runReport(ctx, schedule.reportKey, parseFilters(schedule.filters));
  } catch (error) {
    return recordDelivery(ctx, schedule, trigger, {
      status: 'failed',
      rowCount: null,
      error: error instanceof Error ? error.message : 'The report could not be worked out',
      periodStart: null,
      periodEnd: null,
    });
  }

  const rowCount = run.csv.rows.length;
  const period = periodOf(run.filters);

  // Nothing to say. Recorded as a delivery so the history shows the schedule
  // ran, but nobody's inbox is spent on it.
  if (rowCount === 0 && run.summary.every((line) => isEmptyFigure(line))) {
    return recordDelivery(ctx, schedule, trigger, {
      status: 'skipped',
      rowCount: 0,
      error: null,
      ...period,
    });
  }

  const businessName = await resolveBusinessName(ctx);
  const csvBody = schedule.format === 'csv' ? toCsv(run.csv) : null;
  const csvBytes = csvBody === null ? 0 : Buffer.byteLength(csvBody, 'utf8');
  const tooLarge = csvBody !== null && csvBytes > MAX_ATTACHMENT_BYTES;
  const attachmentName = csvBody !== null && !tooLarge ? `${run.csv.name}.csv` : null;

  const publisher = createPublisher({ logger });
  let sent = 0;
  const failures: string[] = [];

  for (const recipient of schedule.recipients) {
    const payload: EmailSendPayload & { attachments?: unknown } = {
      to: recipient,
      template: 'inventory-report',
      props: {
        businessName,
        scheduleName: schedule.name,
        reportLabel: run.label,
        reportDescription: definition.description,
        ...(period.periodStart && period.periodEnd
          ? { periodLabel: periodLabel(period.periodStart, period.periodEnd) }
          : {}),
        lines: run.summary,
        rowCount,
        attachmentName,
        attachmentTooLarge: tooLarge,
        reportUrl: reportUrlFor(schedule.reportKey),
      },
      ...(attachmentName && csvBody !== null
        ? {
            attachments: [
              {
                filename: attachmentName,
                contentType: 'text/csv',
                contentBase64: Buffer.from(csvBody, 'utf8').toString('base64'),
              },
            ],
          }
        : {}),
    };

    try {
      await publishEvent(
        publisher,
        'email.send',
        ctx.tenantId,
        ctx.userId ?? null,
        payload,
        logger
      );
      sent += 1;
    } catch (error) {
      // One bad address must not cost the other four their report — the whole
      // point of `partial` being a first-class outcome.
      failures.push(`${recipient}: ${error instanceof Error ? error.message : 'could not send'}`);
    }
  }

  return recordDelivery(ctx, schedule, trigger, {
    status: sent === 0 ? 'failed' : failures.length > 0 ? 'partial' : 'success',
    rowCount,
    error: failures.length > 0 ? failures.join('; ') : null,
    ...period,
  });
}

export interface ReportSweepResult {
  schedulesDue: number;
  sent: number;
  skipped: number;
  failed: number;
  paused: number;
}

/**
 * Send every schedule that is due, across every tenant.
 *
 * Called by the worker. Runs under `withSystem` to FIND the due rows — the sweep
 * has no tenant of its own — and then does each tenant's work under that
 * tenant's own context, so every report is produced through RLS exactly as it
 * would be for a person.
 */
export async function sweepDueReports(now = new Date()): Promise<ReportSweepResult> {
  const due = await withSystem((tx) =>
    tx.inventoryReportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      select: { id: true, tenantId: true },
      orderBy: { nextRunAt: 'asc' },
      take: 500,
    })
  );

  const result: ReportSweepResult = {
    schedulesDue: due.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    paused: 0,
  };

  for (const row of due) {
    const ctx: ServiceContext = { tenantId: row.tenantId };
    try {
      const outcome = await runReportSchedule(ctx, row.id, 'scheduled');
      if (outcome.status === 'skipped') result.skipped += 1;
      else if (outcome.status === 'failed') result.failed += 1;
      else result.sent += 1;
    } catch (error) {
      result.failed += 1;
      logger.error({ scheduleId: row.id, err: String(error) }, 'report schedule threw');
    }
    const paused = await withTenant(ctx, async (tx) => {
      const after = await tx.inventoryReportSchedule.findFirst({
        where: { id: row.id },
        select: { isActive: true },
      });
      return after !== null && !after.isActive;
    });
    if (paused) result.paused += 1;
  }

  return result;
}

// ─── plumbing ────────────────────────────────────────────────────────────────

interface DeliveryFacts {
  status: 'success' | 'partial' | 'failed' | 'skipped';
  rowCount: number | null;
  error: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

/** Write the delivery row, advance the schedule, and pause it if it has failed
 *  too many times in a row. One function so those three can never come apart. */
async function recordDelivery(
  ctx: ServiceContext,
  schedule: {
    id: string;
    recipients: string[];
    cadence: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    hour: number;
    timezone: string;
    consecutiveFailures: number;
  },
  trigger: 'scheduled' | 'manual',
  facts: DeliveryFacts
): Promise<DeliveryResult> {
  const failed = facts.status === 'failed';
  const failures = failed ? schedule.consecutiveFailures + 1 : 0;
  const shouldPause = failures >= FAILURE_LIMIT;

  await withTenant(ctx, async (tx) => {
    await tx.inventoryReportDelivery.create({
      data: {
        tenantId: ctx.tenantId,
        scheduleId: schedule.id,
        status: facts.status,
        trigger,
        recipients: schedule.recipients,
        rowCount: facts.rowCount,
        periodStart: facts.periodStart ?? null,
        periodEnd: facts.periodEnd ?? null,
        // The CHECK constraint requires a reason on a failure, and the honest
        // default here is better than a nullable column that silently accepts
        // "it just did not work".
        error: failed ? (facts.error ?? 'The report could not be sent') : facts.error,
      },
    });

    // A manual send does NOT move the schedule on. Pressing "send it now" to
    // check a new schedule works must not cost the recipients Monday's copy.
    const advance =
      trigger === 'scheduled'
        ? {
            nextRunAt: shouldPause
              ? null
              : nextFire(
                  {
                    cadence: schedule.cadence,
                    dayOfWeek: schedule.dayOfWeek,
                    dayOfMonth: schedule.dayOfMonth,
                    hour: schedule.hour,
                    timezone: schedule.timezone,
                  },
                  new Date()
                ),
          }
        : {};

    await tx.inventoryReportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: facts.status,
        consecutiveFailures: failures,
        ...(shouldPause ? { isActive: false } : {}),
        ...advance,
      },
    });
  });

  return {
    scheduleId: schedule.id,
    status: facts.status,
    recipients: schedule.recipients.length,
    rowCount: facts.rowCount,
    error: facts.error,
  };
}

/** The next firing time, in UTC, from the schedule's own wall clock. */
function nextFire(
  schedule: {
    cadence: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    hour: number;
    timezone: string;
  },
  after: Date
): Date {
  return computeNextRunAt(
    {
      cadence: schedule.cadence as ReportCadence,
      dayOfWeek: schedule.dayOfWeek ?? null,
      dayOfMonth: schedule.dayOfMonth ?? null,
      hour: schedule.hour,
    },
    after,
    utcOffsetMinutes(schedule.timezone, after)
  );
}

/**
 * A zone's offset from UTC at a given instant, in minutes.
 *
 * Resolved at the instant rather than held as a constant because an offset
 * changes twice a year, and a report set for 07:00 that arrives at 06:00 all
 * summer is the kind of thing nobody reports as a bug and everybody notices.
 * An unrecognised zone falls back to UTC rather than throwing: a schedule with a
 * bad timezone should still send.
 */
function utcOffsetMinutes(timezone: string, at: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(at).map((part) => [part.type, part.value])
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === '24' ? '0' : parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

function parseFilters(raw: unknown): ReportFilters {
  const parsed = ReportFilters.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

function periodOf(filters: ReportFilters): { periodStart: Date | null; periodEnd: Date | null } {
  return {
    periodStart: filters.from ? new Date(filters.from) : null,
    periodEnd: filters.to ? new Date(filters.to) : null,
  };
}

function periodLabel(from: Date, to: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${fmt.format(from)} – ${fmt.format(to)}`;
}

/** True when a summary line reports nothing at all — a zero or a "not measured".
 *  Used only to decide whether an empty report is worth sending. */
function isEmptyFigure(line: SummaryLine): boolean {
  if (line.isGap === true) return true;
  return /^(0|0 units|\$?0\.00|not measured|not recorded)$/i.test(line.value.trim());
}

/** The business's own name, which is what the email is about. Never the tenant's
 *  legal name — that is a billing fact and reads wrong in a sentence. */
async function resolveBusinessName(ctx: ServiceContext): Promise<string> {
  return withTenant(ctx, async (tx) => {
    const property = await tx.property.findFirst({
      where: { isPrimary: true },
      select: { name: true },
    });
    return property?.name ?? 'your business';
  });
}

/** Where the report lives in the workbench. A path, not an absolute URL — the
 *  worker resolves the origin, and hard-coding one here would send staging links
 *  to production inboxes. */
function reportUrlFor(reportKey: string): string {
  return `/inventory/reports?report=${encodeURIComponent(reportKey)}`;
}

function serialize(row: {
  id: string;
  reportKey: string;
  name: string;
  cadence: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  timezone: string;
  recipients: string[];
  format: string;
  filters: unknown;
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  consecutiveFailures: number;
  createdAt: Date;
}): ReportScheduleRow {
  return {
    id: row.id,
    reportKey: row.reportKey,
    reportLabel: reportDefinition(row.reportKey)?.label ?? row.reportKey,
    name: row.name,
    cadence: row.cadence,
    dayOfWeek: row.dayOfWeek,
    dayOfMonth: row.dayOfMonth,
    hour: row.hour,
    timezone: row.timezone,
    recipients: row.recipients,
    format: row.format,
    filters: parseFilters(row.filters),
    isActive: row.isActive,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus,
    consecutiveFailures: row.consecutiveFailures,
    pausedByFailures: !row.isActive && row.consecutiveFailures >= FAILURE_LIMIT,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeDelivery(row: {
  id: string;
  status: string;
  trigger: string;
  recipients: string[];
  rowCount: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  error: string | null;
  sentAt: Date;
}): ReportDeliveryRow {
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    recipients: row.recipients,
    rowCount: row.rowCount,
    periodStart: row.periodStart?.toISOString() ?? null,
    periodEnd: row.periodEnd?.toISOString() ?? null,
    error: row.error,
    sentAt: row.sentAt.toISOString(),
  };
}

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  entityId: string,
  action: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.report_schedule.${action}`,
    entityType: 'InventoryReportSchedule',
    entityId,
    diff: { after: diff },
  });
}
