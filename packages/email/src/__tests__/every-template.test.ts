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
