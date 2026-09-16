// Every way a return can END must reach the shopper.
//
// This is a manifest test, and it exists because of the shape it caught. A return
// finishes in one of three ways — the money goes back, a replacement goes out, or
// the answer is no — and only the FIRST used to send anything:
//
//   - `return.exchanged` was published by the service and consumed by nothing.
//   - `return.denied` was not published at all.
//
// Both silences had console copy over them claiming otherwise. The shipped
// "we've received your return" email ends *"we'll email you again the moment your
// exchange is on its way"*, and the "Turn down this return" box says *"they are
// told the reason you give here"*. So a shopper who asked for a different size
// was promised an email that did not exist, and a shopper who was refused was
// told nothing while the shop believed otherwise (persona issue 448).
//
// Four of the six return events were wired and two were not, which is why this
// asserts the WHOLE lifecycle rather than the rows that happen to exist. Adding a
// seventh `return.*` event means adding it here on purpose.

import { describe, expect, it } from 'vitest';

import { DEFAULT_EMAIL_TEMPLATES } from '@wizeworks/builder-schemas';

import { SYSTEM_AUTOMATIONS } from './index.js';

/** The return lifecycle, as published by `return-service.ts`. */
const RETURN_EVENTS = [
  'return.requested',
  'return.approved',
  'return.received',
  'return.refunded',
  'return.exchanged',
  'return.denied',
] as const;

/** The three ways a return ENDS. Each one is the last thing a shopper hears. */
const ENDINGS = ['return.refunded', 'return.exchanged', 'return.denied'] as const;

const seedsFor = (eventType: string) =>
  SYSTEM_AUTOMATIONS.filter(
    (seed) => seed.spec.trigger.kind === 'event' && seed.spec.trigger.eventType === eventType
  );

describe('return lifecycle seeds', () => {
  it('ships a seed for every event a return publishes', () => {
    const missing = RETURN_EVENTS.filter((ev) => seedsFor(ev).length === 0);
    expect(missing).toEqual([]);
  });

  it('writes to the CUSTOMER at every ending, not just the money one', () => {
    // `return.requested` is the exception and stays one: it is a staff alert,
    // because at that point nobody has decided anything to tell the shopper.
    const silent = ENDINGS.filter(
      (ev) =>
        !seedsFor(ev).some((seed) =>
          seed.spec.actions.some((action) => action.type === 'email.send_campaign')
        )
    );
    expect(silent).toEqual([]);
  });

  it('points every return email at a template that actually exists', () => {
    // The half a seed cannot prove on its own: a `builderEmailKey` naming a
    // template nobody shipped enqueues a send that resolves to nothing.
    const keys = new Set(DEFAULT_EMAIL_TEMPLATES.map((t) => t.key));
    const dangling: string[] = [];
    for (const ev of RETURN_EVENTS) {
      for (const seed of seedsFor(ev)) {
        for (const action of seed.spec.actions) {
          const cfg = action.config as { builderEmailKey?: string } | undefined;
          if (cfg?.builderEmailKey && !keys.has(cfg.builderEmailKey)) {
            dangling.push(`${ev} → ${cfg.builderEmailKey}`);
          }
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it('guards each send on an address, so a shopper with no email is skipped', () => {
    for (const ev of ENDINGS) {
      for (const seed of seedsFor(ev)) {
        const fields = seed.spec.conditions.conditions.map((c: unknown) =>
          c !== null && typeof c === 'object' && 'field' in c ? String(c.field) : ''
        );
        expect(fields).toContain('customer.email');
      }
    }
  });
});
