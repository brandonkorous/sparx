// THE REPORT BUILDER'S PICKER, IN THIS CONSOLE'S WORDS.
//
// The field catalog comes down from the API written for the other console's
// reader. `fieldWord` swaps the ones this console has already named elsewhere
// and leaves the rest alone.
//
// CATALOG is the API's answer as it stood on 2026-09-25, copied field for
// field. It is a fixture rather than a live read because the piggles workbench
// does not depend on the CRM package and should not start: what is being
// checked is that a given set of incoming labels comes out speaking Piggles,
// and that no two fields on one object end up sharing a word once they do.

import { describe, expect, it } from 'vitest';

import { RENAMED_FIELDS, fieldWord } from './report-field-words';

const CATALOG: Record<string, Record<string, string>> = {
  contact: {
    id: 'Customer',
    type: 'Kind of customer',
    lifecycleStage: 'Stage',
    leadStatus: 'Lead status',
    company: 'Company name',
    jobTitle: 'Job title',
    assignedRepId: 'Owner',
    companyId: 'Linked company',
    doNotContact: 'Do not contact',
    totalSpent: 'Lifetime spend',
    orderCount: 'Orders',
    createdAt: 'Added',
    lastOrderAt: 'Last order',
  },
  company: {
    id: 'Company',
    companyName: 'Name',
    status: 'Standing',
    website: 'Website',
    assignedRepId: 'Owner',
    pricingTierId: 'Price level',
    paymentTerms: 'Payment terms',
    creditLimit: 'Credit limit',
    creditUsed: 'Credit used',
    discountPercent: 'Discount %',
    fleetSize: 'Fleet size',
    createdAt: 'Added',
    updatedAt: 'Last changed',
  },
  deal: {
    id: 'Deal',
    title: 'Name',
    value: 'Value',
    currency: 'Currency',
    source: 'Source',
    probability: 'Probability',
    closedReason: 'Why it closed',
    stageId: 'Stage',
    pipelineId: 'Pipeline',
    assignedRepId: 'Owner',
    createdAt: 'Opened',
    closedAt: 'Closed',
    expectedCloseDate: 'Expected close',
  },
  ticket: {
    id: 'Request',
    subject: 'Subject',
    priority: 'Urgency',
    source: 'Came in by',
    stageId: 'Stage',
    assignedToUserId: 'Owner',
    createdAt: 'Opened',
    resolvedAt: 'Sorted',
    firstRespondedAt: 'First reply',
  },
  task: {
    id: 'Task',
    status: 'Status',
    priority: 'Priority',
    assignedToUserId: 'Owner',
    createdAt: 'Created',
    dueAt: 'Due',
    completedAt: 'Completed',
  },
};

/** Every field, as the picker would draw it. */
function asShown(): { object: string; key: string; label: string }[] {
  const out = [];
  for (const [object, fields] of Object.entries(CATALOG)) {
    for (const [key, label] of Object.entries(fields)) {
      out.push({ object, key, label: fieldWord(object, key, label) });
    }
  }
  return out;
}

describe('what the report builder calls a field', () => {
  it('reads the whole catalog', () => {
    // The denominator. Five objects, 55 fields; a fixture that lost an object
    // would pass every assertion below without saying so.
    expect(asShown()).toHaveLength(55);
    expect(Object.keys(CATALOG)).toHaveLength(5);
  });

  it('says step rather than stage, everywhere a step is meant', () => {
    expect(fieldWord('deal', 'stageId', 'Stage')).toBe('Step');
    expect(fieldWord('ticket', 'stageId', 'Stage')).toBe('Step');
  });

  it('never offers the words this console took off its other screens', () => {
    // "Stage", "Pipeline" and "Lead" were each removed from a pane by hand and
    // came straight back through this picker.
    const shown = asShown().map((f) => f.label.toLowerCase());
    for (const word of ['stage', 'pipeline', 'lead status', 'probability']) {
      expect(shown, `"${word}" is still on offer`).not.toContain(word);
    }
  });

  it('leaves a field alone when the API already says it plainly', () => {
    expect(fieldWord('contact', 'jobTitle', 'Job title')).toBe('Job title');
    expect(fieldWord('company', 'creditUsed', 'Credit used')).toBe('Credit used');
    expect(fieldWord('nothing-like-this', 'whatever', 'As given')).toBe('As given');
  });

  it('gives every field on one object a name of its own, after the swap', () => {
    // Renaming two fields to the same phrase would put one word twice in a
    // picker, which is the defect this act found on `company` / `companyId`
    // upstream. Renaming is exactly how it could be reintroduced here.
    for (const object of Object.keys(CATALOG)) {
      const labels = asShown()
        .filter((f) => f.object === object)
        .map((f) => f.label.toLowerCase());
      expect(new Set(labels).size, `two fields on "${object}" share a name`).toBe(labels.length);
    }
  });

  it('renames nothing the catalog does not have', () => {
    // A key that has been renamed upstream leaves a dead entry here, and a dead
    // entry is a word somebody believes is on screen and is not.
    for (const [object, fields] of Object.entries(RENAMED_FIELDS)) {
      expect(CATALOG[object], `"${object}" is not an object the builder reports on`).toBeDefined();
      for (const key of Object.keys(fields)) {
        expect(CATALOG[object]?.[key], `"${object}.${key}" is not a field any more`).toBeDefined();
      }
    }
  });
});
