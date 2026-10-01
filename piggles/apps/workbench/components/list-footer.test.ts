// THE COUNT AT THE END OF A LIST HAS TO BE READABLE.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary — which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What she saw ────────────────────────────────────────────────────────────
//
// The bottom-right corner of her Customers list, on the thirtieth of September:
//
//     38 ... total
//
// The workspace tools float in that corner, above every pane. Of a 56px
// "38 in total", 53px of the width and 11px of the 16px height were underneath
// them. Five of her lists were measured and all five read the same way.
//
// The pager fixed this for ITSELF in issue 772, on 2026-09-22, and reserved the
// room with a class keyed on the canvas. Twelve surfaces do not use the pager —
// they end with a footer row written out by hand — so there was nothing for that
// fix to travel through, and it reached none of them.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Why these tests ─────────────────────────────────────────────────────────
//
// The first group is the words, which are a pure function.
//
// The rest read SOURCE, because neither fault here can fail a type check or a
// render test. A `<p className="text-xs">` right-aligned in a flex row is valid
// TypeScript, renders perfectly, and is invisible on the only screen anybody
// looks at. The defect was a copy that did not know it was a copy, so the guard
// is against copies. [[feedback_structural_checks_go_blind]]

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { countLabel } from './list-footer-words';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, '..');
const SURFACES = join(WORKBENCH, 'surfaces');

/** A row that pushes something to each end and will not shrink — the shape that
 *  put a count in the floating tools' corner. */
const END_TO_END_ROW = new RegExp(String.raw`shrink-0[a-z0-9-\s]*justify-between`);

/** A count sentence written out by hand. `toLocaleString()` followed by a word
 *  is how all ten of them were spelled. */
const HAND_ROLLED_COUNT = new RegExp(
  String.raw`toLocaleString\(\)\}\s+(in total|to do|open|shown)`
);

/** The reserved room, spelled out. It belongs in canvas-corner and nowhere
 *  else — a second literal copy is the failure this act was about. */
const CLEARANCE_LITERAL = String.raw`[[data-canvas-tools]_&]:pe-36`;

/** Rows that push to both ends and are NOT a list footer, with the reason.
 *  Named one by one rather than loosening the pattern until it stops catching
 *  footers as well. Covers both consoles; a name that matches nothing here
 *  matches something in the other one. */
const NOT_A_FOOTER = new Set([
  // A page header, at the TOP of the page. Nothing floats up there.
  'onboarding/onboarding-layout.tsx',
]);

/** Every .tsx under surfaces/, so a new surface is scanned the day it lands
 *  rather than the day somebody remembers to add it here. */
function surfaceFiles(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const next = join(dir, entry.name);
      if (entry.isDirectory()) walk(next, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith('.tsx'))
        out.push({ name: `${prefix}${entry.name}`, text: readFileSync(next, 'utf8') });
    }
  };
  walk(SURFACES, '');
  return out;
}

function component(file: string): string {
  return readFileSync(join(WORKBENCH, 'components', file), 'utf8');
}

describe('the words a short list ends with', () => {
  it('counts everything when nothing is narrowed', () => {
    expect(countLabel({ shown: 25, total: 38, filtered: false, pending: false })).toBe(
      '38 in total'
    );
  });

  it('counts what came back when the reader has narrowed it', () => {
    // The total answers a question she stopped asking the moment she typed in
    // the search box.
    expect(countLabel({ shown: 4, total: 38, filtered: true, pending: false })).toBe('4 shown');
  });

  it('lets the surface name its own rows', () => {
    expect(countLabel({ shown: 3, total: 3, filtered: false, pending: false, noun: 'to do' })).toBe(
      '3 to do'
    );
    expect(countLabel({ shown: 3, total: 3, filtered: false, pending: false, noun: 'open' })).toBe(
      '3 open'
    );
  });

  it('says nothing while the answer is still coming', () => {
    // Not "0 in total". A count nobody has measured must never render as one.
    // [[feedback_never_present_absence_as_measurement]]
    expect(countLabel({ shown: 0, total: 38, filtered: false, pending: true })).toBeNull();
    expect(countLabel({ shown: 0, total: undefined, filtered: false, pending: false })).toBeNull();
  });

  it('groups the thousands, because a five-figure count is unreadable without it', () => {
    expect(countLabel({ shown: 50, total: 12400, filtered: false, pending: false })).toBe(
      '12,400 in total'
    );
  });

  it('still answers zero, which IS a measurement', () => {
    expect(countLabel({ shown: 0, total: 0, filtered: false, pending: false })).toBe('0 in total');
  });
});

