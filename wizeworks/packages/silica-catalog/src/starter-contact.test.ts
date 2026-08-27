// The guard for a contact detail that LOOKS like the business typed it.
//
// `sections/_contact-fields.ts` was written to close exactly this: the palette's
// "Find us" and "Contact strip" shipped a real-looking phone number and street,
// so a business that placed one and did not notice published somebody else's
// details. It closed those two and nothing stopped it re-opening — the starter's
// own Contact page went on shipping a `mailto:hello@example.com` button, and the
// enquiry form went on printing "Or call (555) 123-4567" as prose (issue 265).
//
// The starter is the strict case, because it is the one thing that lands on a
// live site without the owner choosing it. So: nothing the starter installs may
// carry a literal address, phone or `mailto:`/`tel:` — every one has to come
// from `site.identity.*`, which means it is the owner's or it is not there.

import { describe, expect, it } from 'vitest';

import { starterFrame, starterPages } from './site';

/** Details that read as a real business's, wherever they appear. */
const LITERALS: Array<{ what: string; re: RegExp }> = [
  { what: 'an email address', re: /[\w.+-]+@[\w-]+\.[\w.]+/ },
  { what: 'a mailto: or tel: link', re: /^(mailto|tel):/i },
  { what: 'a phone number', re: /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/ },
];

/** Every string the starter would render or link to — text and attribute alike. */
function strings(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { text?: string; attrs?: Record<string, unknown>; children?: unknown[] };
  if (typeof n.text === 'string') out.push(n.text);
  for (const value of Object.values(n.attrs ?? {})) {
    if (typeof value === 'string') out.push(value);
  }
  for (const c of n.children ?? []) strings(c, out);
  return out;
}

/** What a literal in `value` would look like to a visitor, named. */
function offence(value: string): string | null {
  for (const { what, re } of LITERALS) {
    if (re.test(value)) return `${what}: ${JSON.stringify(value)}`;
  }
  return null;
}

describe('the starter never ships someone else’s contact details', () => {
  const configs = [
    { label: 'commerce + cms + scheduling', opts: { cmsEnabled: true, schedulingEnabled: true } },
    { label: 'content only', opts: { commerceEnabled: false, cmsEnabled: true } },
  ];

  for (const { label, opts } of configs) {
    it(`installs no literal address, phone or mailto (${label})`, () => {
      for (const page of starterPages(opts)) {
        const bad = strings(page.root).map(offence).filter(Boolean);
        expect(
          bad,
          `page "${page.name}" installs ${bad.join('; ')} — bind it to site.identity ` +
            `instead, so it is the owner's or it is absent`
        ).toEqual([]);
      }
    });

    it(`puts none in the header or footer either (${label})`, () => {
      const bad = strings(starterFrame(opts).root).map(offence).filter(Boolean);
      expect(bad, `the starter frame carries ${bad.join('; ')}`).toEqual([]);
    });
  }
});
