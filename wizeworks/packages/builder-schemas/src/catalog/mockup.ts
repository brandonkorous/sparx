// Catalog · Mockup (docs/98 §5). Device & app chrome frames — browser, phone,
// desktop window, terminal, and a code surface.
//
// These are framing components: each renders the recognizable chrome of a surface
// (browser bar, phone notch, titlebar, terminal prompt) around a CONTENT SLOT, so
// a tenant can drop a screenshot or live composition inside and have it read as
// "this product, on a screen". The frame is the value — it's `max-w` and scales
// down to one piece of chrome on a narrow canvas; the slot inside is just an Image
// or a placeholder the tenant swaps.
//
// The browser / phone / window frames compose the REAL st-mockup-* atoms now that
// the registry exposes them (Layer 1, docs/102) — the chrome lives in the component,
// the tenant just drops content inside. The two DARK code surfaces (code_block,
// terminal) stay bespoke: their value is the per-TOKEN syntax coloring, which a
// string-based Code atom can't express. Traffic-light dots there are the one place
// literal semantic fills (`bg-danger`/`bg-warning`/`bg-success`) read as decoration.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';

// The macOS-style traffic-light cluster — three dots that read as window controls.
// Literal semantic fills here are decorative chrome, not status (see file header).
const trafficLights = () =>
  el('div', 'flex items-center gap-2', {
    children: [
      el('span', 'h-3 w-3 rounded-full bg-danger', {}),
      el('span', 'h-3 w-3 rounded-full bg-warning', {}),
      el('span', 'h-3 w-3 rounded-full bg-success', {}),
    ],
  });

// A single line of "code" — leading indent + a run of colored tokens. Authored as
// one <code> per token so a tenant can recolor any keyword/string individually.
const codeToken = (text: string, cls: string) => el('code', cls, { text });

