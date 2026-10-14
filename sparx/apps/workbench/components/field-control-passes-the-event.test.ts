// `FieldControl render={<X … />}` clones X and merges Base UI's own
// `onChange(event)` into X's props; that handler reads `event.currentTarget.value`.
// A component of ours that names its VALUE callback `onChange` hands the merged
// handler a value instead of an event, and every keystroke throws (sparx persona
// issue 148: a segment rule's value, a custom property, a core count, a type's
// length limits). Only a real input takes `onChange` inside a FieldControl; a
// component of ours names its callback `onValueChange` and passes the event on.
// Read with the TypeScript parser, so a moved folder fails, never passes.

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(__dirname, '..');
const ROOTS = ['surfaces', 'components', 'lib', 'app'].map((dir) => path.join(APP, dir));

/** Elements whose `onChange` IS the DOM change event. */
const TAKES_THE_EVENT = new Set([
  'Input',
  'Textarea',
  'NativeSelect',
  'Checkbox',
  'input',
  'textarea',
  'select',
]);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

interface Wrapped {
  where: string;
  tag: string;
  takesOnChange: boolean;
}

function wrappedElements(): Wrapped[] {
  const found: Wrapped[] = [];
  for (const file of ROOTS.flatMap(tsxFiles)) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText(source) === 'FieldControl'
      ) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(source) !== 'render') continue;
          let value =
            attr.initializer && ts.isJsxExpression(attr.initializer)
              ? attr.initializer.expression
              : undefined;
          while (value && ts.isParenthesizedExpression(value)) value = value.expression;
          const element =
            value && ts.isJsxSelfClosingElement(value)
              ? value
              : value && ts.isJsxElement(value)
                ? value.openingElement
                : undefined;
          if (!element) continue;
          const line = source.getLineAndCharacterOfPosition(element.getStart(source)).line + 1;
          found.push({
            where: `${path.relative(APP, file)}:${line}`,
            tag: element.tagName.getText(source),
            takesOnChange: element.attributes.properties.some(
              (p) => ts.isJsxAttribute(p) && p.name.getText(source) === 'onChange'
            ),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

describe('a FieldControl hands its change event to a real input', () => {
  const wrapped = wrappedElements();

  it('reads the real screens', () => {
    for (const root of ROOTS) expect(fs.existsSync(root), root).toBe(true);
    expect(wrapped.length).toBeGreaterThan(500);
  });

  it('gives onChange only to an element whose onChange is the DOM event', () => {
    const wrong = wrapped
      .filter((w) => w.takesOnChange && !TAKES_THE_EVENT.has(w.tag))
      .map((w) => `${w.where} <${w.tag} onChange>`);
    expect(wrong).toEqual([]);
  });
});
