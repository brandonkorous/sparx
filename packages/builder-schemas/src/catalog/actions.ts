// Catalog · Actions (docs/98 §5). Buttons, button groups, dropdowns, toggles.
//
// The action family is where the recipe class earns its keep: every button is a
// raw `Button` atom wearing `st-btn st-c-<color> st-v-<treatment> st-btn--sz-<sz>`
// — color × variant × size as separate axes, never a flat enum (cf. docs/35). A
// "split button" or "button group" is then just composition: join the recipe
// buttons in a flex row, share a border, and the segmented control falls out for
// free. Disclosure (dropdown / split caret) is native <details>; the swap toggle
// is a peer checkbox — no behavior runtime required.

import { el, atom, entry, type PlatformCatalogEntry } from './_kit';

// A link styled as an item inside a dropdown panel.
const menuLink = (label: string, href: string) =>
  el('a', 'rounded-field px-3 py-2 text-sm text-base-content hover:bg-base-200', {
    text: label,
    attrs: { href },
  });

export const ACTIONS_CATALOG: PlatformCatalogEntry[] = [
  // ── Dropdown — native <details> disclosure, absolute panel ────────────────────
  entry({
    key: 'dropdown',
    name: 'Dropdown',
    category: 'actions',
    kind: 'common',
    icon: 'chevron-down',
    description:
      'A trigger button that reveals a panel of links — CSS-native disclosure, no script. Closes when focus leaves.',
    surfaces: ['page', 'site'],
    tags: ['dropdown', 'menu', 'disclosure', 'popover', 'actions'],
    tree: el('details', 'relative inline-block', {
      children: [
        el(
          'summary',
          'st-btn st-c-neutral st-v-outline st-btn--sz-md flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden',
          {
            children: [
              el('span', '', { text: 'Options' }),
              atom('Icon', 'h-4 w-4', { name: 'chevron-down' }),
            ],
          }
        ),
        el(
          'div',
          'absolute left-0 top-full z-40 mt-2 flex w-52 flex-col gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg',
          {
            children: [
              menuLink('View details', '#'),
              menuLink('Duplicate', '#'),
              menuLink('Move to…', '#'),
              el('hr', 'my-1 border-base-200'),
              el('a', 'rounded-field px-3 py-2 text-sm text-danger hover:bg-danger/10', {
                text: 'Delete',
                attrs: { href: '#' },
              }),
            ],
          }
        ),
      ],
    }),
  }),

  // ── Button group — joined / segmented buttons sharing a border ────────────────
  entry({
    key: 'button_group',
    name: 'Button group',
    category: 'actions',
    kind: 'common',
    icon: 'rows-3',
    description:
      'A joined row of related buttons that read as one segmented control — first and last ends rounded, inner seams shared.',
    surfaces: ['page', 'site'],
    tags: ['button group', 'segmented', 'joined', 'toolbar', 'actions'],
    tree: el('div', 'inline-flex items-center rounded-field shadow-sm', {
      attrs: { role: 'group', ariaLabel: 'View mode' },
      children: [
        el(
          'button',
          'flex items-center gap-2 rounded-l-field border border-base-300 bg-primary px-4 py-2 text-sm font-medium text-primary-content',
          {
            attrs: { type: 'button' },
            children: [
              atom('Icon', 'h-4 w-4', { name: 'layout-grid' }),
              el('span', '', { text: 'Grid' }),
            ],
          }
        ),
        el(
          'button',
          '-ml-px flex items-center gap-2 border border-base-300 bg-base-100 px-4 py-2 text-sm font-medium text-base-content hover:bg-base-200',
          {
            attrs: { type: 'button' },
            children: [atom('Icon', 'h-4 w-4', { name: 'list' }), el('span', '', { text: 'List' })],
          }
        ),
        el(
          'button',
          '-ml-px flex items-center gap-2 rounded-r-field border border-base-300 bg-base-100 px-4 py-2 text-sm font-medium text-base-content hover:bg-base-200',
          {
            attrs: { type: 'button' },
            children: [
              atom('Icon', 'h-4 w-4', { name: 'table' }),
              el('span', '', { text: 'Table' }),
            ],
          }
        ),
      ],
    }),
  }),

  // ── Split button — primary action joined to a dropdown caret ──────────────────
  entry({
    key: 'split_button',
    name: 'Split button',
    category: 'actions',
    kind: 'common',
    icon: 'square-chevron-down',
    description:
      'A primary action joined to a small caret that opens secondary actions — one default tap, a menu for the rest.',
    surfaces: ['page', 'site'],
    tags: ['split button', 'dropdown', 'action', 'menu', 'actions'],
    tree: el('div', 'inline-flex items-center rounded-field shadow-sm', {
      children: [
        el(
          'button',
          'rounded-l-field bg-primary px-4 py-2 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90',
          { text: 'Save changes', attrs: { type: 'button' } }
        ),
        el('details', 'relative', {
          children: [
            el(
              'summary',
              'flex cursor-pointer list-none items-center rounded-r-field border-l border-primary-content/20 bg-primary px-2 py-2 text-primary-content transition-colors hover:bg-primary/90 [&::-webkit-details-marker]:hidden',
              {
                attrs: { ariaLabel: 'More save options' },
                children: [atom('Icon', 'h-4 w-4', { name: 'chevron-down' })],
              }
            ),
            el(
              'div',
              'absolute right-0 top-full z-40 mt-2 flex w-56 flex-col gap-1 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg',
              {
                children: [
                  menuLink('Save and continue', '#'),
                  menuLink('Save as draft', '#'),
                  menuLink('Save as template', '#'),
                ],
              }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Button toolbar — a bar of mixed actions (primary + ghost + icon) ──────────
  entry({
    key: 'button_toolbar',
    name: 'Button toolbar',
    category: 'actions',
    kind: 'common',
    icon: 'wrench',
    description:
      'A horizontal action bar mixing a primary call-to-action with secondary and icon-only controls. Wraps on narrow containers.',
    surfaces: ['page', 'site'],
    tags: ['toolbar', 'actions', 'bar', 'buttons', 'controls'],
    tree: el('div', 'flex w-full flex-wrap items-center gap-3', {
      attrs: { role: 'toolbar', ariaLabel: 'Document actions' },
      children: [
        atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-md', { label: 'Publish' }),
        atom('Button', 'st-btn st-c-neutral st-v-outline st-btn--sz-md', { label: 'Preview' }),
        atom('Button', 'st-btn st-c-neutral st-v-ghost st-btn--sz-md', { label: 'Discard' }),
        el('span', 'hidden h-6 w-px bg-base-300 @2xl:block', {}),
        el(
          'button',
          'flex h-9 w-9 items-center justify-center rounded-field text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content',
          {
            attrs: { type: 'button', ariaLabel: 'Share' },
            children: [atom('Icon', 'h-4 w-4', { name: 'share-2' })],
          }
        ),
        el(
          'button',
          'flex h-9 w-9 items-center justify-center rounded-field text-base-content/70 transition-colors hover:bg-base-200 hover:text-base-content',
          {
            attrs: { type: 'button', ariaLabel: 'More options' },
            children: [atom('Icon', 'h-4 w-4', { name: 'ellipsis-vertical' })],
          }
        ),
      ],
    }),
  }),

  // ── Icon button row — round icon-only controls ───────────────────────────────
  entry({
    key: 'icon_button_row',
    name: 'Icon button row',
    category: 'actions',
    kind: 'common',
    icon: 'circle-ellipsis',
    description:
      'A compact row of round, icon-only buttons for quick reactions or share targets — labelled for assistive tech.',
    surfaces: ['page', 'site'],
    tags: ['icon button', 'round', 'share', 'social', 'reactions', 'actions'],
    tree: el('div', 'flex items-center gap-2', {
      children: [
        el(
          'button',
          'flex h-10 w-10 items-center justify-center rounded-full border border-base-200 text-base-content/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary',
          {
            attrs: { type: 'button', ariaLabel: 'Like' },
            children: [atom('Icon', 'h-4 w-4', { name: 'heart' })],
          }
        ),
        el(
          'button',
          'flex h-10 w-10 items-center justify-center rounded-full border border-base-200 text-base-content/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary',
          {
            attrs: { type: 'button', ariaLabel: 'Comment' },
            children: [atom('Icon', 'h-4 w-4', { name: 'message-circle' })],
          }
        ),
        el(
          'button',
          'flex h-10 w-10 items-center justify-center rounded-full border border-base-200 text-base-content/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary',
          {
            attrs: { type: 'button', ariaLabel: 'Share' },
            children: [atom('Icon', 'h-4 w-4', { name: 'share-2' })],
          }
        ),
        el(
          'button',
          'flex h-10 w-10 items-center justify-center rounded-full border border-base-200 text-base-content/70 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary',
          {
            attrs: { type: 'button', ariaLabel: 'Bookmark' },
            children: [atom('Icon', 'h-4 w-4', { name: 'bookmark' })],
          }
        ),
      ],
    }),
  }),

  // ── Swap toggle — peer checkbox swaps the visible label / icon ────────────────
  entry({
    key: 'swap_toggle',
    name: 'Swap toggle',
    category: 'actions',
    kind: 'common',
    icon: 'toggle-left',
    description:
      'A two-state control that swaps its icon and label when checked — pure peer-checkbox, no script. Here: play / pause.',
    surfaces: ['page', 'site'],
    tags: ['swap', 'toggle', 'switch', 'play pause', 'state', 'actions'],
    tree: el(
      'label',
      'st-btn st-c-primary st-v-soft st-btn--sz-md inline-flex cursor-pointer items-center gap-2',
      {
        children: [
          el('input', 'peer sr-only', { attrs: { type: 'checkbox' } }),
          // Default (unchecked) face
          atom('Icon', 'h-4 w-4 peer-checked:hidden', { name: 'play' }),
          el('span', 'peer-checked:hidden', { text: 'Play' }),
          // Swapped (checked) face
          atom('Icon', 'hidden h-4 w-4 peer-checked:block', { name: 'pause' }),
          el('span', 'hidden peer-checked:inline', { text: 'Pause' }),
        ],
      }
    ),
  }),

  // ── Copy button — leading icon + "Copy" label ────────────────────────────────
  entry({
    key: 'copy_button',
    name: 'Copy button',
    category: 'actions',
    kind: 'common',
    icon: 'copy',
    description:
      'An outline button with a leading clipboard icon for copying a value — pairs with a code snippet or share link.',
    surfaces: ['page', 'site'],
    tags: ['copy', 'clipboard', 'duplicate', 'button', 'actions'],
    tree: el(
      'button',
      'st-btn st-c-neutral st-v-outline st-btn--sz-sm inline-flex items-center gap-2',
      {
        attrs: { type: 'button', ariaLabel: 'Copy to clipboard' },
        children: [atom('Icon', 'h-4 w-4', { name: 'copy' }), el('span', '', { text: 'Copy' })],
      }
    ),
  }),

  // ── Load more — centered outline pagination control ──────────────────────────
  entry({
    key: 'load_more_button',
    name: 'Load more',
    category: 'actions',
    kind: 'common',
    icon: 'arrow-down',
    description:
      'A centered outline button to fetch the next page of results — the click-to-extend alternative to numbered pagination.',
    surfaces: ['page', 'site'],
    tags: ['load more', 'pagination', 'infinite', 'show more', 'actions'],
    tree: el('div', 'flex w-full justify-center py-2', {
      children: [
        el(
          'button',
          'st-btn st-c-primary st-v-outline st-btn--sz-md inline-flex items-center gap-2',
          {
            attrs: { type: 'button' },
            children: [
              atom('Icon', 'h-4 w-4', { name: 'arrow-down' }),
              el('span', '', { text: 'Load more' }),
            ],
          }
        ),
      ],
    }),
  }),

  // ── Floating action button — a single prominent round action ──────────────────
  entry({
    key: 'fab_button',
    name: 'Floating action button',
    category: 'actions',
    kind: 'common',
    icon: 'plus',
    description:
      'A single high-emphasis round button for the primary page action — large, filled, with a labelled icon.',
    surfaces: ['page', 'site'],
    tags: ['fab', 'floating action', 'add', 'compose', 'primary', 'actions'],
    tree: el(
      'button',
      'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg transition-colors hover:bg-primary/90',
      {
        attrs: { type: 'button', ariaLabel: 'New item' },
        children: [atom('Icon', 'h-6 w-6', { name: 'plus' })],
      }
    ),
  }),

  // ── Button stack — full-width buttons stacked for a mobile sheet / form ───────
  entry({
    key: 'button_stack',
    name: 'Button stack',
    category: 'actions',
    kind: 'common',
    icon: 'rows-2',
    description:
      'A vertical stack of full-width buttons — a confirm / cancel pair for a sheet, modal footer, or mobile form.',
    surfaces: ['page', 'site'],
    tags: ['button stack', 'vertical', 'confirm', 'cancel', 'block', 'actions'],
    tree: el('div', 'flex w-full max-w-sm flex-col gap-3', {
      children: [
        atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-lg w-full', {
          label: 'Confirm order',
        }),
        atom('Button', 'st-btn st-c-neutral st-v-ghost st-btn--sz-lg w-full', {
          label: 'Keep editing',
        }),
      ],
    }),
  }),
];
