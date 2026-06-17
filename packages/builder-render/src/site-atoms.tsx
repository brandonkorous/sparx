// Site-UI atom renders (docs/102 Track A).
//
// The builder registry exposes the full @sparx/site-ui library as droppable atoms;
// this module is their shared render — the second half of each atom (the first is
// its ComponentDef metadata in the dashboard registry). `renderLeaf` delegates any
// type it doesn't itself own to `renderSiteUiAtom`, so the live site and the editor
// canvas paint the SAME real component (one map, no per-surface drift — the same
// contract render-leaf.tsx documents).
//
// Recipe model (docs/35 / docs/46 §3.6): every color-bearing site-ui component takes
// `color`/`variant`/`size` as TYPED props and emits its own `st-<base>` identity
// class. A builder node instead carries the recipe as CLASS TOKENS on `node.class`
// (so the inspector's Color/Emphasis controls — which read/write `st-c-*`/`st-v-*` —
// drive it). `recipeFromClass` bridges the two: it lifts the recipe tokens out of the
// leaf class into the component's props and passes only the residual layout utilities
// as `className`, so the rendered element carries exactly ONE clean copy of each token
// (not the duplicate the component's own prop-derived defaults would add).
//
// Server- AND client-safe (no 'use client'): every atom here is presentational, so
// the live RSC tree and the client canvas both call it. Genuinely-interactive site-ui
// components (Radix dialog/drawer/tabs/accordion/popover/tooltip) are NOT here — they
// land in Track C, wired to the data-sx behavior runtime.

import * as React from 'react';
import {
  Alert,
  Callout,
  Checkbox,
  Field,
  FileInput,
  Input,
  Label,
  NativeSelect,
  Progress,
  RadialProgress,
  Radio,
  Range,
  Skeleton,
  Spinner,
  Switch,
  Textarea,
  Validator,
  type ChipTreatmentKey,
  type ColorKey,
  type FieldTreatmentKey,
  type SizeKey,
  type SkeletonShape,
  type SpinnerKind,
} from '@sparx/site-ui';
import type { BuilderNode, Cardinality } from '@sparx/builder-schemas';

import { BuilderIcon } from './icon';

export interface AtomRenderCtx {
  /** node.class for a leaf that styles its own element (leafWearsClass) — carries
   *  the recipe tokens the inspector wrote + any layout utilities. */
  leafClass?: string;
  /** Resolved binding value (undefined when unbound). */
  value: unknown;
  bound: boolean;
  cardinality: Cardinality;
  /** Editor canvas (`edit`) shows representative placeholders for empty leaves so an
   *  unauthored atom stays selectable; the live site ships them empty. */
  edit: boolean;
  /** Pre-rendered child nodes for a leaf that nests them (Field/Validator wrap a
   *  dropped control). */
  children?: React.ReactNode;
}

// ── Recipe + content helpers ──────────────────────────────────────────────────

export interface Recipe {
  color?: string;
  /** Button/chip treatment (`st-v-*`) OR field treatment (`st-fv-*`) — only one is
   *  meaningful per component, so they share the `variant` slot (field wins). */
  variant?: string;
  /** Size step (xs…xl) lifted from a `<base>--sz-<step>` token. */
  size?: string;
  /** The leftover utilities (layout/spacing) — everything that isn't a recipe axis. */
  className?: string;
}

/** Split a leaf's class into the site-ui recipe props it carries + the residual
 *  utility className (docs/102 §3.1). The component re-emits the `st-c-*`/`st-v-*`/
 *  `--sz-*` tokens from the props, so passing them here (not on className) keeps the
 *  rendered element free of duplicate recipe tokens. */
export function recipeFromClass(leafClass: string | undefined): Recipe {
  let color: string | undefined;
  let variant: string | undefined;
  let fieldVariant: string | undefined;
  let size: string | undefined;
  const rest: string[] = [];
  for (const t of (leafClass ?? '').split(/\s+/).filter(Boolean)) {
    if (t.startsWith('st-c-')) color = t.slice(5);
    else if (t.startsWith('st-fv-')) fieldVariant = t.slice(6);
    else if (t.startsWith('st-v-')) variant = t.slice(5);
    else {
      const m = /--sz-([a-z]+)$/.exec(t);
      if (m) size = m[1];
      else rest.push(t);
    }
  }
  return { color, variant: fieldVariant ?? variant, size, className: rest.join(' ') || undefined };
}

const str = (node: BuilderNode, k: string): string =>
  typeof node.props[k] === 'string' ? (node.props[k] as string) : '';

const flag = (node: BuilderNode, k: string): boolean => node.props[k] === true;

/** A bound value as display text (string as-is, number stringified), else ''. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/** A node prop or bound text, with an editor-only placeholder fallback. */
function boundOr(ctx: AtomRenderCtx, node: BuilderNode, key: string, placeholder: string): string {
  const authored = str(node, key);
  const live = ctx.bound ? asText(ctx.value) : '';
  return live || authored || (ctx.edit ? placeholder : '');
}

function numOr(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && raw.trim() !== '' ? n : fallback;
}

// Cast helpers — recipeFromClass yields free strings; the components type their axes,
// and an unknown custom color still resolves (ColorKey is `… | (string & {})`).
const asColor = (c?: string): ColorKey | undefined => c as ColorKey | undefined;
const asSize = (s?: string): SizeKey | undefined => s as SizeKey | undefined;

