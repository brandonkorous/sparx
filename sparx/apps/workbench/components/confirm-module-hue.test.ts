// A confirm wears its pane's module color (sparx persona issue 179).
//
// The confirm dialog portals to the window's body, outside the pane's
// `data-module`, so `color: 'module'` resolved against the page and every
// module-colored confirm (30 of them) came out in the brand's red instead. On a
// return, "Yes, they have arrived" read like a warning. Silica's provider takes
// `popupProps` for exactly this: the pane's provider carries the pane's module.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

describe('confirm dialogs carry the pane module', () => {
  it('each mounted surface gives its confirms the pane module', () => {
    const source = read('./surface-mount.tsx');
    expect(source).toMatch(
      /<ImperativeAlertDialogProvider\s+popupProps=\{\{\s*'data-module':\s*definition\.module\s*\}\}/
    );
  });

  it('the window boundary does not add a second, colorless one in front of it', () => {
    const source = read('../lib/dock/window-boundary.tsx');
    expect(source).not.toMatch(/<ImperativeAlertDialogProvider>/);
  });
});
