// Site-UI atom registry defs (docs/102 Track A).
//
// The @sparx/site-ui library is ~85 components; the in-code registry historically
// exposed only ~15 of them as droppable atoms, so the catalog hand-rolled the rest
// from raw utilities (docs/102 §2.3 — the narrow registry was the root cause). These
// defs register the rest as first-class atoms: each is METADATA only (palette tile,
// props, recipe seed) — the render is the shared `renderSiteUiAtom` map in
// @sparx/builder-render, so canvas == live with no second renderer.
//
// Recipe seed (`defaults.class`): the AXIS tokens only (`st-c-*` + `st-v-*`/`st-fv-*`
// [+ `<base>--sz-*`]), never the `st-<base>` identity — the site-ui component emits
// its own base, and the inspector's Color/Emphasis controls read/write these axis
// tokens (class-controls.ts). A node with no color axis (Skeleton/Label/…) ships an
// empty seed; the Style card still shows but its tokens are inert there.
//
// These are line-limit-exempt data-as-code (a catalog of defs), kept out of
// registry.tsx so that file stays focused on the registry machinery.

import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  CircleDot,
  CircleUser,
  Ellipsis,
  FormInput,
  Keyboard,
  Link2,
  List,
  Loader,
  LoaderCircle,
  ListOrdered,
  Megaphone,
  Menu,
  MessageCircle,
  PanelBottom,
  Pilcrow,
  ShieldCheck,
  SlidersHorizontal,
  SquareCheck,
  SquareDashed,
  Star,
  Table,
  Tag,
  Tags,
  TextCursorInput,
  Timer,
  ToggleRight,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react';

import type { Cardinality } from './model';
import type { ComponentDef, PropSpec } from './registry';

interface AtomSpec {
  type: string;
  label: string;
  icon: LucideIcon;
  props?: PropSpec[];
  /** Recipe AXIS seed (no `st-<base>`); omitted for atoms with no color axis. */
  class?: string;
  defaultProps?: Record<string, unknown>;
  bindable?: boolean;
  accepts?: Cardinality[];
  /** A leaf that still nests a dropped child (Field/Validator wrap a control). */
  acceptsChildren?: boolean;
}

function atom(spec: AtomSpec): ComponentDef {
  const defaults: ComponentDef['defaults'] = {};
  if (spec.defaultProps) defaults.props = spec.defaultProps;
  if (spec.class) defaults.class = spec.class;
  const def: ComponentDef = {
    type: spec.type,
    label: spec.label,
    kind: 'leaf',
    group: 'content',
    icon: spec.icon,
    bindable: spec.bindable ?? false,
    accepts: spec.accepts ?? [],
    props: spec.props ?? [],
    defaults,
  };
  if (spec.acceptsChildren) def.acceptsChildren = true;
  return def;
}

const opts = (...vals: [string, string][]): { value: string; label: string }[] =>
  vals.map(([value, label]) => ({ value, label }));

// ── Form controls (Tier 3) ────────────────────────────────────────────────────

