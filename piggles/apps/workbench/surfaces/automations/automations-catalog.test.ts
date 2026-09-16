// What a shop can build an automation FOR.
//
// This list is the whole vocabulary: a business cannot write a rule about
// something that is not in it, however well the platform publishes the event. So
// an event missing here is a capability that exists and cannot be reached.
//
// Returns are the case that proved it. The platform publishes six `return.*`
// events and this list carried three — the swap and the refusal, which are two of
// the three ways a return ENDS, were both absent, so a shop could not write to a
// shopper who asked for a different size or who was told no. Nor could it notice:
// nothing on the screen says an event exists but is not offered (persona issue 448).

import { describe, expect, it } from 'vitest';

import { TRIGGER_EVENTS } from './automations-catalog';

/** The return lifecycle, as published by `return-service.ts`. */
const RETURN_EVENTS = [
  'return.requested',
  'return.approved',
  'return.received',
  'return.refunded',
  'return.exchanged',
  'return.denied',
];

describe('TRIGGER_EVENTS', () => {
  it('offers every event a return publishes', () => {
    const offered = new Set(TRIGGER_EVENTS.map((t) => t.eventType));
    expect(RETURN_EVENTS.filter((ev) => !offered.has(ev))).toEqual([]);
  });

  it('names each one as something that HAPPENS, not as a status code', () => {
    // The label is what a shop owner reads in the picker. "return.exchanged" is
    // a developer's word for it; "A replacement is sent" is the thing itself.
    for (const ev of RETURN_EVENTS) {
      const found = TRIGGER_EVENTS.find((t) => t.eventType === ev);
      expect(found?.label).toBeTruthy();
      expect(found?.label).not.toContain('.');
      expect(found?.label).not.toMatch(/^return/i);
    }
  });

  it('files them all under selling, so they sit together in the picker', () => {
    for (const ev of RETURN_EVENTS) {
      expect(TRIGGER_EVENTS.find((t) => t.eventType === ev)?.module).toBe('commerce');
    }
  });

  it('lists no event twice', () => {
    const all = TRIGGER_EVENTS.map((t) => t.eventType);
    expect(new Set(all).size).toBe(all.length);
  });
});