// ── The atom render map ───────────────────────────────────────────────────────

/** Render a site-ui atom by type, or `undefined` when `node.type` isn't one (so
 *  `renderLeaf` falls through to its own default). */
export function renderSiteUiAtom(
  node: BuilderNode,
  ctx: AtomRenderCtx
): React.ReactNode | undefined {
  const r = recipeFromClass(ctx.leafClass);

  switch (node.type) {
    // ── Form controls (Tier 3) ───────────────────────────────────────────────
    case 'Input':
      return (
        <Input
          type={str(node, 'type') || 'text'}
          name={str(node, 'name') || undefined}
          placeholder={str(node, 'placeholder') || undefined}
          color={asColor(r.color)}
          variant={r.variant as FieldTreatmentKey | undefined}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Textarea':
      return (
        <Textarea
          name={str(node, 'name') || undefined}
          placeholder={str(node, 'placeholder') || undefined}
          rows={numOr(str(node, 'rows'), 4)}
          color={asColor(r.color)}
          variant={r.variant as FieldTreatmentKey | undefined}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Select': {
      const options = str(node, 'options')
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);
      const opts = options.length ? options : ['Option one', 'Option two', 'Option three'];
      return (
        <NativeSelect
          name={str(node, 'name') || undefined}
          color={asColor(r.color)}
          variant={r.variant as FieldTreatmentKey | undefined}
          size={asSize(r.size)}
          wrapperClassName={r.className}
        >
          {opts.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      );
    }
    case 'Checkbox':
      return (
        <Checkbox
          name={str(node, 'name') || undefined}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Radio':
      return (
        <Radio
          name={str(node, 'name') || undefined}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Switch':
      return (
        <Switch
          name={str(node, 'name') || undefined}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Range':
      return (
        <Range
          name={str(node, 'name') || undefined}
          min={numOr(str(node, 'min'), 0)}
          max={numOr(str(node, 'max'), 100)}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'FileInput':
      return (
        <FileInput
          name={str(node, 'name') || undefined}
          color={asColor(r.color)}
          variant={r.variant as FieldTreatmentKey | undefined}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Label':
      return (
        <Label required={flag(node, 'required')} className={r.className}>
          {boundOr(ctx, node, 'text', 'Label')}
        </Label>
      );
    case 'Field':
      return (
        <Field
          label={str(node, 'label') || (ctx.edit ? 'Field label' : undefined)}
          hint={str(node, 'hint') || undefined}
          required={flag(node, 'required')}
          className={r.className}
        >
          {ctx.children ?? (ctx.edit ? <Input placeholder="Value" /> : null)}
        </Field>
      );
    case 'Validator':
      return (
        <Validator hint={str(node, 'hint') || undefined} className={r.className}>
          {ctx.children ?? (ctx.edit ? <Input placeholder="Value" /> : null)}
        </Validator>
      );

    // ── Feedback / status ─────────────────────────────────────────────────────
    case 'Alert': {
      const icon = str(node, 'icon');
      const title = boundOr(ctx, node, 'title', 'Heads up');
      const body = boundOr(ctx, node, 'body', 'A short supporting message goes here.');
      return (
        <Alert
          color={asColor(r.color)}
          variant={r.variant as ChipTreatmentKey | undefined}
          vertical={flag(node, 'vertical')}
          className={r.className}
        >
          {icon ? (
            <Alert.Icon>
              <BuilderIcon name={icon} />
            </Alert.Icon>
          ) : null}
          {title ? <Alert.Title>{title}</Alert.Title> : null}
          {body ? <Alert.Body>{body}</Alert.Body> : null}
        </Alert>
      );
    }
    case 'Callout': {
      const icon = str(node, 'icon');
      const title = boundOr(ctx, node, 'title', 'Good to know');
      return (
        <Callout
          color={asColor(r.color)}
          variant={r.variant as ChipTreatmentKey | undefined}
          icon={icon ? <BuilderIcon name={icon} /> : undefined}
          title={title || undefined}
          className={r.className}
        >
          {boundOr(ctx, node, 'body', 'A longer note with context and a recommendation.')}
        </Callout>
      );
    }
    case 'Progress':
      return (
        <Progress
          value={str(node, 'value') ? numOr(str(node, 'value'), 0) : undefined}
          max={numOr(str(node, 'max'), 100)}
          label={str(node, 'label') || undefined}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'RadialProgress': {
      const value = numOr(str(node, 'value'), 0);
      const max = numOr(str(node, 'max'), 100);
      const pct = Math.round((value / (max || 100)) * 100);
      return (
        <RadialProgress value={value} max={max} color={asColor(r.color)} className={r.className}>
          {`${pct}%`}
        </RadialProgress>
      );
    }
    case 'Skeleton':
      return (
        <Skeleton
          shape={(str(node, 'shape') || 'block') as SkeletonShape}
          className={r.className}
        />
      );
    case 'Spinner':
      return (
        <Spinner
          kind={(str(node, 'kind') || 'spinner') as SpinnerKind}
          size={asSize(r.size)}
          className={r.className}
        />
      );

    default:
      return undefined;
  }
}
