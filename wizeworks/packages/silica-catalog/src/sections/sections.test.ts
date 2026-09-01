// The section library, checked against the same three things that can silently break
// it once it is living in a tenant's database.
//
// A stamped section is COPIED into the page at insert and frozen at publish, so none of
// these failures can be fixed later by editing the composite — every tenant who already
// dropped the block keeps the broken version forever. That is why these are structural
// assertions over the whole library rather than spot checks on a few entries.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type ResolveHost } from '@wizeworks/silicaui-html';

import { SECTION_CATALOG } from './index';
import { SPARX_CATALOG } from '../catalog';
import { checkTreeClasses } from '../vocabulary-check';

/** Every palette item across every section group, flattened once. */
const ITEMS = SECTION_CATALOG.flatMap((group) =>
  group.items.map((item) => ({ group: group.key, ...item }))
);

/** A host that resolves nothing — these sections are static by design, so a bound ref
 *  appearing in one would show up as an unresolved marker rather than passing quietly. */
const INERT: ResolveHost = { resolveBinding: () => undefined, resolveCollection: () => undefined };

function everyNode(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as Record<string, unknown> & { children?: unknown[] };
  out.push(n);
  for (const child of n.children ?? []) everyNode(child, out);
  return out;
}

describe('the section library', () => {
  it('offers a real breadth of sections, not a token few', () => {
    // The number IS the slice. The engine ships 18 blocks — a decent spine for a
    // software marketing page and a thin one for a photographer, a restaurant or a
    // garage. This library is 71 sections on top of that; the floor is set well under
    // so a deletion has to be deliberate rather than accidental. If it ever drops back
    // toward a handful, the builder has quietly become unusable for most of the
    // businesses this platform claims to serve.
    expect(ITEMS.length).toBeGreaterThanOrEqual(60);
  });

  it('gives every item a unique key across the whole catalog', () => {
    // The key is the drag payload and the palette row's identity. A duplicate makes one
    // of the two unreachable, and which one depends on merge order — a bug that looks
    // like "that block sometimes inserts the wrong thing".
    const keys = SPARX_CATALOG.flatMap((g) => g.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every group a unique key', () => {
    const keys = SPARX_CATALOG.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('labels and explains every row', () => {
    // A palette row with no hint is a row an author has to insert to find out what it
    // is. The audience is a non-technical business owner; the hint IS the product here.
    for (const item of ITEMS) {
      expect(item.label, item.key).toBeTruthy();
      expect(item.hint, item.key).toBeTruthy();
      expect(item.hint!.length, item.key).toBeGreaterThan(20);
    }
  });

  it('uses only icon names already proven in this package', () => {
    // The curated silica icon set is UI-oriented, and an UNREGISTERED name renders an
    // empty square in the palette with no error anywhere. Restricting to names already
    // in use is the only check available from here.
    const known = new Set(['article', 'avatar', 'calendar', 'gallery', 'grid', 'image', 'layout']);
    for (const item of ITEMS) expect(known.has(item.icon), `${item.key}: ${item.icon}`).toBe(true);
  });

  it('mints a FRESH tree per call — never a shared singleton', () => {
    // A shared tree is mutated in place by id-stamping on insert, so dropping the same
    // section twice would have both copies fighting over one set of node ids.
    for (const item of ITEMS) expect(item.make(), item.key).not.toBe(item.make());
  });

  it('emits only classes the declared vocabulary covers', () => {
    // THE failure this file exists for. A class outside the vocabulary compiles while
    // it lives in this repo (the `@source` scan sees it) and emits nothing once the
    // tree is stamped into a database. No error, no warning — the section just quietly
    // loses its spacing on every site that ever used it.
    const issues: string[] = [];
    for (const item of ITEMS) {
      for (const issue of checkTreeClasses(item.make())) {
        issues.push(`${item.key}: ${issue.className} (${issue.reason}) — ${issue.hint}`);
      }
    }
    expect(issues).toEqual([]);
  });

  it('renders every section to real markup through the engine', () => {
    // Not a smoke test: a composite that returns an empty wrapper passes every check
    // above and still ships a blank band. Running the REAL `resolveTree` + `toHtml` is
    // also what catches a malformed node the authoring kit would have rejected.
    for (const item of ITEMS) {
      const html = toHtml(resolveTree(item.make(), INERT));
      expect(html.length, `${item.key} rendered almost nothing`).toBeGreaterThan(200);
    }
  });

  it('keeps the semantic tags the sections depend on', () => {
    // `toHtml` sanitises to an allowlist, and a tag that falls outside it is dropped
    // SILENTLY — the section still renders, just as a pile of divs. That would take
    // the whole point out of several of these: an opening-hours table is a table
    // because "Thursday, 8am–7pm" must be announced as a pair, and a contact form is
    // a form because otherwise it is a picture of one. A length check cannot see this.
    const rendered = (key: string): string => {
      const item = ITEMS.find((i) => i.key === key);
      if (!item) throw new Error(`no such section: ${key}`);
      return toHtml(resolveTree(item.make(), INERT));
    };
    for (const tag of ['<table', '<th', '<tr']) {
      expect(rendered('opening_hours'), tag).toContain(tag);
    }
    expect(rendered('find_us')).toContain('<address');
    for (const tag of ['<form', '<label', '<input', '<textarea']) {
      expect(rendered('enquiry_form'), tag).toContain(tag);
    }
    for (const tag of ['<dl', '<dt', '<dd']) {
      expect(rendered('glossary'), tag).toContain(tag);
    }
    expect(rendered('callout')).toContain('<aside');
    expect(rendered('how_it_works')).toContain('<ol');
    expect(rendered('gallery_grid')).toContain('<figcaption');
  });

  it('never puts a label above a heading', () => {
    // RULE #2, checked rather than trusted. The pattern is an element immediately
    // BEFORE a heading among its siblings whose text is short and title-ish — which is
    // exactly what an eyebrow is, however it is marked up.
    const offenders: string[] = [];
    const HEADING = /^h[1-6]$/;
    for (const item of ITEMS) {
      for (const node of everyNode(item.make())) {
        const children = (node.children ?? []) as Record<string, unknown>[];
        for (let i = 1; i < children.length; i += 1) {
          const here = children[i];
          const before = children[i - 1];
          if (!here || !before || typeof here !== 'object' || typeof before !== 'object') continue;
          const tag = typeof here.tag === 'string' ? here.tag : '';
          const prevTag = typeof before.tag === 'string' ? before.tag : '';
          const prevText = typeof before.text === 'string' ? before.text : '';
          // A heading preceded by a SHORT standalone bit of text is the eyebrow shape.
          // A paragraph of real copy before a heading is ordinary prose, not a kicker.
          if (HEADING.test(tag) && (prevTag === 'span' || prevTag === 'p') && prevText) {
            if (prevText.length < 30) offenders.push(`${item.key}: "${prevText}" above <${tag}>`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never fades text a visitor is meant to read', () => {
    // RULE #3. An opacity suffix on an INK utility is the move — `text-base-content/60`
    // on body copy. Border and divide opacities are legitimate and are left alone.
    const offenders: string[] = [];
    for (const item of ITEMS) {
      for (const node of everyNode(item.make())) {
        const cls = typeof node.class === 'string' ? node.class : '';
        for (const one of cls.split(/\s+/)) {
          if (/^text-[a-z0-9-]+\/\d+$/.test(one)) offenders.push(`${item.key}: ${one}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no gradient and no shadow as a visual device', () => {
    // Both are banned house-wide: gradients are the clearest AI-slop tell, and surfaces
    // here separate by edge, radius and base-tone shift rather than by floating.
    const offenders: string[] = [];
    for (const item of ITEMS) {
      for (const node of everyNode(item.make())) {
        const cls = typeof node.class === 'string' ? node.class : '';
        for (const one of cls.split(/\s+/)) {
          if (/^(bg-gradient|from-|via-|to-|shadow-)/.test(one))
            offenders.push(`${item.key}: ${one}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps body text at 16px or larger', () => {
    // The base font floor, checked the only way that is actually honest.
    //
    // COUNTING small-text nodes does not work: a gallery of six tiles has six real
    // captions, and a threshold that fails on the sixth would be measuring how many
    // cards a section has rather than whether anything is too small to read. The first
    // draft of this test did exactly that and failed a correct section.
    //
    // So two things are asserted instead, and both are unconditional:
    //   · `text-xs` never appears at all — 12px is below the floor in every context,
    //     caption or not.
    //   · every `text-sm` node carries the shared `caption()` class string verbatim.
    //     Small text can therefore only enter through the one helper whose whole
    //     purpose is text deliberately NOT competing for attention. Applying it by
    //     hand to a paragraph of body copy fails here.
    const CAPTION = 'text-sm text-base-content';
    const offenders: string[] = [];
    for (const item of ITEMS) {
      for (const node of everyNode(item.make())) {
        const cls = typeof node.class === 'string' ? node.class : '';
        if (/(^|\s)text-xs(\s|$)/.test(cls))
          offenders.push(`${item.key}: text-xs is below the floor`);
        if (/(^|\s)text-sm(\s|$)/.test(cls) && cls.trim() !== CAPTION) {
          offenders.push(`${item.key}: small text outside caption() — "${cls}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('lays out with container queries, never viewport variants', () => {
    // A `md:` class works on the published page and is invisible in the editor, because
    // the device toggle resizes an element rather than the window. An author switches to
    // Mobile, sees no change, and ships a layout they never actually checked.
    const offenders: string[] = [];
    for (const item of ITEMS) {
      for (const node of everyNode(item.make())) {
        const cls = typeof node.class === 'string' ? node.class : '';
        for (const one of cls.split(/\s+/)) {
          if (/^(sm|md|lg|xl|2xl):/.test(one)) offenders.push(`${item.key}: ${one}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── The 16px floor, on the sentences most likely to lose it ─────────────────────
//
// `_shell.ts` states the rule in its own header — "`text-sm` appears only on genuine
// captions and metadata" — and `caption()` says what a genuine one is: a photo credit,
// a unit, a footnote, "text deliberately NOT competing for attention".
//
// Eight sentences were failing it, and they share a shape: a TERM of the purchase, or
// an INSTRUCTION addressed to the reader. Delivery cost and lead time, what a price
// includes, how long a quote holds, call ahead on a holiday, tell us about allergies.
// Every one of them is something a person decides or acts on, and every one was 14px.
//
// The one that surfaced it was the enquiry form's alternative-contact line. It ships
// as "Or call … if that is quicker", which reads like small print — but the slot is
// "the other way to reach this business", and an apparel maker rewrote hers to her
// studio address and opening hours. That made the only place her site says where to
// physically go the smallest sentence on the page
// (piggles/docs/personas/issues/344).
//
// Pinned by SENTENCE rather than by scanning for `text-sm`, deliberately: a scan would
// go green the moment someone rewrote the copy, which is exactly when a type decision
// gets lost. These are the lines whose size is load-bearing.
describe('sentences a reader has to act on', () => {
  const MUST_BE_READABLE: [string, string][] = [
    ['offer_hero', 'Free delivery within 50 miles'],
    ['bundle_offer', 'Price held for 60 days'],
    ['cost_examples', 'All figures include VAT'],
    ['opening_hours', 'Holiday hours vary'],
    ['service_area', 'Outside these? Call us'],
    ['price_list', 'Prices include VAT and delivery'],
    ['menu_sections', 'Please tell us about any allergies'],
    ['enquiry_form', 'Or call '],
  ];

  const byKey = new Map(ITEMS.map((i) => [i.key, i]));

  it('covers sections that all still exist', () => {
    // A renamed section would make every assertion below vacuous — the loop would find
    // nothing to check and report nothing wrong.
    for (const [key] of MUST_BE_READABLE) {
      expect(byKey.get(key), `no section named '${key}'`).toBeDefined();
    }
  });

  it.each(MUST_BE_READABLE)('%s renders "%s" at body size', (key, phrase) => {
    const html = toHtml(resolveTree(byKey.get(key)!.make(), INERT));
    const paragraph = [...html.matchAll(/<p class="([^"]*)"[^>]*>(.*?)<\/p>/gs)].find((m) =>
      m[2]!.includes(phrase)
    );
    expect(paragraph, `'${phrase}' is not in ${key}`).toBeDefined();
    expect(paragraph![1], `${key}: "${phrase}" is set at caption size`).not.toMatch(/\btext-sm\b/);
  });
});

// Every form on the shelf has to reach a host that is listening for it.
//
// A silica <form> does its own client half — validation, FormData, the busy/success/
// error states — and then stops at a seam: it calls the host's `onAction` with the
// ref in `data-sui-action`. The storefront's handler is a chain of `if (ref === …)`.
// **A ref no branch matches is not an error.** The handler returns, the promise
// resolves, and the behavior settles the form to `success` — so the visitor's message
// is discarded and the form says it worked.
//
// That is what happened: `form()` shipped the ref `'submit'` while the storefront
// routes `'contact'`, so all four forms in this file swallowed every enquiry sent
// through them on every published site (issue 350).
//
// The routed refs are declared in `apps/site/components/silica-behaviors.tsx`, and
// `'contact'` is also named as the contract in `@wizeworks/builder-schemas`'
// `SILICA_FORM_ACTION`. This package sits under both, so the list is repeated here
// rather than imported — which is exactly why it needs a test.
describe('every form reaches a handler', () => {
  const ROUTED = new Set([
    'contact',
    'email-signup',
    'newsletter',
    'signup',
    'add-to-cart',
    'buy-now',
  ]);

  const byKey = new Map(ITEMS.map((i) => [i.key, i]));

  /** `data-sui-action` on each `<form>` in a section's rendered HTML. */
  function formActions(key: string): (string | null)[] {
    const html = toHtml(resolveTree(byKey.get(key)!.make(), INERT));
    return [...html.matchAll(/<form\b([^>]*)>/g)].map((m) => {
      const attr = /data-sui-action="([^"]*)"/.exec(m[1]!);
      return attr ? attr[1]! : null;
    });
  }

  it('routes every form in the whole section library', () => {
    // The sweep, not a list — a form added tomorrow is covered without an edit here.
    const stray: string[] = [];
    for (const item of ITEMS) {
      for (const ref of formActions(item.key)) {
        if (ref === null) stray.push(`${item.key}: <form> with no action ref at all`);
        else if (!ROUTED.has(ref)) stray.push(`${item.key}: action "${ref}" is routed nowhere`);
      }
    }
    expect(stray, stray.join('\n')).toEqual([]);
  });

  // The three that are a message TO the business go to the submissions inbox; the
  // sign-up goes to the email list. Routing the sign-up as a contact would file every
  // subscriber as an enquiry and never add the address to anything, which is a quieter
  // failure than the one this issue was about.
  it.each([
    ['enquiry_form', 'contact'],
    ['callback_form', 'contact'],
    ['quote_request', 'contact'],
    ['newsletter_signup', 'email-signup'],
  ])('%s submits as "%s"', (key, expected) => {
    expect(byKey.get(key), `no section named '${key}'`).toBeDefined();
    expect(formActions(key)).toEqual([expected]);
  });
});

// A submit the visitor can SEE the result of (issue 351).
//
// The form behavior writes its outcome into the `status` part. A form that authors
// none gets a 1x1px clipped live region built for it, which is announced to a screen
// reader and shown to nobody else — so a sighted visitor got no confirmation at all,
// their own text still sitting in the boxes, and no way to tell a delivered message
// from a lost one.
//
// Asserted on the RENDERED HTML rather than the node tree on purpose: `toHtml`
// sanitises to an attribute allowlist, and an attribute that falls outside it is
// dropped in silence. That is exactly how `fetchpriority` was lost in issue 345, and
// a status part the projection strips is the same defect wearing a fix.
describe('a submit the visitor can see the result of', () => {
  const byKey = new Map(ITEMS.map((i) => [i.key, i]));
  const FORMS = ['enquiry_form', 'callback_form', 'quote_request', 'newsletter_signup'] as const;

  it.each(FORMS)('%s renders a visible status line', (key) => {
    const html = toHtml(resolveTree(byKey.get(key)!.make(), INERT));
    const status = /<p class="([^"]*)"[^>]*data-sui-part="status"/.exec(html);
    expect(status, `${key}: no status part survived toHtml`).not.toBeNull();
    // Not the 1x1 clipped region — a real line of body-size, readable ink.
    expect(status![1]).toContain('text-base');
    expect(status![1]).toContain('empty:hidden');
    expect(html).toContain('aria-live="polite"');
  });

  it.each(FORMS)('%s says something specific when it works', (key) => {
    const html = toHtml(resolveTree(byKey.get(key)!.make(), INERT));
    const message = /data-success-message="([^"]*)"/.exec(html);
    expect(message, `${key}: no success message survived toHtml`).not.toBeNull();
    // The built-in fallback is "Submitted.", which tells a person nothing about
    // whether their question reached anyone.
    expect(message![1]).not.toBe('Submitted.');
    expect(message![1]!.length).toBeGreaterThan(20);
    // One element carries success AND failure, so the words are the only thing
    // distinguishing them — a message that does not thank anyone is not doing that job.
    expect(message![1]).toMatch(/Thank you/);
  });
});