const FORM_DEFS: ComponentDef[] = [
  atom({
    type: 'Input',
    label: 'Text input',
    icon: TextCursorInput,
    class: 'st-c-primary st-fv-outline',
    props: [
      {
        key: 'type',
        label: 'Type',
        control: 'select',
        options: opts(
          ['text', 'Text'],
          ['email', 'Email'],
          ['password', 'Password'],
          ['search', 'Search'],
          ['tel', 'Phone'],
          ['url', 'URL'],
          ['number', 'Number']
        ),
      },
      { key: 'placeholder', label: 'Placeholder', control: 'text', placeholder: 'Jordan Avery' },
      { key: 'name', label: 'Field name', control: 'text', placeholder: 'full_name' },
    ],
    defaultProps: { type: 'text', placeholder: '', name: '' },
  }),
  atom({
    type: 'Textarea',
    label: 'Text area',
    icon: Pilcrow,
    class: 'st-c-primary st-fv-outline',
    props: [
      { key: 'placeholder', label: 'Placeholder', control: 'text', placeholder: 'Your message…' },
      { key: 'name', label: 'Field name', control: 'text', placeholder: 'message' },
      {
        key: 'rows',
        label: 'Rows',
        control: 'select',
        options: opts(['3', '3'], ['4', '4'], ['6', '6'], ['8', '8']),
      },
    ],
    defaultProps: { placeholder: '', name: '', rows: '4' },
  }),
  atom({
    type: 'Select',
    label: 'Select',
    icon: ChevronDown,
    class: 'st-c-primary st-fv-outline',
    props: [
      { key: 'name', label: 'Field name', control: 'text', placeholder: 'department' },
      {
        key: 'options',
        label: 'Options — one per line',
        control: 'textarea',
        placeholder: 'Sales\nSupport\nBilling',
      },
    ],
    defaultProps: { name: '', options: 'Sales\nSupport\nBilling' },
  }),
  atom({
    type: 'Checkbox',
    label: 'Checkbox',
    icon: SquareCheck,
    class: 'st-c-primary',
    props: [{ key: 'name', label: 'Field name', control: 'text', placeholder: 'agree' }],
    defaultProps: { name: '' },
  }),
  atom({
    type: 'Radio',
    label: 'Radio',
    icon: CircleDot,
    class: 'st-c-primary',
    props: [{ key: 'name', label: 'Group name', control: 'text', placeholder: 'choice' }],
    defaultProps: { name: '' },
  }),
  atom({
    type: 'Switch',
    label: 'Toggle switch',
    icon: ToggleRight,
    class: 'st-c-primary',
    props: [{ key: 'name', label: 'Field name', control: 'text', placeholder: 'notifications' }],
    defaultProps: { name: '' },
  }),
  atom({
    type: 'Range',
    label: 'Range slider',
    icon: SlidersHorizontal,
    class: 'st-c-primary',
    props: [
      { key: 'name', label: 'Field name', control: 'text', placeholder: 'budget' },
      { key: 'min', label: 'Min', control: 'text', placeholder: '0' },
      { key: 'max', label: 'Max', control: 'text', placeholder: '100' },
    ],
    defaultProps: { name: '', min: '0', max: '100' },
  }),
  atom({
    type: 'FileInput',
    label: 'File input',
    icon: Upload,
    class: 'st-c-primary st-fv-outline',
    props: [{ key: 'name', label: 'Field name', control: 'text', placeholder: 'attachment' }],
    defaultProps: { name: '' },
  }),
  atom({
    type: 'Label',
    label: 'Field label',
    icon: Tag,
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'text', label: 'Text', control: 'text', placeholder: 'Email address' },
      { key: 'required', label: 'Required', control: 'switch' },
    ],
    defaultProps: { text: 'Label', required: false },
  }),
  atom({
    type: 'Field',
    label: 'Field (labeled)',
    icon: FormInput,
    acceptsChildren: true,
    props: [
      { key: 'label', label: 'Label', control: 'text', placeholder: 'Full name' },
      { key: 'hint', label: 'Help text', control: 'text', placeholder: 'As it appears on file' },
      { key: 'required', label: 'Required', control: 'switch' },
    ],
    defaultProps: { label: 'Field label', hint: '', required: false },
  }),
  atom({
    type: 'Validator',
    label: 'Validator',
    icon: ShieldCheck,
    acceptsChildren: true,
    props: [
      { key: 'hint', label: 'Error hint', control: 'text', placeholder: 'Enter a valid email' },
    ],
    defaultProps: { hint: '' },
  }),
];

// ── Feedback / status ──────────────────────────────────────────────────────────

const FEEDBACK_DEFS: ComponentDef[] = [
  atom({
    type: 'Alert',
    label: 'Alert',
    icon: TriangleAlert,
    class: 'st-c-info st-v-soft',
    props: [
      { key: 'icon', label: 'Icon', control: 'icon' },
      { key: 'title', label: 'Title', control: 'text', placeholder: 'Heads up' },
      { key: 'body', label: 'Message', control: 'textarea', placeholder: 'A short message…' },
      { key: 'vertical', label: 'Stack icon on top', control: 'switch' },
    ],
    defaultProps: {
      icon: 'info',
      title: 'Heads up',
      body: 'Your changes are saved automatically while you edit.',
      vertical: false,
    },
  }),
  atom({
    type: 'Callout',
    label: 'Callout',
    icon: Megaphone,
    class: 'st-c-primary st-v-soft',
    props: [
      { key: 'icon', label: 'Icon', control: 'icon' },
      { key: 'title', label: 'Title', control: 'text', placeholder: 'Good to know' },
      { key: 'body', label: 'Body', control: 'textarea', placeholder: 'A longer note…' },
    ],
    defaultProps: {
      icon: 'lightbulb',
      title: 'Good to know',
      body: 'A longer note with context and a recommendation.',
    },
  }),
  atom({
    type: 'Progress',
    label: 'Progress bar',
    icon: Loader,
    class: 'st-c-primary',
    props: [
      { key: 'value', label: 'Value', control: 'text', placeholder: '65' },
      { key: 'max', label: 'Max', control: 'text', placeholder: '100' },
      { key: 'label', label: 'Accessible label', control: 'text', placeholder: 'Uploading' },
    ],
    defaultProps: { value: '65', max: '100', label: '' },
  }),
  atom({
    type: 'RadialProgress',
    label: 'Radial progress',
    icon: CircleDashed,
    class: 'st-c-primary',
    props: [
      { key: 'value', label: 'Value', control: 'text', placeholder: '65' },
      { key: 'max', label: 'Max', control: 'text', placeholder: '100' },
    ],
    defaultProps: { value: '65', max: '100' },
  }),
  atom({
    type: 'Skeleton',
    label: 'Skeleton',
    icon: SquareDashed,
    props: [
      {
        key: 'shape',
        label: 'Shape',
        control: 'buttongroup',
        options: opts(['block', 'Block'], ['text', 'Text'], ['circle', 'Circle']),
      },
    ],
    defaultProps: { shape: 'block' },
  }),
  atom({
    type: 'Spinner',
    label: 'Spinner',
    icon: LoaderCircle,
    props: [
      {
        key: 'kind',
        label: 'Style',
        control: 'select',
        options: opts(['spinner', 'Spinner'], ['ring', 'Ring'], ['dots', 'Dots'], ['bars', 'Bars']),
      },
    ],
    defaultProps: { kind: 'spinner' },
  }),
];

