// The delivery gate must accept every template the platform can render.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY THIS TEST EXISTS
// ══════════════════════════════════════════════════════════════════════════
//
// `TemplateSendSchema` is a hand-maintained zod union, and a template missing
// from it fails in the quietest way this system has: `parseEvent` returns null,
// `createBrokerHandler` logs one warning and ACKS the message, and the email is
// gone. The publisher saw a success. The broker saw a success. Nobody is told.
//
// Four templates lived in that state — `login-otp`, `magic-link`,
// `team-invitation` and `partner-welcome`. Each was registered in
// `@sparx/email`, listed in the events union, and published from live auth
// code. Two of them are how a person SIGNS IN, so passwordless sign-in could
// not complete and inviting a teammate delivered nothing at all. Every
// typecheck, lint and test in the repo passed throughout.
//
// A type could not have caught it: the gate is a runtime value on one side and
// a TypeScript union on the other, and nothing compared them. `TEMPLATE_IDS`
// exists so something can.

// The JSX-free subpath on purpose: importing `@sparx/email` proper would pull
// React and every template into a test that only needs a list of strings.
import { describe, expect, it } from 'vitest';
import { TEMPLATE_IDS } from '@sparx/email/template-ids';

import { TemplateSendSchema } from '../template-schema.js';

/** The `template` literal each member of the union accepts. */
const accepted = new Set(
  TemplateSendSchema.options.map((option) => {
    const shape = option.shape as { template: { value: string } };
    return shape.template.value;
  })
);

describe('email-worker accepts every template', () => {
  it('has a schema member for every TemplateId', () => {
    const missing = TEMPLATE_IDS.filter((id) => !accepted.has(id));
    // Named in the failure rather than counted, because "expected 35, got 31"
    // sends the next person hunting for which four.
    expect(missing, `templates the worker would silently DROP: ${missing.join(', ')}`).toEqual([]);
  });

  it('accepts nothing the platform cannot render', () => {
    // The other direction. A stale literal here is harmless at runtime but it
    // is a lie about what the system supports, and it makes the count useless
    // as a check.
    const known = new Set<string>(TEMPLATE_IDS);
    const orphans = [...accepted].filter((id) => !known.has(id));
    expect(orphans, `schema members with no template: ${orphans.join(', ')}`).toEqual([]);
  });
});
