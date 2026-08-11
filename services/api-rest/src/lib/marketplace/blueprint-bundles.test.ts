// Guards the first-party blueprint bundles at CI time.
//
// WHY THIS SUITE EARNS ITS RUNTIME. `loadFirstPartyBlueprints` is deliberately
// all-or-nothing: one unreadable bundle aborts the whole publish, because a bundle
// that failed to load is indistinguishable from a bundle sparx withdrew, and a
// tolerant pass would retract a listing for a blueprint that is merely broken.
//
// That safety has a cost — a malformed bundle takes the catalog refresh down with
// it. This suite is what pays it: the bundles are validated in CI, so the failure
// lands on a pull request instead of on a booting pod in production.

import { describe, expect, it } from 'vitest';

import { blueprintContents, loadFirstPartyBlueprints } from './blueprint-bundles.js';

// One load for the whole suite (~700ms for 21 bundles) — the module cache makes a
// per-test reload free, but the parse work is not, and every assertion below reads
// the same objects.
const bundles = await loadFirstPartyBlueprints();

describe('first-party blueprint bundles', () => {
  it('ships a catalog', () => {
    // A zero here means the bundle tree did not resolve — the same silent "published
    // nothing, reported success" that left production's theme catalog empty for a
    // month. It must fail the build, not read as "no blueprints configured".
    expect(bundles.length).toBeGreaterThan(0);
  });

  it('every bundle validates, and its manifest agrees with its payload', () => {
    // loadFirstPartyBlueprints already throws on a schema failure, a slug mismatch,
    // a version disagreement or missing card imagery — reaching here IS the pass.
    // Asserted explicitly so the intent survives a refactor of the loader.
    for (const b of bundles) {
      expect(b.manifest.slug).toBe(b.slug);
      expect(b.blueprint.key).toBe(b.slug);
      expect(b.blueprint.version).toBe(b.manifest.version);
    }
  });

  it('has unique slugs', () => {
    // `slug` is the upsert key AND the storage path segment, so a duplicate would
    // silently overwrite rather than publish two listings.
    expect(new Set(bundles.map((b) => b.slug)).size).toBe(bundles.length);
  });

  it('ships an icon and a preview, preview first', () => {
    for (const b of bundles) {
      const kinds = b.media.map((m) => m.kind);
      expect(kinds).toContain('icon');
      expect(kinds).toContain('preview');
      // The card and the detail hero both read media[0]; an icon in that slot renders
      // a postage stamp where a screenshot belongs.
      expect(kinds[0]).toBe('preview');
      for (const m of b.media) expect(m.bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('projects contents the catalog card can render', () => {
    for (const b of bundles) {
      const c = blueprintContents(b.blueprint);
      expect(typeof c.theme).toBe('string');
      expect(typeof c.hasFrame).toBe('boolean');
      for (const key of ['products', 'categories', 'collections', 'content', 'pages', 'emails']) {
        expect(Number.isInteger(c[key])).toBe(true);
      }
    }
  });

  it('fits the catalog row columns', () => {
    for (const b of bundles) {
      // `tagline` is VarChar(255) and the publish path slices to it — assert the
      // source is already within range so nothing is silently truncated.
      expect(b.manifest.tagline.length).toBeLessThanOrEqual(255);
      expect(b.manifest.name.length).toBeLessThanOrEqual(160);
      if (b.manifest.accent) expect(b.manifest.accent.length).toBeLessThanOrEqual(9);
    }
  });
});

/**
 * A blueprint email must not name the demo business it was authored around.
 *
 * WHY EMAILS AND NOT PAGES. Placeholder prose on a page is fine — "Maeve began with two
 * chairs" is visibly someone else's story, it sits on the screen the tenant opens first,
 * and rewriting it IS the act of making the site theirs. An email is the opposite on every
 * count: it lives in a surface they may never open, it reads as finished, and the day they
 * publish it or wire it into a sequence it goes out welcoming THEIR customers to somebody
 * else's salon. The blast radius is a tenant's own mailing list, and the tenant is the last
 * to find out.
 *
 * WHAT THE PLATFORM ALREADY DOES RIGHT, and what this pins. The default emails bind
 * `{{site.name}}`, so a tenant's welcome mail says their name from the moment it exists.
 * Blueprint emails are the same surface authored by a different hand, and a hand-authored
 * heading is where a literal creeps in. This is the mechanical check that they agree.
 *
 * THE RULE IS EXACT-NAME, NOT A VIBE CHECK. Every blueprint declares
 * `brand.businessName`, so the forbidden string is derivable per bundle rather than kept as
 * a banned-words list that would rot the moment someone adds a pack. That is what makes the
 * guard survive authors it has never seen.
 */
describe('blueprint emails bind the tenant, they do not name the author', () => {
  /** Every string anywhere in an email document — a node tree of unknown depth, so
   *  a hardcoded name is found wherever it was written: a heading, a footer line, a
   *  button label, the subject. */
  function strings(value: unknown, out: string[] = []): string[] {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) for (const v of value) strings(v, out);
    else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) strings(v, out);
    }
    return out;
  }

  const withEmails = bundles.filter((b) => (b.blueprint.emails?.length ?? 0) > 0);

  it('has bundles that actually ship emails, so the checks below are not vacuous', () => {
    // Without this, deleting every email from every pack would turn the two guards
    // beneath it green — the failure mode a for-loop over an empty list always has.
    expect(withEmails.length).toBeGreaterThan(0);
  });

  it("never writes the blueprint's own business name into an email", () => {
    for (const b of withEmails) {
      const business = b.blueprint.brand?.businessName;
      if (!business) continue;
      // The themed clones all declare 'sparx' — the platform's own name, which appears
      // legitimately in slugs, keys and asset URLs throughout a bundle. Matching it would
      // report a false positive on every one of them, and a guard that cries wolf on 21
      // packs is a guard someone deletes. Those bundles are covered by the POSITIVE check
      // below instead, which is the property actually worth having.
      if (business.toLowerCase() === 'sparx') continue;
      for (const email of b.blueprint.emails ?? []) {
        for (const s of strings(email.doc)) {
          expect(
            s.includes(business),
            `${b.slug} › email "${email.name}" hardcodes the business name "${business}": ${JSON.stringify(s.slice(0, 120))}. Bind {{site.name}} instead — the installing tenant is not ${business}.`
          ).toBe(false);
        }
      }
    }
  });

  it('binds {{site.name}} in at least one email per bundle that ships them', () => {
    // The positive form, and the one that catches the case the negative check cannot: an
    // email that names no business at all is not thereby correct. "Welcome — thanks for
    // joining us" is nobody's, and a welcome mail that never says who sent it reads as
    // spam. Per BUNDLE rather than per email, because a day-3 follow-up legitimately
    // leans on the day-0 mail for identity.
    for (const b of withEmails) {
      const bound = (b.blueprint.emails ?? []).some((email) =>
        strings(email.doc).some((s) => s.includes('{{site.name}}'))
      );
      expect(
        bound,
        `${b.slug} ships ${String(b.blueprint.emails?.length ?? 0)} email(s) and none binds {{site.name}} — its recipients never learn who sent it.`
      ).toBe(true);
    }
  });

  it('ships no dead buttons — every email button links somewhere', () => {
    // The other half of the same authoring slip: a "Book appointment" button with
    // `href: ''`. It renders, it invites a click, and it goes nowhere. Cheap to assert
    // here and impossible to notice by reading a 600-line node tree.
    for (const b of withEmails) {
      for (const email of b.blueprint.emails ?? []) {
        const buttons: { label: string; href: unknown }[] = [];
        const walk = (v: unknown): void => {
          if (Array.isArray(v)) return void v.forEach(walk);
          if (!v || typeof v !== 'object') return;
          const node = v as Record<string, unknown>;
          if (node.kind === 'button') {
            // Narrowed to a string HERE rather than at the message: the label is the only
            // thing that tells an author WHICH button, and a node that lost its label to a
            // bad edit must still name itself well enough to be found.
            buttons.push({
              label: typeof node.label === 'string' ? node.label : 'unlabelled',
              href: node.href,
            });
          }
          Object.values(node).forEach(walk);
        };
        walk(email.doc);
        for (const button of buttons) {
          expect(
            typeof button.href === 'string' && button.href.trim().length > 0,
            `${b.slug} › email "${email.name}" has a button (${button.label}) with no link.`
          ).toBe(true);
        }
      }
    }
  });
});
