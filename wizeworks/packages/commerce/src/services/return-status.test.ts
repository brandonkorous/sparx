// A return has two endings and only one of them was ever named.
//
// `exchanged` was added the day a console learned to settle a swap, and the
// guard that means "this return is finished" still listed `refunded` alone. Six
// per-transition guards happened to refuse a swapped return anyway, so nothing
// was open — but the sentence a shop read was about a state machine, and the
// goods that came back had no way onto any list (issue 452).

import { describe, expect, it } from 'vitest';

import { canRecordInspection, inspectionAdvancesStatus, isSettledReturn } from './return-status';

describe('isSettledReturn', () => {
  it('counts a swap as settled, the same as a refund', () => {
    // The customer has their replacement and nothing is owed either way. That
    // is as finished as a return gets.
    expect(isSettledReturn('exchanged')).toBe(true);
    expect(isSettledReturn('refunded')).toBe(true);
  });

  it('does not count a return that is merely back on the shelf', () => {
    for (const status of ['requested', 'approved', 'received', 'inspected', 'denied']) {
      expect(isSettledReturn(status)).toBe(false);
    }
  });

  it('does not count a cancelled return, which was never settled at all', () => {
    // Cancelled is blocked for a different reason: nothing happened. Folding it
    // in here would say a customer was paid when they were not.
    expect(isSettledReturn('cancelled')).toBe(false);
  });
});

describe('canRecordInspection', () => {
  it('still accepts the condition of goods on a settled return', () => {
    // The point of the fix. A swap settled straight from "back with you" has no
    // inspection, and the returns bench lists only inspections — so without
    // this the goods appear on no screen ever again.
    expect(canRecordInspection('exchanged')).toBe(true);
    expect(canRecordInspection('refunded')).toBe(true);
  });

  it('accepts it at the two stages it was always accepted', () => {
    expect(canRecordInspection('received')).toBe(true);
    expect(canRecordInspection('inspecting')).toBe(true);
  });

  it('refuses goods that have not arrived and goods that never will', () => {
    // Nothing is in the box yet, or nothing is coming.
    for (const status of ['requested', 'approved', 'in_transit', 'denied', 'cancelled']) {
      expect(canRecordInspection(status)).toBe(false);
    }
  });
});

describe('inspectionAdvancesStatus', () => {
  it('never walks a settled return backwards into "ready to settle"', () => {
    // Writing down what came back must not offer to pay the customer twice.
    expect(inspectionAdvancesStatus('exchanged')).toBe(false);
    expect(inspectionAdvancesStatus('refunded')).toBe(false);
  });

  it('advances an unsettled one, which is how a return reaches "checked"', () => {
    expect(inspectionAdvancesStatus('received')).toBe(true);
    expect(inspectionAdvancesStatus('inspecting')).toBe(true);
  });
});
