import { describe, expect, it } from 'vitest';

import { evaluateConditions } from '@wizeworks/automation-schemas';

import {
  B2B_INVOICE_ISSUED_EMAIL,
  B2B_ORDER_ASK_ACCOUNT_APPROVERS,
  B2B_ORDER_HELD_TASK,
} from './b2b.js';
import { INVOICING_ESTIMATE_APPROVED_TASK } from './invoicing.js';
import { SYSTEM_AUTOMATIONS } from './index.js';

// Sparx persona issue 085. Accepting a wholesale quote places its order, an
// order on terms issues its invoice, and nobody sent the invoice or said when an
// order was held for sign-off.

describe('an invoice issued on terms', () => {
  it('is emailed to the buyer by the step that sends the Send button email', () => {
    expect(B2B_INVOICE_ISSUED_EMAIL.trigger).toEqual({
      kind: 'event',
      eventType: 'b2b.invoice.created',
    });
    expect(B2B_INVOICE_ISSUED_EMAIL.actions.map((a) => a.type)).toEqual(['b2b.send_invoice']);
    expect(
      evaluateConditions(B2B_INVOICE_ISSUED_EMAIL.conditions, { 'invoice.sentAt': null })
    ).toBe(true);
  });

  it('is not sent twice when the business already sent it by hand', () => {
    expect(
      evaluateConditions(B2B_INVOICE_ISSUED_EMAIL.conditions, {
        'invoice.sentAt': '2026-10-02T18:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('an order held for sign-off', () => {
  it('opens a task naming the order and the buyer', () => {
    expect(B2B_ORDER_HELD_TASK.trigger).toEqual({
      kind: 'event',
      eventType: 'b2b.order.pending_approval',
    });
    const title = (B2B_ORDER_HELD_TASK.actions[0]?.config as { title: string }).title;
    expect(title).toContain('{{order.number}}');
    expect(title).toContain('{{customer.fullName}}');
  });

  it('closes its task when the order stops waiting', () => {
    // The account's approver approved O-000014 on the site, the order was
    // placed, and this task stayed open telling the business to sign it.
    expect(B2B_ORDER_HELD_TASK.actions[0]).toMatchObject({
      type: 'crm.create_task',
      config: { closeWhenOrderLeaves: 'pending_approval' },
    });
  });
});

// Sparx persona issue 087. A spending limit can now be signed off by the
// account's own approver instead of the business. The business's task opened
// for those orders too, asking its team to sign what their Approve button
// refuses, and the account's approvers were told nothing at all. The fields
// are the ones `approvalFields` resolves from the event's `asks` (an old event
// with none resolves as asking the business; its own test pins that).
const ASKS_BUSINESS = { 'approval.asksBusiness': true, 'approval.asksAccount': false };
const ASKS_ACCOUNT = { 'approval.asksBusiness': false, 'approval.asksAccount': true };
const ASKS_BOTH = { 'approval.asksBusiness': true, 'approval.asksAccount': true };

describe('who a held order asks', () => {
  it('opens the business task only when the business is asked', () => {
    expect(evaluateConditions(B2B_ORDER_HELD_TASK.conditions, ASKS_BUSINESS)).toBe(true);
    expect(evaluateConditions(B2B_ORDER_HELD_TASK.conditions, ASKS_BOTH)).toBe(true);
    expect(evaluateConditions(B2B_ORDER_HELD_TASK.conditions, ASKS_ACCOUNT)).toBe(false);
  });

  it('emails the account’s approvers only when the account is asked', () => {
    expect(B2B_ORDER_ASK_ACCOUNT_APPROVERS.trigger).toEqual({
      kind: 'event',
      eventType: 'b2b.order.pending_approval',
    });
    expect(B2B_ORDER_ASK_ACCOUNT_APPROVERS.actions.map((a) => a.type)).toEqual([
      'b2b.ask_account_approvers',
    ]);
    expect(evaluateConditions(B2B_ORDER_ASK_ACCOUNT_APPROVERS.conditions, ASKS_ACCOUNT)).toBe(true);
    expect(evaluateConditions(B2B_ORDER_ASK_ACCOUNT_APPROVERS.conditions, ASKS_BOTH)).toBe(true);
    expect(evaluateConditions(B2B_ORDER_ASK_ACCOUNT_APPROVERS.conditions, ASKS_BUSINESS)).toBe(
      false
    );
  });

  it('installs the ask with the other wholesale seeds', () => {
    const entry = SYSTEM_AUTOMATIONS.find(
      (seed) => seed.spec.name === B2B_ORDER_ASK_ACCOUNT_APPROVERS.name
    );
    expect(entry?.module).toBe('b2b');
  });
});

describe('the seed set', () => {
  it('installs both, and no longer asks for a quote to be turned into an order by hand', () => {
    const names = SYSTEM_AUTOMATIONS.map((entry) => entry.spec.name);
    expect(names).toContain(B2B_INVOICE_ISSUED_EMAIL.name);
    expect(names).toContain(B2B_ORDER_HELD_TASK.name);
    expect(names).not.toContain('Quote accepted: turn it into an order');
  });

  it('keeps the generic approved task off a wholesale quote, which has no step left', () => {
    const accepted = {
      'invoice.workflowSlug': 'b2b-quotes',
      'invoice.stageType': 'committed',
      'quote.stageName': 'Accepted',
    };
    expect(evaluateConditions(INVOICING_ESTIMATE_APPROVED_TASK.conditions, accepted)).toBe(false);
    const estimate = {
      'invoice.workflowSlug': 'customer-estimates',
      'invoice.stageType': 'committed',
    };
    expect(evaluateConditions(INVOICING_ESTIMATE_APPROVED_TASK.conditions, estimate)).toBe(true);
  });
});
