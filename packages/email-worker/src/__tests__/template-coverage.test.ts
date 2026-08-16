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

// The JSX-free subpaths on purpose: importing `@sparx/email` proper would pull
// React and every template into a test that needs only a list of strings and a
// bag of plain objects.
import { describe, expect, it } from 'vitest';
import { TEMPLATE_IDS } from '@sparx/email/template-ids';
import { TEMPLATE_PROPS } from '@sparx/email/template-fixtures';

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

  // ══════════════════════════════════════════════════════════════════════════
  // NAME COVERAGE IS NOT ENOUGH — THE SHAPES HAVE TO AGREE TOO
  // ══════════════════════════════════════════════════════════════════════════
  //
  // The gate and the renderer are two hand-maintained descriptions of the same
  // payload, and they can disagree in ways the tests above cannot see: an
  // `acceptUrl` typed `.url()` while the publisher sends a bare path, a field
  // the gate requires and the template treats as optional, a number where a
  // string arrives. Every one of those passes "is the template listed" and
  // still drops the email, silently, in production.
  //
  // These are the SAME objects `@sparx/email` renders in its own suite, so the
  // two ends are pinned to one description of each template.
  describe.each(TEMPLATE_IDS)('%s', (id) => {
    it('accepts the props the renderer is proven against', () => {
      const result = TemplateSendSchema.safeParse({
        template: id,
        to: 'someone@example.test',
        props: TEMPLATE_PROPS[id],
      });

      // The issues, not just "false" — a bare boolean sends the next person
      // diffing a 450-line schema against a template by eye.
      const issues = result.success
        ? []
        : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      expect(issues, `the worker would DROP a valid ${id}`).toEqual([]);
    });
  });
});