// ── Data display ───────────────────────────────────────────────────────────────

const DISPLAY_DEFS: ComponentDef[] = [
  atom({
    type: 'Avatar',
    label: 'Avatar',
    icon: CircleUser,
    class: 'st-c-neutral st-avatar--sz-md',
    props: [
      { key: 'src', label: 'Image URL', control: 'text', placeholder: 'https://…/face.jpg' },
      { key: 'name', label: 'Name (for initials)', control: 'text', placeholder: 'Jordan Avery' },
      {
        key: 'shape',
        label: 'Shape',
        control: 'buttongroup',
        options: opts(['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square']),
      },
      {
        key: 'status',
        label: 'Presence',
        control: 'select',
        options: opts(['none', 'None'], ['online', 'Online'], ['offline', 'Offline']),
      },
    ],
    defaultProps: { src: '', name: 'Jordan Avery', shape: 'circle', status: 'none' },
  }),
  atom({
    type: 'Tag',
    label: 'Tag',
    icon: Tags,
    class: 'st-c-neutral st-v-soft st-tag--sz-md',
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'text', label: 'Text', control: 'text', placeholder: 'New' },
      { key: 'dot', label: 'Leading dot', control: 'switch' },
    ],
    defaultProps: { text: 'Tag', dot: false },
  }),
  atom({
    type: 'Rating',
    label: 'Rating',
    icon: Star,
    class: 'st-c-warning st-rating--sz-md',
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'value', label: 'Value', control: 'text', placeholder: '4' },
      { key: 'count', label: 'Stars', control: 'select', options: opts(['5', '5'], ['10', '10']) },
    ],
    defaultProps: { value: '4', count: '5' },
  }),
  atom({
    type: 'Kbd',
    label: 'Keyboard key',
    icon: Keyboard,
    bindable: true,
    accepts: ['scalar'],
    props: [{ key: 'text', label: 'Key', control: 'text', placeholder: 'Ctrl' }],
    defaultProps: { text: 'Ctrl' },
  }),
  atom({
    type: 'Status',
    label: 'Status dot',
    icon: Circle,
    class: 'st-c-success st-status--sz-md',
    props: [
      { key: 'label', label: 'Accessible label', control: 'text', placeholder: 'Online' },
      { key: 'pulse', label: 'Pulse', control: 'switch' },
    ],
    defaultProps: { label: '', pulse: false },
  }),
  atom({
    type: 'Table',
    label: 'Table',
    icon: Table,
    props: [
      {
        key: 'columns',
        label: 'Columns — comma separated',
        control: 'text',
        placeholder: 'Name, Role, Status',
      },
      {
        key: 'rows',
        label: 'Rows — one per line, cells separated by |',
        control: 'textarea',
        placeholder: 'Jordan | Owner | Active\nRiley | Editor | Invited',
      },
      { key: 'zebra', label: 'Striped rows', control: 'switch' },
    ],
    defaultProps: {
      columns: 'Name, Role, Status',
      rows: 'Jordan Avery | Owner | Active\nRiley Chen | Editor | Invited',
      zebra: false,
    },
  }),
  atom({
    type: 'List',
    label: 'List',
    icon: List,
    props: [
      {
        key: 'items',
        label: 'Items — one per line',
        control: 'textarea',
        placeholder: 'First item\nSecond item',
      },
    ],
    defaultProps: { items: 'First item\nSecond item\nThird item' },
  }),
  atom({
    type: 'ChatBubble',
    label: 'Chat bubble',
    icon: MessageCircle,
    class: 'st-c-primary',
    props: [
      { key: 'author', label: 'Author', control: 'text', placeholder: 'Support' },
      { key: 'message', label: 'Message', control: 'textarea', placeholder: 'How can we help?' },
      {
        key: 'placement',
        label: 'Side',
        control: 'buttongroup',
        options: opts(['start', 'Left'], ['end', 'Right']),
      },
    ],
    defaultProps: { author: '', message: 'Hey — thanks for reaching out!', placement: 'start' },
  }),
  atom({
    type: 'Countdown',
    label: 'Countdown',
    icon: Timer,
    props: [
      { key: 'days', label: 'Days', control: 'text', placeholder: '2' },
      { key: 'hours', label: 'Hours', control: 'text', placeholder: '12' },
      { key: 'minutes', label: 'Minutes', control: 'text', placeholder: '30' },
      { key: 'seconds', label: 'Seconds', control: 'text', placeholder: '00' },
      { key: 'showLabels', label: 'Show labels', control: 'switch' },
    ],
    defaultProps: { days: '', hours: '12', minutes: '30', seconds: '00', showLabels: true },
  }),
];

