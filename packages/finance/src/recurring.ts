// Recurring costs — rent, insurance, the phone bill, three subscriptions.
//
// For most small businesses this is the majority of non-payroll operating spend
// and it is the same number every month, so asking the owner to re-type it twelve
// times a year is how the ledger goes stale by March and the profit figure
// becomes a lie.
//
// The date arithmetic below is pure and UTC-only (the columns are `DATE`, which
// has no timezone), so it is unit-tested without a database.

import { withTenant, type FinanceRecurringExpense, type TxClient } from '@sparx/db';

import { RecurringExpenseNotFoundError } from './errors';
import { upsertDerivedExpense } from './expenses';
import type { CreateRecurringInput, RecurringCadence, UpdateRecurringInput } from './schemas';

/* ── Pure date arithmetic ──────────────────────────────────────────────────── */

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the NEXT month is the last day of this one.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Step forward whole months, clamping the day to the target month's length so
 *  the 31st lands on the 28th in February without erroring. */
function stepMonths(current: Date, months: number, anchorDay: number): Date {
  const year = current.getUTCFullYear();
  const monthIndex = current.getUTCMonth() + months;
  // Normalize the month overflow before asking how long that month is.
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  return utcDate(
    targetYear,
    targetMonth,
    Math.min(anchorDay, daysInMonth(targetYear, targetMonth))
  );
}

/**
 * The occurrence after `current`.
 *
 * `anchorDay` is passed explicitly rather than read off `current` because of
 * February: a template anchored to the 31st clamps to the 28th, and reading the
 * day back off that clamped date would permanently move the template to the 28th.
 * The anchor is the intent; the clamp is only how a given month expresses it.
 */
export function advanceOccurrence(
  cadence: RecurringCadence,
  current: Date,
  anchorDay: number
): Date {
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth();
  const day = current.getUTCDate();

  switch (cadence) {
    case 'weekly':
      return utcDate(year, month, day + 7);
    case 'biweekly':
      return utcDate(year, month, day + 14);
    case 'monthly':
      return stepMonths(current, 1, anchorDay);
    case 'quarterly':
      return stepMonths(current, 3, anchorDay);
    case 'annual':
      return stepMonths(current, 12, anchorDay);
  }
}

/** The day a template's anchor falls on: its explicit `dayOfMonth`, or the day
 *  its start date happens to be. Week-based cadences ignore it entirely. */
export function anchorDayFor(template: { dayOfMonth: number | null; startsOn: Date }): number {
  return template.dayOfMonth ?? template.startsOn.getUTCDate();
}

/** The first occurrence on or after `startsOn`, honouring the month anchor. */
export function firstOccurrence(template: {
  cadence: RecurringCadence;
  dayOfMonth: number | null;
  startsOn: Date;
}): Date {
  const anchorDay = anchorDayFor(template);
  if (template.cadence === 'weekly' || template.cadence === 'biweekly') return template.startsOn;

  const year = template.startsOn.getUTCFullYear();
  const month = template.startsOn.getUTCMonth();
  const candidate = utcDate(year, month, Math.min(anchorDay, daysInMonth(year, month)));
  // An anchor that already passed this month belongs to the next one — a
  // template started on the 20th anchored to the 1st bills next month, not today.
  return candidate >= template.startsOn
    ? candidate
    : advanceOccurrence(template.cadence, candidate, anchorDay);
}

/**
 * Every occurrence from `nextRunOn` up to and including `through`.
 *
 * Returns a LIST rather than one date so a worker that missed a run — a weekend
 * outage, a paused cluster — catches every month it slept through instead of
 * silently skipping to the current one and leaving a hole in the ledger.
 *
 * Bounded by `limit` so a template with a decade-old start date cannot generate
 * 3,650 rows in one tick if its cursor is ever reset.
 */
export function occurrencesDue(
  template: {
    cadence: RecurringCadence;
    dayOfMonth: number | null;
    startsOn: Date;
    endsOn: Date | null;
    nextRunOn: Date | null;
  },
  through: Date,
  limit = 60
): Date[] {
  const anchorDay = anchorDayFor(template);
  const due: Date[] = [];
  let cursor = template.nextRunOn ?? firstOccurrence(template);

  while (cursor <= through && due.length < limit) {
    if (template.endsOn && cursor > template.endsOn) break;
    due.push(cursor);
    cursor = advanceOccurrence(template.cadence, cursor, anchorDay);
  }
  return due;
}

/** `YYYY-MM-DD`, the period half of a generated expense's idempotency key. */
export function periodKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ── CRUD ──────────────────────────────────────────────────────────────────── */

