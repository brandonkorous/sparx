// The semantic controls, and the classes each one owns.
//
// Two tiers over ONE class set: a chip row and the raw Classes field edit the
// same `node.class`, because a class list is the only styling surface there is.
// A control "owns" a group of mutually-exclusive classes — picking a value swaps
// out the group's other members, and Auto clears the group back to the theme's
// own default rather than pinning a value that looks the same today.
//
// EVERY CLASS HERE IS A LITERAL STRING. A consuming app's Tailwind `@source` scan
// reads this file to decide what to generate; a computed class name produces
// nothing, and the failure is invisible — the chip highlights and the canvas does
// not move.
//
// The vocabulary is deliberately short. These are the decisions a business owner
// makes about their own page — how big, how much room, what colour, how round —
// not the whole of Tailwind. Anything else is reachable through the raw field.

import type { AddressableNode } from '../../tree/walk';

export interface ControlOption {
  value: string;
  label: string;
}

export interface ControlGroup {
  key: string;
  label: string;
  options: ControlOption[];
  /** Render as colour swatches rather than text chips. */
  swatches?: boolean;
  /** Limit the control to the nodes it means anything for. */
  when?: (node: AddressableNode) => boolean;
}

export interface ControlSection {
  key: string;
  label: string;
  groups: ControlGroup[];
}

const isTextual = (node: AddressableNode): boolean =>
  node.kind !== 'element' ||
  [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'span',
    'a',
    'li',
    'button',
    'label',
    'blockquote',
  ].includes(node.tag.toLowerCase());

const holdsChildren = (node: AddressableNode): boolean =>
  node.kind === 'element' &&
  !['br', 'hr', 'img', 'input', 'source', 'track', 'wbr', 'embed', 'col'].includes(
    node.tag.toLowerCase()
  );