// ── Navigation ─────────────────────────────────────────────────────────────────

const NAV_DEFS: ComponentDef[] = [
  atom({
    type: 'Menu',
    label: 'Menu',
    icon: Menu,
    props: [
      {
        key: 'orientation',
        label: 'Orientation',
        control: 'buttongroup',
        options: opts(['vertical', 'Stack'], ['horizontal', 'Row']),
      },
      {
        key: 'items',
        label: 'Items — one per line, “Label | href”',
        control: 'textarea',
        placeholder: 'Dashboard | /\nOrders | /orders',
      },
    ],
    defaultProps: { orientation: 'vertical', items: 'Dashboard | #\nOrders | #\nSettings | #' },
  }),
  atom({
    type: 'Steps',
    label: 'Steps',
    icon: ListOrdered,
    class: 'st-c-primary',
    props: [
      {
        key: 'orientation',
        label: 'Orientation',
        control: 'buttongroup',
        options: opts(['horizontal', 'Row'], ['vertical', 'Stack']),
      },
      {
        key: 'items',
        label: 'Steps — one per line; prefix “x ” = done, “* ” = active',
        control: 'textarea',
        placeholder: 'x Account\n* Profile\nConfirm',
      },
    ],
    defaultProps: { orientation: 'horizontal', items: 'x Account\n* Profile\nConfirm' },
  }),
  atom({
    type: 'Pagination',
    label: 'Pagination',
    icon: Ellipsis,
    props: [
      { key: 'page', label: 'Current page', control: 'text', placeholder: '2' },
      { key: 'total', label: 'Total pages', control: 'text', placeholder: '10' },
    ],
    defaultProps: { page: '2', total: '10' },
  }),
  atom({
    type: 'Breadcrumb',
    label: 'Breadcrumb',
    icon: ChevronRight,
    props: [
      {
        key: 'items',
        label: 'Trail — one per line, “Label | href”; last is current',
        control: 'textarea',
        placeholder: 'Home | /\nProducts | /products\nItem',
      },
    ],
    defaultProps: { items: 'Home | /\nProducts | /products\nItem' },
  }),
  atom({
    type: 'Link',
    label: 'Link',
    icon: Link2,
    class: 'st-c-primary',
    bindable: true,
    accepts: ['scalar'],
    props: [
      { key: 'text', label: 'Text', control: 'text', placeholder: 'Learn more' },
      { key: 'href', label: 'Goes to', control: 'text', placeholder: '/about or https://…' },
      {
        key: 'underline',
        label: 'Underline',
        control: 'select',
        options: opts(['hover', 'On hover'], ['always', 'Always'], ['none', 'Never']),
      },
    ],
    defaultProps: { text: 'Learn more', href: '#', underline: 'hover' },
  }),
  atom({
    type: 'Dock',
    label: 'Dock',
    icon: PanelBottom,
    props: [
      {
        key: 'items',
        label: 'Items — one per line, “icon | label”',
        control: 'textarea',
        placeholder: 'house | Home\nsearch | Search',
      },
    ],
    defaultProps: { items: 'house | Home\nsearch | Search\nuser | Profile' },
  }),
];

/** The full site-ui atom set added in Track A, spread into the registry's DEFS. */
export const SITE_UI_ATOM_DEFS: ComponentDef[] = [
  ...FORM_DEFS,
  ...FEEDBACK_DEFS,
  ...DISPLAY_DEFS,
  ...NAV_DEFS,
];
