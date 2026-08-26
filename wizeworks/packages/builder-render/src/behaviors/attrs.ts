// Node props → the controlled `data-sx-*` attributes the walkers emit (docs/98
// Pillar 5).
//
// Behaviors are NOT authored as raw `data-*` (that would let a tenant smuggle
// arbitrary attributes past the element whitelist). Instead a node carries two
// sanctioned props the walker lowers here:
//   · `props.behavior = { type, ...params }` — the behavior ROOT (`data-sx-carousel`
//     + its params, e.g. `data-sx-interval`).
//   · `props.sxRole = 'track' | 'slide' | 'prev' | …` — an inner STRUCTURAL marker
//     (`data-sx-track`, …) the comprehensive composites place on their parts.
// Both map onto the closed vocabulary the runtime reads; anything else is dropped.

import { BEHAVIOR_NAMES, type BehaviorName } from './types';

/** The structural roles a composite's inner nodes may declare. Closed set. */
export const SX_ROLES = [
  'track',
  'slide',
  'prev',
  'next',
  'dot',
  'dots',
  'trigger',
  'panel',
  'item',
  'tab',
  'spy',
] as const;
export type SxRole = (typeof SX_ROLES)[number];

const kebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** A behavior prop → its `data-sx-*` attributes (the root marker + params).
 *  `{ type:'carousel', autoplay:false, interval:5 }` →
 *  `{ 'data-sx-carousel':'', 'data-sx-autoplay':'false', 'data-sx-interval':'5' }`. */
export function behaviorAttrs(behavior: unknown): Record<string, string> {
  if (!behavior || typeof behavior !== 'object') return {};
  const b = behavior as Record<string, unknown>;
  const type = b.type;
  if (typeof type !== 'string' || !BEHAVIOR_NAMES.includes(type as BehaviorName)) return {};
  const out: Record<string, string> = { [`data-sx-${type}`]: '' };
  for (const [k, v] of Object.entries(b)) {
    if (k === 'type' || v === undefined || v === null || v === '') continue;
    if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
      out[`data-sx-${kebab(k)}`] = String(v);
    }
  }
  return out;
}

/** Every sanctioned `data-sx-*` attribute for a node: the behavior root (from
 *  `props.behavior`) plus the structural role marker (from `props.sxRole`). Spread
 *  by both host walkers onto the node's element. */
export function sxAttrs(node: { props?: Record<string, unknown> }): Record<string, string> {
  const props = node.props ?? {};
  const out = behaviorAttrs(props.behavior);
  const role = props.sxRole;
  if (typeof role === 'string' && (SX_ROLES as readonly string[]).includes(role)) {
    out[`data-sx-${role}`] = '';
  }
  return out;
}

// ── Inspector authoring schema (the Behavior panel reads this) ─────────────────

export interface BehaviorParam {
  key: string;
  label: string;
  kind: 'bool' | 'number' | 'choice' | 'text';
  default: boolean | number | string;
  /** `choice` only: the options offered, in order. */
  options?: { value: string; label: string }[];
  /** Shown under the control when the label alone cannot carry the meaning. */
  help?: string;
}
export interface BehaviorDescriptor {
  name: BehaviorName;
  label: string;
  help: string;
  params: BehaviorParam[];
}

/** The closed behavior catalogue the Behavior card offers, with each behavior's
 *  tunable params. The structural `data-sx-*` markers come from the composite, not
 *  this panel — adding a behavior to a bare container wires whatever parts it finds. */
export const BEHAVIOR_DESCRIPTORS: BehaviorDescriptor[] = [
  {
    name: 'carousel',
    label: 'Carousel',
    help: 'Slides through [data-sx-slide] children with arrows, dots, and autoplay.',
    params: [
      { key: 'autoplay', label: 'Autoplay', kind: 'bool', default: true },
      { key: 'interval', label: 'Seconds per slide', kind: 'number', default: 6 },
    ],
  },
  {
    name: 'marquee',
    label: 'Marquee',
    help: 'Continuously scrolls its track (pair with the animate-marquee class).',
    params: [{ key: 'pauseOnHover', label: 'Pause on hover', kind: 'bool', default: true }],
  },
  {
    name: 'disclosure',
    label: 'Accordion',
    help: 'Toggles [data-sx-item] panels open/closed.',
    params: [{ key: 'single', label: 'One open at a time', kind: 'bool', default: false }],
  },
  {
    name: 'tabs',
    label: 'Tabs',
    help: 'Index-matched [data-sx-tab] buttons reveal [data-sx-panel] panels.',
    params: [],
  },
  {
    name: 'menu',
    label: 'Menu / dropdown',
    help: 'A [data-sx-trigger] opens a [data-sx-panel]; closes on outside-click + Esc.',
    params: [],
  },
  {
    name: 'scrollspy',
    label: 'Scroll-adaptive nav',
    help: 'Sets data-scrolled past a threshold and highlights the in-view section link.',
    params: [{ key: 'threshold', label: 'Scroll threshold (px)', kind: 'number', default: 8 }],
  },
  {
    name: 'counter',
    label: 'Animated counter',
    help: 'Counts each [data-sx-item] up to its authored value when scrolled into view.',
    params: [{ key: 'duration', label: 'Duration (ms)', kind: 'number', default: 1400 }],
  },
  {
    name: 'dismiss',
    label: 'Dismissible',
    help: 'A [data-sx-trigger] hides this element; with a key it stays hidden on return.',
    params: [],
  },
  {
    name: 'toc',
    label: 'Table of contents',
    help: 'Builds links in [data-sx-panel] from the headings in [data-sx-spy] and tracks scroll.',
    params: [],
  },
  {
    name: 'reveal',
    label: 'Show it when…',
    help: 'Reveals a hidden offer on a trigger, and remembers not to show it again too soon.',
    params: [
      {
        key: 'on',
        label: 'Show it',
        kind: 'choice',
        default: 'delay',
        options: [
          { value: 'load', label: 'As soon as the page opens' },
          { value: 'delay', label: 'After a few seconds' },
          { value: 'scroll', label: 'Once they have read part of the page' },
          { value: 'exit', label: 'When they look like they are leaving' },
          { value: 'return', label: 'Only on a repeat visit' },
        ],
      },
      { key: 'delay', label: 'Seconds to wait', kind: 'number', default: 10 },
      { key: 'scroll', label: 'How far down the page (%)', kind: 'number', default: 50 },
      {
        key: 'every',
        label: 'Days before showing it again',
        kind: 'number',
        default: 7,
        help: 'Set to 0 to show it every single visit.',
      },
      {
        key: 'key',
        label: 'Remember it as',
        kind: 'text',
        default: '',
        help: 'A short name so this offer is remembered separately from your others.',
      },
    ],
  },
];
