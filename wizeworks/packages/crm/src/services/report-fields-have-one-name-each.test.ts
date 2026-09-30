// TWO FIELDS WITH ONE NAME, IN A PICKER.
//
// The report builder's "Broken down by" list is drawn straight from the
// compiler's field catalog. A customer had two fields labelled "Company" —
// `company_name`, whatever somebody typed on the record, and `company_id`, the
// company record it links to — so the picker showed:
//
//     Company
//     Job title
//     Owner
//     Company
//
// One of them groups two spellings of one firm as two rows and the other does
// not, and the screen gave a person no way to tell which they had picked.
//
// This scans the catalog itself rather than the screen, because the defect is
// the PAIRING and both halves are correct on their own. It asserts its own
// denominator, so a rewrite that moves the catalog cannot leave it silently
// checking nothing. [[feedback_structural_checks_go_blind]]

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), 'report-compiler.ts');

interface Field {
  object: string;
  key: string;
  label: string;
}

/**
 * Every `<key>: { column: …, kind: …, label: '…' }` in the catalog, tagged with
 * the object whose block it sits in. Read from the text because the catalog is
 * a private const and the point is to check it as written.
 */
function catalogFields(): Field[] {
  const source = readFileSync(SOURCE, 'utf8');
  const start = source.indexOf('const SOURCES: Record<string, ObjectSource> = {');
  expect(start, 'the field catalog has moved or been renamed').toBeGreaterThan(-1);

  // Each object's block runs from its own `  <key>: {` header to the next one.
  // Splitting rather than matching line by line is what makes a field whose
  // definition wraps over three lines readable — `expectedCloseDate` does, and
  // a line-at-a-time scan walked straight past it.
  // Bounded at the catalog's own closing brace. Without it the LAST object's
  // block ran to the end of the file and swallowed `CUSTOM_SPINE`, which
  // reported a duplicate "Owner" on tasks that does not exist. A scan that
  // reads past what it is scanning invents findings as readily as it misses
  // them. [[feedback_structural_checks_go_blind]]
  const end = source.indexOf('\n};', start);
  expect(end, 'the field catalog has no closing brace').toBeGreaterThan(start);
  const body = source.slice(start, end);
  const heads = [...body.matchAll(/^ {2}([a-zA-Z]+): \{\r?$/gm)];
  expect(heads.length, 'no object blocks found in the catalog').toBeGreaterThan(0);

  const out: Field[] = [];
  heads.forEach((head, i) => {
    const from = head.index;
    const to = i + 1 < heads.length ? heads[i + 1]!.index : body.length;
    const block = body.slice(from, to);
    const columns = block.indexOf('columns: {');
    if (columns === -1) return;
    for (const field of block.slice(columns).matchAll(/(\w+):\s*\{[^{}]*?label:\s*'([^']+)'/g)) {
      out.push({ object: head[1]!, key: field[1]!, label: field[2]! });
    }
  });
  return out;
}

describe('the report builder field catalog', () => {
  it('reads a field off every object it describes', () => {
    const fields = catalogFields();
    // The denominator. Five built-in objects with a dozen columns each; a scan
    // that found three fields would pass the uniqueness test below in silence.
    expect(fields.length).toBeGreaterThan(40);
    expect(new Set(fields.map((f) => f.object)).size).toBeGreaterThanOrEqual(5);
  });

  it('gives every field on one object a name of its own', () => {
    const byObject = new Map<string, Field[]>();
    for (const field of catalogFields()) {
      byObject.set(field.object, [...(byObject.get(field.object) ?? []), field]);
    }

    for (const [object, fields] of byObject) {
      const seen = new Map<string, string>();
      for (const field of fields) {
        const already = seen.get(field.label.toLowerCase());
        expect(
          already,
          `"${object}" labels both \`${already ?? ''}\` and \`${field.key}\` "${field.label}" — ` +
            'a picker cannot show the same word twice and expect anybody to choose'
        ).toBeUndefined();
        seen.set(field.label.toLowerCase(), field.key);
      }
    }
  });

  it('spells a label like words rather than like a column', () => {
    // A label carrying a `_` or an inner capital is a column name that reached
    // the screen: "assigned_rep_id", "lifecycleStage". "Website" is a label
    // that happens to match its key and is perfectly good English, which is why
    // this asks about the SHAPE of the word and not about matching the key.
    for (const field of catalogFields()) {
      expect(field.label, `the "${field.key}" field`).not.toMatch(/_|[a-z][A-Z]/);
    }
  });
});
