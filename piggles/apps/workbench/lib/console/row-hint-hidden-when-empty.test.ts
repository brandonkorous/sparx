// "Click to open" must not be printed under a list with nothing in it.
//
// RowOpenHint teaches three gestures: click a row, shift-click to open it
// alongside, alt-click for a new window. Under an empty table that is
// instructions for rows that are not there, which reads as though the reader
// has missed something. The hint belongs to the rows, so it comes and goes
// with them.
//
// WHICH COUNT. Not the array the file maps over most often - that guess picked
// `authors` in cms/authors-list.tsx, whose table is handed `matches`, so the
// hint would have stayed up over an empty search. The count comes from
// <ListPagination shown={X}>, whose prop is documented as "Rows currently on
// screen". Same question, already answered, in the same component.
//
// Panes that hold every row in memory have no pager to borrow from, so their
// count came from the array their own empty state already tests. Either way the
// answer was in the file; none of it was inferred.
//
// Every hint in the console is now guarded, so this asserts the whole set
// rather than a subset. A hint whose condition this cannot READ counts as
// unguarded: an unreadable guard and a missing one look the same from here, and
// treating "cannot tell" as "fine" is how the other 61 stayed broken.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SURFACES = join(import.meta.dirname, '..', '..', 'surfaces');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function enclosingFunction(node: ts.Node): ts.Node | null {
  let cur: ts.Node | undefined = node.parent;
  while (cur) {
    if (ts.isFunctionDeclaration(cur) || ts.isArrowFunction(cur) || ts.isFunctionExpression(cur)) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

/** The `shown={...}` of every <ListPagination> this component renders. */
function pagerCounts(fn: ts.Node): string[] {
  const found = new Set<string>();
  const walk = (n: ts.Node): void => {
    const isPager =
      (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) &&
      n.tagName.getText() === 'ListPagination';
    if (isPager) {
      for (const attr of n.attributes.properties) {
        if (!ts.isJsxAttribute(attr)) continue;
        if (attr.name.getText() !== 'shown') continue;
        const init = attr.initializer;
        if (init && ts.isJsxExpression(init) && init.expression) {
          found.add(init.expression.getText().replace(/\s+/g, ' '));
        }
      }
    }
    n.forEachChild(walk);
  };
  fn.forEachChild(walk);
  return [...found];
}

/**
 * The condition that decides whether this node renders at all, and WHICH BRANCH
 * of it the node sits in. The branch matters: `cond ? <Empty/> : <Hint/>` and
 * `cond ? <Hint/> : <Empty/>` share a condition and mean opposite things.
 */
function controllingCondition(node: ts.Node): { text: string; negated: boolean } | null {
  let cur: ts.Node = node;
  let depth = 0;
  while (cur.parent && depth < 8) {
    const parent: ts.Node = cur.parent;
    if (ts.isConditionalExpression(parent)) {
      return { text: parent.condition.getText(), negated: parent.whenTrue !== cur };
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      parent.right === cur
    ) {
      return { text: parent.left.getText(), negated: false };
    }
    if (ts.isFunctionDeclaration(parent) || ts.isArrowFunction(parent)) return null;
    cur = parent;
    depth += 1;
  }
  return null;
}

/** Read in the branch the hint is in, does this condition mean "there are rows"? */
function meansHasRows(cond: { text: string; negated: boolean }): boolean | null {
  const text = cond.text.replace(/\s+/g, '');
  if (/\.length>0|\.length!==0|^has[A-Z]|Count>0/.test(text)) return !cond.negated;
  if (/\.length===0|\.length<1|isEmpty/.test(text)) return cond.negated;
  return null;
}

interface Hint {
  file: string;
  line: number;
  paged: boolean;
  guarded: boolean | null;
}

function collect(): { hints: Hint[]; filesScanned: number } {
  const hints: Hint[] = [];
  let filesScanned = 0;
  for (const file of tsxFiles(SURFACES)) {
    filesScanned += 1;
    const src = readFileSync(file, 'utf8');
    if (!src.includes('<RowOpenHint')) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = file
      .slice(SURFACES.length + 1)
      .split('\\')
      .join('/');
    const visit = (node: ts.Node): void => {
      const isHint =
        (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText() === 'RowOpenHint';
      if (isHint) {
        const fn = enclosingFunction(node);
        const cond = controllingCondition(node);
        hints.push({
          file: rel,
          line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          paged: fn !== null && pagerCounts(fn).length > 0,
          guarded: cond === null ? false : meansHasRows(cond),
        });
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return { hints, filesScanned };
}

describe('the open-a-row hint', () => {
  const { hints, filesScanned } = collect();

  it('scans the whole surfaces tree', () => {
    // A scan that quietly finds nothing prints the same green as a clean tree.
    expect(filesScanned).toBeGreaterThan(150);
    expect(hints.length).toBeGreaterThan(60);
  });

  it('is hidden when the list it describes is empty', () => {
    const bare = hints.filter((hint) => hint.guarded !== true);
    expect(
      bare.map((hint) => `${hint.file}:${String(hint.line)}`),
      'these print "click to open" over a list that can be empty'
    ).toEqual([]);
  });

  it('still covers the paged panes, where the pager owns the count', () => {
    // Half the hints sit under a <ListPagination shown={...}>. If that group
    // empties out, the walk has stopped finding pagers rather than the console
    // having lost its lists.
    const paged = hints.filter((hint) => hint.paged);
    expect(paged.length).toBeGreaterThan(30);
    expect(paged.every((hint) => hint.guarded === true)).toBe(true);
  });
});
