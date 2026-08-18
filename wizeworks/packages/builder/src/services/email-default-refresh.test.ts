// The refresh safety net (docs/120): a default row is re-designed to the current
// shipped body ONLY while it's still the untouched shipped default — the moment a
// tenant edits it, its fingerprint changes and it's left alone forever. These tests
// pin the two properties that make that safe: the fingerprint ignores node ids (so
// every tenant provisioned from the same code matches), and it does NOT ignore content
// (so a one-word edit is no longer recognised as the default).

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_TEMPLATES,
  getDefaultEmailTemplate,
  type SilicaEmailDocument,
} from '@wizeworks/builder-schemas';

import {
  PRIOR_DEFAULT_BODY_FINGERPRINTS,
  bodyFingerprint,
  isPriorDefaultBody,
} from './email-default-refresh';
// The pre-redesign bodies, captured from the shipped code they replaced — the ground
// truth for "an untouched old row is recognised; an edited one is not".
import oldFixtures from './email-default-refresh.fixture.json';

const oldDoc = (key: keyof typeof oldFixtures): SilicaEmailDocument =>
  structuredClone(oldFixtures[key]) as unknown as SilicaEmailDocument;

/** Re-mint every `id` in a document, simulating a different tenant's provisioning. */
function remintIds(node: unknown, n = { i: 0 }): void {
  if (Array.isArray(node)) {
    node.forEach((c) => remintIds(c, n));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === 'string') obj.id = `reminted-${(n.i += 1)}`;
    for (const v of Object.values(obj)) remintIds(v, n);
  }
}

describe('email default refresh fingerprints', () => {
  it('every shipped default key is ACCOUNTED FOR in the prior-fingerprint map', () => {
    // Presence is the checklist — nobody ships a template without deciding what
    // its prior bodies are. The set may legitimately be EMPTY: a template that
    // has only ever had one design has nothing to roll a pristine row forward
    // from, and its CURRENT fingerprint must not go in (the idempotence test
    // below is what that would break). So `undefined` is an oversight and an
    // empty set is a decision, and only the first one fails here.
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      expect(PRIOR_DEFAULT_BODY_FINGERPRINTS[t.key], t.key).toBeDefined();
    }
  });

  it('a redesigned template keeps every historical body — sets only grow', () => {
    // The templates that predate the 2026-07-26 redesign each carry at least one
    // prior body. This is the half of the old assertion worth keeping: it catches
    // a fingerprint being REMOVED from a set, which would silently strand every
    // tenant still on that version.
    const redesigned = DEFAULT_EMAIL_TEMPLATES.filter(
      (t) => (PRIOR_DEFAULT_BODY_FINGERPRINTS[t.key]?.size ?? 0) > 0
    );
    expect(redesigned.length).toBeGreaterThan(30);
  });

  it('the fingerprint ignores node ids — every tenant hashes the same', () => {
    const doc = oldDoc('order-confirmation');
    const before = bodyFingerprint(doc);
    remintIds(doc.root);
    expect(bodyFingerprint(doc)).toBe(before);
  });

  it('recognises an untouched prior default body', () => {
    expect(isPriorDefaultBody('welcome-customer', oldDoc('welcome-customer'))).toBe(true);
    expect(isPriorDefaultBody('order-confirmation', oldDoc('order-confirmation'))).toBe(true);
  });

  it('does NOT recognise an edited body — the never-clobber guarantee', () => {
    const edited = oldDoc('welcome-customer');
    // A tenant changes a single word of the heading.
    const heading = edited.root.children[0] as unknown as {
      children: { html: string }[];
    };
    const first = heading.children[0]!;
    first.html = first.html.replace('Welcome', 'Howdy');
    expect(isPriorDefaultBody('welcome-customer', edited)).toBe(false);
  });

  it('does NOT recognise the CURRENT shipped design as prior — the refresh is idempotent', () => {
    // If a current body's fingerprint were in the prior set, the refresh would keep
    // "re-designing" a row that's already current. It must not be.
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const def = getDefaultEmailTemplate(t.key);
      expect(def, t.key).toBeTruthy();
      expect(isPriorDefaultBody(t.key, def!.doc), t.key).toBe(false);
    }
  });

  it('treats a null document (unrepaired legacy row) as not-a-default', () => {
    expect(isPriorDefaultBody('welcome-customer', null)).toBe(false);
  });
});