describe('nothing stands in the floating tools corner', () => {
  it('scans a real tree', () => {
    // A check that hard-codes a path is one refactor away from scanning nothing
    // and printing green. [[feedback_structural_checks_go_blind]]
    expect(surfaceFiles().length).toBeGreaterThan(200);
  });

  it('makes every end-to-end footer row reserve the corner', () => {
    const guilty = surfaceFiles()
      .filter((f) => END_TO_END_ROW.test(f.text))
      .filter((f) => !NOT_A_FOOTER.has(f.name))
      .filter((f) => !f.text.includes('CANVAS_CORNER_CLEARANCE'))
      .map((f) => f.name);
    expect(
      guilty,
      'these surfaces end with a row that pushes something into the corner the ' +
        'workspace tools float in. Use <ListFooter>, or reserve the room with ' +
        'CANVAS_CORNER_CLEARANCE if the row is a pager of its own'
    ).toEqual([]);
  });

  it('leaves the count sentence to countLabel', () => {
    const guilty = surfaceFiles()
      .filter((f) => HAND_ROLLED_COUNT.test(f.text))
      .map((f) => f.name);
    expect(
      guilty,
      'these surfaces word their own row count — use countLabel, so "in total" ' +
        'and "to do" stay one decision rather than ten'
    ).toEqual([]);
  });
});

describe('the reserved corner is described once', () => {
  it('is spelled out in canvas-corner and nowhere else', () => {
    expect(component('canvas-corner.ts')).toContain(CLEARANCE_LITERAL);
    const copies = surfaceFiles()
      .filter((f) => f.text.includes(CLEARANCE_LITERAL))
      .map((f) => f.name);
    expect(copies, 'the clearance class is spelled out in a surface again').toEqual([]);
  });

  it('is what BOTH footers reserve', () => {
    // Both, together. The pager had it and the plain footer did not, which is
    // the entire defect: one of the two was never going to fail on its own.
    for (const file of ['list-footer.tsx', 'list-pagination.tsx']) {
      expect(component(file), `${file} no longer reserves room for the tools`).toMatch(
        new RegExp(String.raw`\$\{CANVAS_CORNER_CLEARANCE\}`)
      );
    }
  });

  it('is put ON the count, not merely imported beside it', () => {
    // A leftover import satisfies a name-only check. The class has to reach the
    // element standing in the corner. [[feedback_a_test_that_cannot_go_red]]
    expect(component('list-footer.tsx')).toMatch(
      new RegExp(String.raw`shrink-0 text-sm \$\{CANVAS_CORNER_CLEARANCE\}`)
    );
  });
});

describe('the count clears the caption floor', () => {
  it('is set at 14px, the same as the hint beside it', () => {
    // It was `text-xs`, 12px, on the same line as a hint that had already been
    // lifted off that floor. [[feedback_base_font_size_16px]]
    // The LINE that renders it, never the whole file: the comment two lines up
    // names the old class while explaining what went wrong, and a guard that
    // reads prose instead of markup goes red over a corrected sentence.
    const line = component('list-footer.tsx')
      .split('\n')
      .find((l) => l.includes('<Text className='));
    expect(line, 'the count is no longer a <Text>').toBeDefined();
    expect(line).toContain('text-sm');
    expect(line).not.toContain('text-xs');
  });
});
