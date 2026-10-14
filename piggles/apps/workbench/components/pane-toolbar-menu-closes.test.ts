// Choosing an action in the ≡ menu closes the menu (sparx persona issue 254). It stayed
// open on top of the confirm box the action had just opened.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./pane-toolbar-popover.tsx', import.meta.url)),
  'utf8'
);

describe('the folded toolbar menu', () => {
  it('is controlled, so it can be closed', () => {
    expect(source).toMatch(/<Popover\s+open=\{open\}/);
  });

  it('closes when a plain button in it is pressed, wherever the screen put it', () => {
    // "Place order" and "Cancel" sit in the top zone (the screen's own
    // controls), not the action rows, so the rule is on the whole panel.
    expect(source).toContain('KEEPS_MENU_OPEN');
    expect(source).toMatch(/onClickCapture=\{closeOnAction\}/);
    expect(source).toMatch(/currentTarget\.contains\(button\)/);
  });

  it('stays open for a picker, a toggle or a nested menu', () => {
    for (const keeps of ['[aria-haspopup]', '[aria-pressed]', '[role=combobox]', '[role=switch]']) {
      expect(source).toContain(keeps);
    }
  });
});
