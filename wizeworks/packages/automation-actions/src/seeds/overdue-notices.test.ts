import { describe, expect, it } from 'vitest';

import type { ResolvedFields } from '@wizeworks/automation-schemas';
import { evaluateConditions } from '@wizeworks/automation-schemas';
import type { SystemAutomationSpec } from '@wizeworks/automation';

import { B2B_INVOICE_DUE_NUDGE } from './b2b.js';
import {
  INVOICING_OVERDUE_7,
  INVOICING_OVERDUE_14,
  INVOICING_OVERDUE_30,
  INVOICING_REMINDER_3D,
} from './invoicing.js';

// Sparx persona issue 139. Every Gillett Diesel invoice is a wholesale invoice
// on terms, and none of the three overdue notices could ever send for one: each
// skipped the `net-terms-ar` ledger, and wanted `unpaid` or `partial` while the
// wholesale ladder marks a late wholesale invoice `overdue` the day it goes late.
// O'Malley Ranch, 40 days late, had never been told.

/** Whether a scheduled seed would pick this row on its daily scan. */
function picks(spec: SystemAutomationSpec, fields: ResolvedFields): boolean {
  if (spec.trigger.kind !== 'schedule') throw new Error(`${spec.key} is not scheduled`);
  return evaluateConditions(spec.trigger.predicate.where, fields);
}

/** O'Malley Ranch's 4471 as the scanner reads it, `days` late. */
const wholesale = (days: number, status = 'overdue'): ResolvedFields => ({
  'invoice.workflowSlug': 'net-terms-ar',
  'invoice.status': status,
  'invoice.overdueDays': days,
  'invoice.daysUntilDue': -days,
  'invoice.sentAt': '2026-10-06T17:19:51.181Z',
  'customer.email': 'seamus.omalley@omalleyranch.test',
});

const NOTICES = [
  [7, INVOICING_OVERDUE_7],
  [14, INVOICING_OVERDUE_14],
  [30, INVOICING_OVERDUE_30],
] as const;

describe('a wholesale invoice on terms that goes unpaid', () => {
  it.each(NOTICES)('gets the %i-day notice, marked overdue by the ladder', (days, notice) => {
    expect(picks(notice, wholesale(days))).toBe(true);
  });

  it('gets it while still unpaid, before the ladder has run that day', () => {
    expect(picks(INVOICING_OVERDUE_7, wholesale(7, 'unpaid'))).toBe(true);
  });

  it('gets each notice on its day only', () => {
    expect(picks(INVOICING_OVERDUE_7, wholesale(8))).toBe(false);
    expect(picks(INVOICING_OVERDUE_14, wholesale(7))).toBe(false);
  });

  it('is not chased once paid, or when it was never sent', () => {
    expect(picks(INVOICING_OVERDUE_7, wholesale(7, 'paid'))).toBe(false);
    expect(picks(INVOICING_OVERDUE_7, { ...wholesale(7), 'invoice.sentAt': null })).toBe(false);
  });
});

describe('the reminder before a bill is due', () => {
  // The wholesale ledger has its own "due soon" email; the general one must
  // still skip it, or a fleet gets two reminders for one bill.
  it('comes once for a wholesale invoice: from the wholesale rule only', () => {
    const dueIn3 = { ...wholesale(0, 'unpaid'), 'invoice.daysUntilDue': 3 };
    expect(picks(B2B_INVOICE_DUE_NUDGE, dueIn3)).toBe(true);
    expect(picks(INVOICING_REMINDER_3D, dueIn3)).toBe(false);
  });
});
