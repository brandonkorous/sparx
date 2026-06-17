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
  CircleDashed,
  CircleDot,
  ChevronDown,
  FormInput,
  Loader,
  LoaderCircle,
  Megaphone,
  Pilcrow,
  ShieldCheck,
  SlidersHorizontal,
  SquareCheck,
  SquareDashed,
  Tag,
  TextCursorInput,
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

/** The full site-ui atom set added in Track A, spread into the registry's DEFS. */
export const SITE_UI_ATOM_DEFS: ComponentDef[] = [...FORM_DEFS, ...FEEDBACK_DEFS];