export async function listRecurring(
  tenantId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<FinanceRecurringExpense[]> {
  return withTenant({ tenantId }, (tx) =>
    tx.financeRecurringExpense.findMany({
      where: opts.includeInactive ? {} : { isActive: true },
      orderBy: [{ nextRunOn: 'asc' }, { name: 'asc' }],
    })
  );
}

export async function createRecurring(
  tenantId: string,
  input: CreateRecurringInput
): Promise<FinanceRecurringExpense> {
  const nextRunOn = firstOccurrence({
    cadence: input.cadence,
    dayOfMonth: input.dayOfMonth ?? null,
    startsOn: input.startsOn,
  });

  return withTenant({ tenantId }, (tx) =>
    tx.financeRecurringExpense.create({
      data: {
        tenantId,
        propertyId: input.propertyId ?? null,
        name: input.name,
        categoryId: input.categoryId,
        vendorId: input.vendorId ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        cadence: input.cadence,
        dayOfMonth: input.dayOfMonth ?? null,
        startsOn: input.startsOn,
        endsOn: input.endsOn ?? null,
        nextRunOn,
        autoGenerate: input.autoGenerate,
        isActive: input.isActive,
        notes: input.notes ?? null,
      },
    })
  );
}

export async function updateRecurring(
  tenantId: string,
  input: UpdateRecurringInput
): Promise<FinanceRecurringExpense> {
  const { id, ...rest } = input;
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeRecurringExpense.findUnique({ where: { id } });
    if (!existing) throw new RecurringExpenseNotFoundError(id);

    // Changing the schedule re-anchors the cursor. Without this, editing "monthly
    // on the 1st" to "monthly on the 15th" would keep billing on the 1st until
    // someone noticed — the template would say one thing and do another.
    const scheduleChanged =
      rest.cadence !== undefined || rest.dayOfMonth !== undefined || rest.startsOn !== undefined;

    const nextRunOn = scheduleChanged
      ? firstOccurrence({
          cadence: rest.cadence ?? (existing.cadence as RecurringCadence),
          dayOfMonth:
            rest.dayOfMonth !== undefined ? (rest.dayOfMonth ?? null) : existing.dayOfMonth,
          startsOn: rest.startsOn ?? existing.startsOn,
        })
      : undefined;

    return tx.financeRecurringExpense.update({
      where: { id },
      data: {
        ...(rest.propertyId !== undefined ? { propertyId: rest.propertyId ?? null } : {}),
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.categoryId !== undefined ? { categoryId: rest.categoryId } : {}),
        ...(rest.vendorId !== undefined ? { vendorId: rest.vendorId ?? null } : {}),
        ...(rest.amountCents !== undefined ? { amountCents: rest.amountCents } : {}),
        ...(rest.currency !== undefined ? { currency: rest.currency } : {}),
        ...(rest.cadence !== undefined ? { cadence: rest.cadence } : {}),
        ...(rest.dayOfMonth !== undefined ? { dayOfMonth: rest.dayOfMonth ?? null } : {}),
        ...(rest.startsOn !== undefined ? { startsOn: rest.startsOn } : {}),
        ...(rest.endsOn !== undefined ? { endsOn: rest.endsOn ?? null } : {}),
        ...(rest.autoGenerate !== undefined ? { autoGenerate: rest.autoGenerate } : {}),
        ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        ...(rest.notes !== undefined ? { notes: rest.notes ?? null } : {}),
        ...(nextRunOn ? { nextRunOn } : {}),
      },
    });
  });
}

export async function deleteRecurring(tenantId: string, id: string): Promise<void> {
  await withTenant({ tenantId }, async (tx) => {
    const existing = await tx.financeRecurringExpense.findUnique({ where: { id } });
    if (!existing) throw new RecurringExpenseNotFoundError(id);
    // A hard delete is right here: a template is an intention, not a record. The
    // expenses it already generated are the record, and they are untouched.
    await tx.financeRecurringExpense.delete({ where: { id } });
  });
}

/* ── Generation ────────────────────────────────────────────────────────────── */

export interface GenerationResult {
  templateId: string;
  generated: number;
  nextRunOn: Date | null;
}

/**
 * Generate every expense a template owes up to `through` (default: today).
 *
 * The cursor advances only after each expense commits, so a crash mid-run
 * replays rather than skipping a month. Combined with the
 * `(tenant, sourceType, sourceId)` unique on the expense, a replay is a no-op
 * update rather than a duplicate.
 *
 * `autoGenerate: false` templates are skipped here — the owner wants to see the
 * real invoice before it touches their numbers, so the surface reminds them
 * instead.
 */
export async function generateDueExpenses(
  tenantId: string,
  through: Date = new Date(),
  tx?: TxClient
): Promise<GenerationResult[]> {
  const run = async (client: TxClient): Promise<GenerationResult[]> => {
    const templates = await client.financeRecurringExpense.findMany({
      where: { isActive: true, autoGenerate: true, nextRunOn: { lte: through } },
    });

    const results: GenerationResult[] = [];

    for (const template of templates) {
      const cadence = template.cadence as RecurringCadence;
      const due = occurrencesDue({ ...template, cadence }, through);
      const anchorDay = anchorDayFor(template);

      let cursor = template.nextRunOn;
      for (const occurrence of due) {
        await upsertDerivedExpense(
          tenantId,
          'recurring',
          `${template.id}:${periodKey(occurrence)}`,
          {
            propertyId: template.propertyId,
            categoryId: template.categoryId,
            vendorId: template.vendorId,
            description: template.name,
            amountCents: template.amountCents,
            currency: template.currency,
            taxCents: 0,
            incurredAt: occurrence,
            // Generated unpaid on purpose: the template says what is OWED and
            // when, not that anyone has paid it. It lands on "Bills to pay"
            // until someone says otherwise, which is the honest default.
            paidAt: null,
            dueAt: occurrence,
            paymentMethod: null,
            reference: null,
            notes: null,
            allocations: [],
            attachmentAssetIds: [],
          },
          'recurring',
          client
        );
        cursor = advanceOccurrence(cadence, occurrence, anchorDay);
      }

      const exhausted = template.endsOn && cursor && cursor > template.endsOn;
      await client.financeRecurringExpense.update({
        where: { id: template.id },
        data: {
          nextRunOn: exhausted ? null : cursor,
          lastGeneratedOn:
            due.length > 0 ? (due[due.length - 1] ?? null) : template.lastGeneratedOn,
          ...(exhausted ? { isActive: false } : {}),
        },
      });

      results.push({
        templateId: template.id,
        generated: due.length,
        nextRunOn: exhausted ? null : cursor,
      });
    }

    return results;
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}