export const MOCKUP_CATALOG: PlatformCatalogEntry[] = [
  // ── Browser window — chrome bar (dots + address pill) over a content slot ─────
  entry({
    key: 'browser_window',
    name: 'Browser window',
    category: 'mockup',
    kind: 'common',
    icon: 'app-window',
    description:
      'A browser chrome frame — window dots and an address pill above a content slot for a screenshot or live preview.',
    surfaces: ['page', 'site'],
    tags: ['browser', 'window', 'chrome', 'mockup', 'frame', 'screenshot', 'preview'],
    // The Browser atom (st-mockup-browser) renders the dots + address bar; the content
    // slot is just the screenshot the tenant swaps.
    // The address is placeholder copy the tenant overwrites with their own —
    // so it must not be a real host belonging to the platform. It read
    // `app.sparx.works`, which every tenant of every brand dropped onto their
    // own page pre-filled with one company's console URL.
    tree: atom('Browser', 'w-full max-w-3xl', { url: 'yoursite.com' }, [
      atom('Image', 'w-full', { ratio: 'wide', alt: 'Screenshot' }),
    ]),
  }),

  // ── Phone frame — thick rounded bezel, notch bar, screen slot ─────────────────
  entry({
    key: 'phone_frame',
    name: 'Phone frame',
    category: 'mockup',
    kind: 'common',
    icon: 'smartphone',
    description:
      'A phone mockup with a rounded bezel and a notch over a tall screen slot for a mobile screenshot.',
    surfaces: ['page', 'site'],
    tags: ['phone', 'mobile', 'device', 'mockup', 'frame', 'screen', 'app'],
    // The Phone atom (st-mockup-phone) renders the bezel + notch; the screen slot is
    // the portrait screenshot inside.
    tree: atom('Phone', 'mx-auto w-full max-w-[18rem]', {}, [
      atom('Image', 'w-full', { ratio: 'portrait', alt: 'App screen' }),
    ]),
  }),

  // ── Code block — dark surface, top bar (dots + filename), monospace lines ─────
  entry({
    key: 'code_block',
    name: 'Code block',
    category: 'mockup',
    kind: 'common',
    icon: 'code',
    description:
      'A dark code surface with a filename bar and syntax-colored monospace lines for sharing a snippet.',
    surfaces: ['page', 'site'],
    tags: ['code', 'snippet', 'syntax', 'mockup', 'pre', 'monospace', 'developer'],
    tree: el(
      'figure',
      'w-full max-w-2xl overflow-hidden rounded-box bg-neutral text-neutral-content shadow-lg',
      {
        children: [
          // Top bar — window dots + the current filename.
          el('div', 'flex items-center gap-3 border-b border-base-content/10 px-4 py-3', {
            children: [
              trafficLights(),
              el('span', 'font-mono text-xs text-neutral-content/60', { text: 'checkout.ts' }),
            ],
          }),
          // Source — one <pre> wrapping <code> tokens; a few keywords are recolored.
          el('pre', 'overflow-x-auto p-4 font-mono text-sm leading-relaxed', {
            children: [
              el('code', 'block', {
                children: [
                  codeToken('export async function ', 'text-info'),
                  codeToken('checkout', 'text-success'),
                  codeToken('(cart) {', 'text-neutral-content/80'),
                ],
              }),
              el('code', 'block pl-4', {
                children: [
                  codeToken('const ', 'text-info'),
                  codeToken('total', 'text-neutral-content'),
                  codeToken(' = sum(cart.items);', 'text-neutral-content/80'),
                ],
              }),
              el('code', 'block pl-4', {
                children: [
                  codeToken('return ', 'text-info'),
                  codeToken('charge', 'text-success'),
                  codeToken('(', 'text-neutral-content/80'),
                  codeToken("'usd'", 'text-warning'),
                  codeToken(', total);', 'text-neutral-content/80'),
                ],
              }),
              el('code', 'block', { text: '}' }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Window frame — generic desktop window (titlebar + title + body slot) ──────
  entry({
    key: 'window_frame',
    name: 'Window frame',
    category: 'mockup',
    kind: 'common',
    icon: 'app-window-mac',
    description:
      'A generic desktop window — traffic-light controls and a title above a flexible body slot.',
    surfaces: ['page', 'site'],
    tags: ['window', 'desktop', 'app', 'mockup', 'frame', 'titlebar', 'os'],
    // The Window atom (st-mockup-window) renders the dots + title bar; the body slot
    // holds any composition the tenant drops in.
    tree: atom('Window', 'w-full max-w-2xl', { title: 'Dashboard' }, [
      el('div', 'flex flex-col gap-3 p-6', {
        children: [
          atom('Heading', 'text-base-content', { level: 'h3', text: 'Welcome back' }),
          atom('Text', 'text-base-content', {
            variant: 'body',
            text: 'Replace this body with any layout — a chart, a form, or a screenshot.',
          }),
          el('div', 'flex gap-3', {
            children: [
              atom('Button', 'btn btn-primary btn-sm', {
                label: 'Continue',
              }),
              atom('Button', 'btn btn-neutral btn-ghost btn-sm', {
                label: 'Cancel',
              }),
            ],
          }),
        ],
      }),
    ]),
  }),

  // ── Terminal — dark shell, $ prompt, command + output, blinking cursor ────────
  entry({
    key: 'terminal_mockup',
    name: 'Terminal',
    category: 'mockup',
    kind: 'common',
    icon: 'terminal',
    description:
      'A terminal window — a shell prompt with commands, their output, and a blinking cursor.',
    surfaces: ['page', 'site'],
    tags: ['terminal', 'shell', 'console', 'cli', 'mockup', 'command', 'prompt'],
    tree: el(
      'figure',
      'w-full max-w-2xl overflow-hidden rounded-box bg-neutral text-neutral-content shadow-lg',
      {
        children: [
          // Title bar — window dots + a shell label.
          el('div', 'flex items-center gap-3 border-b border-base-content/10 px-4 py-3', {
            children: [
              trafficLights(),
              el('span', 'font-mono text-xs text-neutral-content/60', { text: 'zsh — sparx' }),
            ],
          }),
          // Transcript — prompts in <pre>; the $ and path are colored, then a cursor.
          el('pre', 'overflow-x-auto p-4 font-mono text-sm leading-relaxed', {
            children: [
              el('div', 'flex items-center gap-2', {
                children: [
                  el('span', 'text-success', { text: '➜' }),
                  el('span', 'text-info', { text: '~/sparx' }),
                  el('span', 'text-neutral-content', { text: 'pnpm build' }),
                ],
              }),
              el('div', 'text-neutral-content/60', { text: 'Compiling 7 packages…' }),
              el('div', 'flex items-center gap-2 text-success', {
                children: [
                  el('span', '', { text: '✓' }),
                  el('span', '', { text: 'Build complete in 4.2s' }),
                ],
              }),
              el('div', 'mt-1 flex items-center gap-2', {
                children: [
                  el('span', 'text-success', { text: '➜' }),
                  el('span', 'text-info', { text: '~/sparx' }),
                  // Blinking cursor — a styled block, no JS.
                  el('span', 'inline-block h-4 w-2 animate-pulse bg-neutral-content', {}),
                ],
              }),
            ],
          }),
        ],
      }
    ),
  }),
];
