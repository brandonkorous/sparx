// A deal's tasks open already linked to it, and a canceled task carries no tone.
//
// MEASURED 2026-10-06 on Gillett: the task form took a `dealId`, the API filtered
// on it, and no screen ever passed one; the deal page showed no tasks at all
// (sparx persona issue 115). "Canceled" was painted `neutral`, never approved.

import { describe, expect, it } from 'vitest';

import { taskForDealParams, taskStatusMeta } from './tasks-data';

describe('taskForDealParams', () => {
  it('links the new task to the deal and to its person', () => {
    expect(
      taskForDealParams({
        id: '959d9ce5-783f-47c0-aff9-dc854b4341b0',
        customerId: 'c7d1a0b2-3e4f-4a5b-8c6d-7e8f9a0b1c2d',
      })
    ).toEqual({
      id: 'new',
      dealId: '959d9ce5-783f-47c0-aff9-dc854b4341b0',
      customerId: 'c7d1a0b2-3e4f-4a5b-8c6d-7e8f9a0b1c2d',
    });
  });

  it('links only the deal when it has no person', () => {
    expect(
      taskForDealParams({ id: '959d9ce5-783f-47c0-aff9-dc854b4341b0', customerId: null })
    ).toEqual({ id: 'new', dealId: '959d9ce5-783f-47c0-aff9-dc854b4341b0' });
  });
});

describe('taskStatusMeta', () => {
  it('gives a canceled task no tone rather than grey', () => {
    expect(taskStatusMeta('cancelled')).toEqual({ label: 'Canceled', tone: undefined });
  });
});
