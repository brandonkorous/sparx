// EVERY TASK THE PLATFORM OPENS SAYS WHEN IT STOPS BEING TRUE.
//
// A task a system automation opens is a sentence about something else: "Set up
// prices and terms for Wasatch Front", "Follow up: Harbor fit-out", "Order
// O-000014 is waiting for your sign-off". Each was found open after its reason
// had gone (Wasatch on Net 30 with a $25,000 limit; O-000014 approved on the
// site), telling the owner to do something already done.
//
// So a seed that opens a task names what closes it: the order leaving a status,
// the account being set up, the deal leaving a stage type, the document moving
// on. A seed added without one goes red here, and the person adding it decides,
// in this file, why its task has no moment to close at.

import { describe, expect, it } from 'vitest';

import { SYSTEM_AUTOMATIONS } from './index.js';

const CLOSE_SETTINGS = [
  'closeWhenOrderLeaves',
  'closeWhenAccountSetUp',
  'closeWhenDealLeaves',
  'closeWhenDocumentMovesOn',
] as const;

/** Seeds whose task has nothing the platform can see close it, each with why.
 *  Empty today: every task a seed opens closes itself. */
const NO_CLOSE: Record<string, string> = {};

const taskSteps = SYSTEM_AUTOMATIONS.flatMap(({ spec }) =>
  spec.actions
    .filter((a) => a.type === 'crm.create_task')
    .map((a) => ({ key: spec.key, config: a.config }))
);

describe('every task a seed opens closes itself', () => {
  it('finds the seeds that open tasks', () => {
    // Five today. Fewer means the catalog changed shape and this went blind.
    expect(taskSteps.map((s) => s.key).sort()).toEqual(
      expect.arrayContaining([
        'b2b.new-account-setup-task',
        'b2b.order-held-sign-off-task',
        'crm.deal-won-invoice-task',
        'crm.new-lead-follow-up-task',
        'invoicing.estimate-approved-task',
      ])
    );
  });

  it('names exactly one thing that closes each', () => {
    for (const step of taskSteps) {
      if (step.key in NO_CLOSE) continue;
      const set = CLOSE_SETTINGS.filter((name) => step.config[name] !== undefined);
      expect(set, `${step.key} opens a task nothing will close`).toHaveLength(1);
    }
  });

  it('keeps no exemption for a seed that no longer opens a task', () => {
    for (const key of Object.keys(NO_CLOSE)) {
      expect(taskSteps.map((s) => s.key)).toContain(key);
    }
  });
});
