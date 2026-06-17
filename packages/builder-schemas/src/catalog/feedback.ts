// Catalog · Feedback (docs/98 §5). Alerts, toasts, progress, loaders, empty states.
//
// The "tell the user what's happening" family — status surfaces skinned in OUR
// semantic tokens (info / success / warning / danger) rather than a fixed palette,
// so every surface recolors automatically with the tenant theme. Where a real
// site-ui atom exists it is composed directly (Layer 1, docs/102): the Alert,
// Progress, RadialProgress, Skeleton, and Spinner atoms carry the recipe on
// node.class, so the inspector's Color control recolors the whole component. The
// remaining entries (toast stack, tooltip, empty state, banner) stay utility
// compositions — bespoke arrangements with no single atom — still editable node by
// node, with no JS runtime.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';

// A semantic alert — the real Alert atom (st-alert), not a hand-rolled box. `tone`
// is one of our semantic roles (info/success/warning/danger) carried as the recipe
// token st-c-<tone>, so flipping the color in the inspector recolors the WHOLE
// component (the Layer-1 win, docs/102). Icon + title + body are the atom's slots.
const alert = (tone: string, icon: string, title: string, message: string) =>
  atom('Alert', `st-c-${tone} st-v-soft w-full`, { icon, title, body: message });

export const FEEDBACK_CATALOG: PlatformCatalogEntry[] = [
  // ── Alert (info) — neutral, informational notice ─────────────────────────────
  entry({
    key: 'alert_info',
    name: 'Alert — info',
    category: 'feedback',
    kind: 'common',
    icon: 'info',
    description: 'An informational notice with an icon, title, and supporting message.',
    surfaces: ['page', 'site'],
    tags: ['alert', 'info', 'notice', 'message', 'banner', 'feedback'],
    tree: alert(
      'info',
      'info',
      'Heads up',
      'Your changes are saved automatically while you edit this page.'
    ),
  }),

  // ── Alert (success) — confirms a completed action ────────────────────────────
  entry({
    key: 'alert_success',
    name: 'Alert — success',
    category: 'feedback',
    kind: 'common',
    icon: 'circle-check',
    description: 'A confirmation notice for a completed action, in the success tone.',
    surfaces: ['page', 'site'],
    tags: ['alert', 'success', 'confirm', 'done', 'complete', 'feedback'],
    tree: alert(
      'success',
      'circle-check',
      'All set',
      'Your order was placed successfully — a receipt is on its way to your inbox.'
    ),
  }),

  // ── Alert (warning) — needs attention, not yet broken ────────────────────────
  entry({
    key: 'alert_warning',
    name: 'Alert — warning',
    category: 'feedback',
    kind: 'common',
    icon: 'triangle-alert',
    description: 'A cautionary notice that flags something needing attention.',
    surfaces: ['page', 'site'],
    tags: ['alert', 'warning', 'caution', 'attention', 'feedback'],
    tree: alert(
      'warning',
      'triangle-alert',
      'Almost out of stock',
      'Only a few items remain — check out soon to avoid missing this size.'
    ),
  }),

  // ── Alert (danger) — a failure or destructive consequence ────────────────────
  // NOTE: the token is `danger`, never `error`.
  entry({
    key: 'alert_danger',
    name: 'Alert — danger',
    category: 'feedback',
    kind: 'common',
    icon: 'circle-x',
    description: 'A critical notice for a failure or destructive consequence, in the danger tone.',
    surfaces: ['page', 'site'],
    tags: ['alert', 'danger', 'error', 'failure', 'critical', 'feedback'],
    tree: alert(
      'danger',
      'circle-x',
      'Payment failed',
      'We couldn’t process your card. Update your billing details and try again.'
    ),
  }),

  // ── Toast stack — corner-anchored transient notifications ────────────────────
  // A relative demo box pins two absolute toast cards to the top-right corner —
  // the exact placement a live toast region would render into.
  entry({
    key: 'toast_stack',
    name: 'Toast stack',
    category: 'feedback',
    kind: 'common',
    icon: 'bell',
    description: 'A corner-anchored stack of transient notification cards.',
    surfaces: ['page', 'site'],
    tags: ['toast', 'snackbar', 'notification', 'stack', 'feedback'],
    tree: el('div', 'relative h-48 w-full rounded-box border border-base-200 bg-base-200/40', {
      children: [
        el('div', 'absolute right-4 top-4 z-50 flex w-72 max-w-[calc(100%-2rem)] flex-col gap-3', {
          children: [
            // Newest toast — success
            el(
              'div',
              'flex items-start gap-3 rounded-box border border-base-200 bg-base-100 p-3 shadow-lg animate-fade-up',
              {
                attrs: { role: 'status' },
                children: [
                  atom('Icon', 'mt-0.5 h-5 w-5 shrink-0 text-success', { name: 'circle-check' }),
                  el('div', 'flex flex-1 flex-col gap-0.5', {
                    children: [
                      el('p', 'text-sm font-medium text-base-content', { text: 'Saved to drafts' }),
                      el('p', 'text-xs text-base-content/60', {
                        text: 'You can publish whenever you’re ready.',
                      }),
                    ],
                  }),
                  el('span', 'cursor-pointer text-base-content/40 hover:text-base-content', {
                    text: '✕',
                  }),
                ],
              }
            ),
            // Second toast — info
            el(
              'div',
              'flex items-start gap-3 rounded-box border border-base-200 bg-base-100 p-3 shadow-lg',
              {
                attrs: { role: 'status' },
                children: [
                  atom('Icon', 'mt-0.5 h-5 w-5 shrink-0 text-info', { name: 'info' }),
                  el('div', 'flex flex-1 flex-col gap-0.5', {
                    children: [
                      el('p', 'text-sm font-medium text-base-content', { text: 'New comment' }),
                      el('p', 'text-xs text-base-content/60', {
                        text: 'Riley left a note on your homepage.',
                      }),
                    ],
                  }),
                  el('span', 'cursor-pointer text-base-content/40 hover:text-base-content', {
                    text: '✕',
                  }),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Progress bar — labeled linear track with a filled bar ────────────────────
  entry({
    key: 'progress_bar',
    name: 'Progress bar',
    category: 'feedback',
    kind: 'common',
    icon: 'loader',
    description: 'A labeled linear track that fills to show completion of a task.',
    surfaces: ['page', 'site'],
    tags: ['progress', 'bar', 'meter', 'completion', 'loading', 'feedback'],
    tree: el('div', 'flex w-full flex-col gap-2', {
      children: [
        el('div', 'flex items-center justify-between text-sm', {
          children: [
            el('span', 'font-medium text-base-content', { text: 'Uploading assets' }),
            el('span', 'text-base-content/60', { text: '65%' }),
          ],
        }),
        // The real Progress atom (st-progress) — value/max drive the fill, st-c-*
        // recolors it from the inspector. (Was a hand-rolled track + filled div.)
        atom('Progress', 'st-c-primary w-full', {
          value: '65',
          max: '100',
          label: 'Uploading assets',
        }),
      ],
    }),
  }),

  // ── Radial progress — the RadialProgress atom (st-radial) ────────────────────
  // The circular gauge is a real themed atom: value/max drive the arc, st-c-<color>
  // recolors it from the inspector. (Was a hand-rolled inline <svg> arc path.)
  entry({
    key: 'radial_progress',
    name: 'Radial progress',
    category: 'feedback',
    kind: 'common',
    icon: 'circle-dashed',
    description:
      'A circular progress gauge with a centered percentage, themed by the recipe color.',
    surfaces: ['page', 'site'],
    tags: ['progress', 'radial', 'circular', 'gauge', 'ring', 'feedback'],
    tree: atom('RadialProgress', 'st-c-primary', { value: '65', max: '100' }),
  }),

  // ── Skeleton card — shimmering placeholder while content loads ───────────────
  entry({
    key: 'skeleton_card',
    name: 'Skeleton card',
    category: 'feedback',
    kind: 'common',
    icon: 'loader-circle',
    description: 'A pulsing placeholder card that stands in for content while it loads.',
    surfaces: ['page', 'site'],
    tags: ['skeleton', 'placeholder', 'loading', 'shimmer', 'ghost', 'feedback'],
    // Each placeholder is the real Skeleton atom (st-skeleton owns the shimmer + fill);
    // className sizes it. (Was hand-rolled animate-pulse / bg-base-200 divs.)
    tree: el('div', 'w-full max-w-sm rounded-box border border-base-200 bg-base-100 p-4', {
      attrs: { ariaLabel: 'Loading' },
      children: [
        atom('Skeleton', 'mb-4 h-40 w-full', { shape: 'block' }),
        el('div', 'flex items-center gap-3', {
          children: [
            atom('Skeleton', 'h-10 w-10 shrink-0', { shape: 'circle' }),
            el('div', 'flex flex-1 flex-col gap-2', {
              children: [
                atom('Skeleton', 'h-4 w-3/4', { shape: 'block' }),
                atom('Skeleton', 'h-4 w-1/2', { shape: 'block' }),
              ],
            }),
          ],
        }),
        el('div', 'mt-4 flex flex-col gap-2', {
          children: [
            atom('Skeleton', 'h-3 w-full', { shape: 'block' }),
            atom('Skeleton', 'h-3 w-5/6', { shape: 'block' }),
          ],
        }),
      ],
    }),
  }),

  // ── Spinner — centered spinning ring loader ──────────────────────────────────
  entry({
    key: 'spinner',
    name: 'Spinner',
    category: 'feedback',
    kind: 'common',
    icon: 'loader-circle',
    description: 'A centered spinning ring that indicates an in-progress, indeterminate task.',
    surfaces: ['page', 'site'],
    tags: ['spinner', 'loader', 'loading', 'busy', 'progress', 'feedback'],
    // The real Spinner atom (st-spinner) — announces role="status" itself. (Was a
    // hand-rolled animate-spin ring.)
    tree: el('div', 'flex w-full items-center justify-center p-6', {
      children: [atom('Spinner', '', { kind: 'ring' })],
    }),
  }),

  // ── Tooltip — group-hover bubble on a trigger ────────────────────────────────
  // No JS: the trigger owns `group`, and the bubble is absolutely positioned,
  // invisible by default, revealed on `group-hover:`. A rotated square forms the
  // little arrow pointing down at the trigger.
  entry({
    key: 'tooltip',
    name: 'Tooltip',
    category: 'feedback',
    kind: 'common',
    icon: 'message-square',
    description:
      'A small label that appears above a trigger on hover, using a CSS group — no JavaScript.',
    surfaces: ['page', 'site'],
    tags: ['tooltip', 'hint', 'popover', 'hover', 'help', 'feedback'],
    tree: el('div', 'flex w-full items-center justify-center p-8', {
      children: [
        el('div', 'group relative inline-flex', {
          children: [
            atom('Button', 'st-btn st-c-neutral st-v-outline st-btn--sz-sm', { label: 'Hover me' }),
            el(
              'div',
              'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-field bg-neutral px-3 py-1.5 text-xs font-medium text-neutral-content opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100',
              {
                attrs: { role: 'tooltip' },
                children: [
                  el('span', '', { text: 'Saved 2 minutes ago' }),
                  el(
                    'span',
                    'absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-neutral',
                    {}
                  ),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Empty state — icon + heading + body + a primary action ───────────────────
  entry({
    key: 'empty_state',
    name: 'Empty state',
    category: 'feedback',
    kind: 'common',
    icon: 'inbox',
    description:
      'A centered placeholder for an empty list — icon, heading, guidance, and a primary action.',
    surfaces: ['page', 'site'],
    tags: ['empty', 'placeholder', 'no-results', 'zero', 'blank', 'feedback'],
    tree: el(
      'div',
      'flex w-full flex-col items-center justify-center gap-4 rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center',
      {
        children: [
          el('div', 'flex h-14 w-14 items-center justify-center rounded-full bg-base-200', {
            children: [atom('Icon', 'h-7 w-7 text-base-content/50', { name: 'inbox' })],
          }),
          el('div', 'flex flex-col gap-1', {
            children: [
              atom('Heading', 'text-lg font-semibold text-base-content', {
                level: 'h3',
                text: 'No results yet',
              }),
              el('p', 'mx-auto max-w-sm text-sm text-base-content/60', {
                text: 'Nothing matches your filters right now. Try broadening your search or add your first item to get started.',
              }),
            ],
          }),
          atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', {
            label: 'Add your first item',
          }),
        ],
      }
    ),
  }),

  // ── Banner CTA — full-width highlight strip with a message + action ──────────
  entry({
    key: 'banner_cta',
    name: 'Banner — call to action',
    category: 'feedback',
    kind: 'common',
    icon: 'megaphone',
    description: 'A full-width highlight banner pairing a short message with a clear action.',
    surfaces: ['page', 'site'],
    tags: ['banner', 'cta', 'announcement', 'promo', 'strip', 'feedback'],
    tree: el(
      'div',
      'flex w-full flex-col items-center gap-4 rounded-box bg-primary px-6 py-4 text-primary-content @2xl:flex-row @2xl:justify-between',
      {
        attrs: { role: 'region', ariaLabel: 'Announcement' },
        children: [
          el('div', 'flex items-center gap-3 text-center @2xl:text-left', {
            children: [
              atom('Icon', 'hidden h-6 w-6 shrink-0 @2xl:block', { name: 'sparkles' }),
              el('div', 'flex flex-col', {
                children: [
                  el('p', 'text-sm font-semibold', { text: 'Spring collection is live' }),
                  el('p', 'text-sm text-primary-content/80', {
                    text: 'Free shipping on every order through the end of the month.',
                  }),
                ],
              }),
            ],
          }),
          atom('Button', 'st-btn st-c-neutral st-v-solid st-btn--sz-sm shrink-0', {
            label: 'Shop now',
          }),
        ],
      }
    ),
  }),
];
