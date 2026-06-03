// Emit a `.bx-canvas`-scoped variant of the compiled Surface stylesheet, for the
// Builder editor canvas (docs/47 §5).
//
// `dist/styles.css` is loaded globally by the live site (the whole document is the
// Surface world). The dashboard's Builder canvas can't load it globally: the sheet
// also carries generic Tailwind utilities (`.fixed`, `.container`, `gap-*`), a
// `:root` token block, and the `*` property defaults that would collide with the
// dashboard's own Tailwind chrome. So we wrap the WHOLE sheet in
// `@scope (.bx-canvas) { … }` — every selector then only matches inside the preview
// canvas — and retarget the `:root, :host` theme primitives to `:scope` (the canvas
// itself), since the document root sits OUTSIDE the scope and would never match.
// (`@property` + `@layer` nest cleanly inside `@scope`.)
//
// Runs as a build step after the Tailwind compile (see package.json `build`).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../dist/styles.css', import.meta.url));
const out = fileURLToPath(new URL('../dist/styles.canvas.css', import.meta.url));

const css = await readFile(src, 'utf8');
const scoped = css.replaceAll(':root, :host', ':scope');
await writeFile(out, `@scope (.bx-canvas) {\n${scoped}\n}\n`, 'utf8');

console.log('[site-ui] wrote dist/styles.canvas.css (recipe scoped to .bx-canvas)');
