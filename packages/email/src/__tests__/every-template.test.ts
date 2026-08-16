// Every coded template, actually rendered.
//
// `templates.test.ts` has a case named "wraps every coded template in the shared
// frame" that renders exactly ONE template and infers the rest. Seven of the twenty
// were covered that way; the other thirteen had never been rendered by any test at
// all — so a template that threw, leaked an `undefined` into a sentence, or shipped a
// raw `{{token}}` would have been found by the customer receiving it.
//
// The point here is BREADTH, not depth: per-template assertions stay in
// `templates.test.ts`, which is the place to pin a specific string. This asserts what
// must hold for ALL of them. `CASES` is typed `Record<TemplateId, …>`, so adding a
// template to the union without adding it here fails to compile rather than shipping
// untested.

import { describe, expect, it } from 'vitest';

import {
  _renderTemplateForTest,
  _setEmailProvider,
  consoleProvider,
  resetConsoleProvider,
} from '..';
import type { TemplateId } from '../send';
import { TEMPLATE_PROPS } from '../template-fixtures';

resetConsoleProvider();
_setEmailProvider(consoleProvider);

// The props themselves live in `src/template-fixtures.ts` — email-worker parses
// the SAME objects through its delivery gate, so the renderer and the gate can
// never quietly disagree about a template's shape.
const CASES = TEMPLATE_PROPS;

const IDS = Object.keys(CASES) as TemplateId[];

describe('every coded template renders', () => {
  it.each(IDS)('%s', async (template) => {
    const out = await _renderTemplateForTest({
      template,
      to: 'someone@example.test',
      props: CASES[template],
    } as Parameters<typeof _renderTemplateForTest>[0]);

    expect(out.subject.trim(), 'subject').not.toBe('');
    expect(out.html.length, 'html').toBeGreaterThan(200);
    expect(out.text.trim(), 'text').not.toBe('');
    expect(out.templateId).toBe(template);

    // Nothing half-rendered may reach an inbox. `undefined` / `NaN` / `[object Object]`
    // are what a missing or mis-shaped prop looks like once it is inside a sentence,
    // and `{{` is a merge token nothing resolved.
    for (const body of [out.html, out.text]) {
      expect(body, 'raw merge token').not.toContain('{{');
      expect(body, 'undefined leaked').not.toMatch(/\bundefined\b/);
      expect(body, 'NaN leaked').not.toMatch(/\bNaN\b/);
      expect(body, 'object leaked').not.toContain('[object Object]');
    }
    expect(out.subject).not.toMatch(/\bundefined\b|\bNaN\b|\{\{/);

    // The shared frame is what makes it a sparx email rather than loose HTML.
    expect(out.html, 'shared frame').toContain('sparx.works');
  });

  it('has a case for every TemplateId', () => {
    // The `Record<TemplateId, …>` type catches a NEW id at compile time. This catches
    // the other direction — an id removed from the union but left behind here — and
    // pins the count so a silent drop is visible.
    expect(new Set(IDS).size).toBe(IDS.length);
    expect(IDS.length).toBe(36);
  });
});

// ── The second brand ────────────────────────────────────────────────────────
//
// WizeWorks runs two products on one platform and one email worker drains the
// queue for both. Until 2026-08-16 every coded template named exactly one of
// them — in its masthead, its footer, its subject line and its body copy — so a
// Piggles owner's password reset arrived under sparx's wordmark, signed with
// sparx's name, from "sparx <noreply@…>".
//
// The check above pins the DEFAULT rendering. This one pins the other one, and
// it is the assertion that would have failed before the fix. `platform` is
// supplied by whoever resolves the send (email-worker, from the tenant's
// `platform_brand`); here it is supplied directly.

/** Templates that name sparx because sparx is what they are ABOUT — its
 *  marketplace, its partner programme, its own job ads. A Piggles tenant never
 *  receives one: there is no Piggles marketplace to settle from and no Piggles
 *  partner programme to be welcomed to (piggles/CLAUDE.md, "A sparx PRODUCT is
 *  not a Piggles capability"). Renaming them would produce a grammatical
 *  sentence about a product nobody can sign up for, which is worse than the
 *  leak because nothing then looks wrong. */
const SPARX_OWN_PRODUCTS = new Set<TemplateId>([
  'market-settlement-report',
  'partner-welcome',
  'partner-application-received',
  'partner-earnings',
  'job-application-received',
  'job-application-confirmation',
]);

const OTHER_BRAND = {
  platform: {
    name: 'Piggles',
    url: 'https://meetpiggles.com',
    accentChars: 0,
    billingEmail: 'support@meetpiggles.com',
    appUrl: 'https://mypiggles.com',
  },
};

/**
 * Strip absolute URLs before asserting.
 *
 * Every URL in a rendered email arrives as a PROP — the caller built it with
 * `appOrigin(brand)` and it is that call's business to be right, not the
 * template's. The fixtures pass sparx URLs because the fixtures were written for
 * sparx. What is being asserted here is that the template contributes no name of
 * its own, so the two concerns are separated rather than conflated.
 */
const withoutUrls = (s: string) => s.replace(/https?:\/\/\S+/g, '');

describe('every coded template speaks as the sending brand', () => {
  const ids = IDS.filter((id) => !SPARX_OWN_PRODUCTS.has(id));

  it.each(ids)('%s names no other company', async (template) => {
    const out = await _renderTemplateForTest(
      {
        template,
        to: 'someone@example.test',
        props: CASES[template],
      } as Parameters<typeof _renderTemplateForTest>[0],
      { brand: OTHER_BRAND }
    );

    for (const body of [out.html, out.text, out.subject]) {
      expect(withoutUrls(body).toLowerCase(), 'the other brand leaked').not.toContain('sparx');
    }
  });

  it('lets the sender name the From, and keeps the address it is given', async () => {
    // One Mailgun domain serves both brands, so the ADDRESS stays sparx's until
    // Piggles has DNS of its own — a deliverability fact, not a leak. The
    // display name in front of it is presentation, and does move.
    const out = await _renderTemplateForTest(
      {
        template: 'password-reset',
        to: 'someone@example.test',
        props: CASES['password-reset'],
      } as Parameters<typeof _renderTemplateForTest>[0],
      { brand: OTHER_BRAND, from: 'Piggles <noreply@sparx.email>' }
    );

    expect(out.from).toBe('Piggles <noreply@sparx.email>');
  });

  it('puts the sending brand where the other one used to be', async () => {
    const out = await _renderTemplateForTest(
      {
        template: 'password-reset',
        to: 'someone@example.test',
        props: CASES['password-reset'],
      } as Parameters<typeof _renderTemplateForTest>[0],
      { brand: OTHER_BRAND }
    );

    // The masthead wordmark, the body copy, the subject and the footer's legal
    // line — the four places the name appears, each of which was a literal.
    expect(out.html).toContain('Piggles');
    expect(out.subject).toBe('Set your Piggles password');
    expect(out.html).toContain('meetpiggles.com');
    expect(out.html).toContain('WizeWorks'); // the operator, correct for both
  });
});