export const CONTROL_SECTIONS: ControlSection[] = [
  {
    key: 'text',
    label: 'Text',
    groups: [
      {
        key: 'text-size',
        label: 'Size',
        when: isTextual,
        options: [
          // The 16px floor is the theme's own `text-base`, so the ladder starts at
          // `sm` for captions and never offers anything below it.
          { value: 'text-sm', label: 'Small' },
          { value: 'text-base', label: 'Normal' },
          { value: 'text-lg', label: 'Large' },
          { value: 'text-xl', label: 'Bigger' },
          { value: 'text-2xl', label: 'Title' },
          { value: 'text-4xl', label: 'Headline' },
          { value: 'text-6xl', label: 'Huge' },
        ],
      },
      {
        key: 'font-weight',
        label: 'Weight',
        when: isTextual,
        options: [
          { value: 'font-normal', label: 'Normal' },
          { value: 'font-medium', label: 'Medium' },
          { value: 'font-semibold', label: 'Bold' },
          { value: 'font-bold', label: 'Heavy' },
        ],
      },
      {
        key: 'text-align',
        label: 'Alignment',
        when: isTextual,
        options: [
          { value: 'text-left', label: 'Left' },
          { value: 'text-center', label: 'Centre' },
          { value: 'text-right', label: 'Right' },
        ],
      },
      {
        key: 'text-color',
        label: 'Colour',
        swatches: true,
        when: isTextual,
        // silica's own role names (`error`, not `danger`) — these are the roles a
        // bare silica theme is guaranteed to define, and a tenant theme is often
        // exactly that. A role the theme has never heard of resolves to nothing and
        // the text silently loses its colour.
        options: [
          { value: 'text-base-content', label: 'Default' },
          { value: 'text-primary', label: 'Primary' },
          { value: 'text-secondary', label: 'Secondary' },
          { value: 'text-accent', label: 'Accent' },
          { value: 'text-success', label: 'Success' },
          { value: 'text-warning', label: 'Warning' },
          { value: 'text-error', label: 'Alert' },
        ],
      },
    ],
  },
  {
    key: 'layout',
    label: 'Arrangement',
    groups: [
      {
        key: 'display',
        label: 'Arrange as',
        when: holdsChildren,
        options: [
          { value: 'block', label: 'Stacked' },
          { value: 'flex', label: 'In a line' },
          { value: 'grid', label: 'In a grid' },
          { value: 'hidden', label: 'Hidden' },
        ],
      },
      {
        key: 'flex-direction',
        label: 'Direction',
        when: holdsChildren,
        options: [
          { value: 'flex-row', label: 'Across' },
          { value: 'flex-col', label: 'Down' },
        ],
      },
      {
        key: 'grid-cols',
        label: 'Columns',
        when: holdsChildren,
        options: [
          { value: 'grid-cols-1', label: '1' },
          { value: 'grid-cols-2', label: '2' },
          { value: 'grid-cols-3', label: '3' },
          { value: 'grid-cols-4', label: '4' },
        ],
      },
      {
        key: 'justify',
        label: 'Along',
        when: holdsChildren,
        options: [
          { value: 'justify-start', label: 'Start' },
          { value: 'justify-center', label: 'Centre' },
          { value: 'justify-end', label: 'End' },
          { value: 'justify-between', label: 'Spread' },
        ],
      },
      {
        key: 'items',
        label: 'Across',
        when: holdsChildren,
        options: [
          { value: 'items-start', label: 'Start' },
          { value: 'items-center', label: 'Centre' },
          { value: 'items-end', label: 'End' },
          { value: 'items-stretch', label: 'Fill' },
        ],
      },
      {
        key: 'gap',
        label: 'Space between',
        when: holdsChildren,
        options: [
          { value: 'gap-0', label: 'None' },
          { value: 'gap-2', label: 'Tight' },
          { value: 'gap-4', label: 'Normal' },
          { value: 'gap-8', label: 'Roomy' },
          { value: 'gap-12', label: 'Wide' },
        ],
      },
    ],
  },
  {
    key: 'space',
    label: 'Space',
    groups: [
      {
        key: 'padding-y',
        label: 'Room above and below',
        options: [
          { value: 'py-0', label: 'None' },
          { value: 'py-4', label: 'Tight' },
          { value: 'py-8', label: 'Normal' },
          { value: 'py-16', label: 'Roomy' },
          { value: 'py-24', label: 'Wide' },
        ],
      },
      {
        key: 'padding-x',
        label: 'Room left and right',
        options: [
          { value: 'px-0', label: 'None' },
          { value: 'px-2', label: 'Tight' },
          { value: 'px-4', label: 'Normal' },
          { value: 'px-8', label: 'Roomy' },
          { value: 'px-12', label: 'Wide' },
        ],
      },
      {
        key: 'margin-top',
        label: 'Gap above',
        options: [
          { value: 'mt-0', label: 'None' },
          { value: 'mt-2', label: 'Tight' },
          { value: 'mt-4', label: 'Normal' },
          { value: 'mt-8', label: 'Roomy' },
          { value: 'mt-16', label: 'Wide' },
        ],
      },
    ],
  },
  {
    key: 'size',
    label: 'Size',
    groups: [
      {
        key: 'width',
        label: 'Width',
        options: [
          { value: 'w-auto', label: 'Fit' },
          { value: 'w-full', label: 'Full' },
          { value: 'w-1/2', label: 'Half' },
          { value: 'w-1/3', label: 'Third' },
          { value: 'w-1/4', label: 'Quarter' },
        ],
      },
      {
        key: 'max-width',
        label: 'Don’t get wider than',
        options: [
          { value: 'max-w-none', label: 'No limit' },
          { value: 'max-w-md', label: 'Narrow' },
          { value: 'max-w-2xl', label: 'Readable' },
          { value: 'max-w-4xl', label: 'Wide' },
          { value: 'max-w-6xl', label: 'Very wide' },
        ],
      },
    ],
  },
  {
    key: 'surface',
    label: 'Surface',
    groups: [
      {
        key: 'background',
        label: 'Background',
        swatches: true,
        options: [
          { value: 'bg-base-100', label: 'Page' },
          { value: 'bg-base-200', label: 'Raised' },
          { value: 'bg-base-300', label: 'Sunken' },
          { value: 'bg-primary', label: 'Primary' },
          { value: 'bg-secondary', label: 'Secondary' },
          { value: 'bg-accent', label: 'Accent' },
          { value: 'bg-neutral', label: 'Neutral' },
        ],
      },
      {
        key: 'soft',
        label: 'Tint it',
        options: [
          // silica's universal soft treatment — a theme-aware `color-mix` into the
          // surface, so a tint follows the theme instead of freezing one shade.
          { value: 'bg-soft', label: 'Soften' },
        ],
      },
      {
        key: 'radius',
        label: 'Corners',
        options: [
          { value: 'rounded-none', label: 'Square' },
          { value: 'rounded', label: 'Slight' },
          { value: 'rounded-lg', label: 'Rounded' },
          { value: 'rounded-box', label: 'Theme' },
          { value: 'rounded-full', label: 'Pill' },
        ],
      },
      {
        key: 'border',
        label: 'Outline',
        options: [
          { value: 'border-0', label: 'None' },
          { value: 'border', label: 'Hairline' },
          { value: 'border-2', label: 'Thick' },
        ],
      },
    ],
  },
];

/** The sections that have at least one group this node can use. */
export function sectionsFor(node: AddressableNode): ControlSection[] {
  return CONTROL_SECTIONS.map((section) => ({
    ...section,
    groups: section.groups.filter((group) => !group.when || group.when(node)),
  })).filter((section) => section.groups.length > 0);
}

/** The class list a group owns, for `tokenStateAt` / `setTokenAt`. */
export function groupClasses(group: ControlGroup): string[] {
  return group.options.map((option) => option.value);
}
