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
  Avatar,
  Breadcrumb,
  BreadcrumbItem,
  Browser,
  Calendar,
  Callout,
  ChatBubble,
  ChatHeader,
  ChatMessage,
  Checkbox,
  Code,
  CodeLine,
  Countdown,
  Diff,
  DiffItem1,
  DiffItem2,
  DiffResizer,
  Dock,
  DockItem,
  FAB,
  Field,
  FileInput,
  Filter,
  Hover3DCard,
  HoverGallery,
  Indicator,
  IndicatorItem,
  Input,
  Join,
  Kbd,
  Label,
  Link,
  List,
  ListRow,
  Mask,
  Menu,
  MenuItem,
  NativeSelect,
  Pagination,
  Phone,
  Progress,
  RadialProgress,
  Radio,
  Range,
  Rating,
  Skeleton,
  Spinner,
  Status,
  Step,
  Steps,
  Swap,
  Switch,
  Table,
  Tag,
  Textarea,
  TextRotate,
  Toast,
  Validator,
  Window,
  type AvatarShape,
  type ChatPlacement,
  type ChipTreatmentKey,
  type ColorKey,
  type FABPlacement,
  type FieldTreatmentKey,
  type IndicatorPlacement,
  type JoinOrientation,
  type LinkUnderline,
  type MaskShape,
  type MenuOrientation,
  type SizeKey,
  type SkeletonShape,
  type SpinnerKind,
  type StepsOrientation,
  type StepState,
  type SwapAnimation,
  type ToastHorizontal,
  type ToastVertical,
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
  typeof node.props[k] === 'string' ? node.props[k] : '';

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

/** Authored-inline list items — one per line, blank lines dropped. */
function textLines(node: BuilderNode, key: string): string[] {
  return str(node, key)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Authored-inline `Label | href` rows — one per line; href optional. */
function pairLines(node: BuilderNode, key: string): { label: string; href?: string }[] {
  return textLines(node, key)
    .map((l) => l.split('|').map((s) => s.trim()))
    .filter((p) => p[0])
    .map((p) => {
      const href = p[1];
      return { label: p[0] ?? '', href: href === undefined || href === '' ? undefined : href };
    });
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

    // ── Data display ──────────────────────────────────────────────────────────
    case 'Avatar': {
      const statusV = str(node, 'status');
      return (
        <Avatar
          src={str(node, 'src') || undefined}
          name={str(node, 'name') || undefined}
          shape={(str(node, 'shape') || 'circle') as AvatarShape}
          status={statusV === 'online' || statusV === 'offline' ? statusV : undefined}
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    }
    case 'Tag':
      return (
        <Tag
          color={asColor(r.color)}
          variant={r.variant as ChipTreatmentKey | undefined}
          size={asSize(r.size)}
          dot={flag(node, 'dot')}
          className={r.className}
        >
          {boundOr(ctx, node, 'text', 'Tag')}
        </Tag>
      );
    case 'Rating':
      return (
        <Rating
          name={node.id}
          count={numOr(str(node, 'count'), 5)}
          value={
            ctx.bound && typeof ctx.value === 'number' ? ctx.value : numOr(str(node, 'value'), 0)
          }
          readOnly
          color={asColor(r.color)}
          size={asSize(r.size)}
          className={r.className}
        />
      );
    case 'Kbd':
      return (
        <Kbd size={asSize(r.size)} className={r.className}>
          {boundOr(ctx, node, 'text', 'Ctrl')}
        </Kbd>
      );
    case 'Status':
      return (
        <Status
          color={asColor(r.color)}
          size={asSize(r.size)}
          pulse={flag(node, 'pulse')}
          label={str(node, 'label') || undefined}
          className={r.className}
        />
      );
    case 'Table': {
      const head = str(node, 'columns')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const body = textLines(node, 'rows').map((line) => line.split('|').map((c) => c.trim()));
      const cols = head.length ? head : ['Name', 'Role', 'Status'];
      const rows = body.length
        ? body
        : [
            ['Jordan Avery', 'Owner', 'Active'],
            ['Riley Chen', 'Editor', 'Invited'],
          ];
      return (
        <Table zebra={flag(node, 'zebra')} size={asSize(r.size)} className={r.className}>
          <thead>
            <tr>
              {cols.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, ri) => (
              <tr key={ri}>
                {cols.map((_, ci) => (
                  <td key={ci}>{cells[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      );
    }
    case 'List': {
      const items = textLines(node, 'items');
      const rows = items.length ? items : ['First item', 'Second item', 'Third item'];
      return (
        <List className={r.className}>
          {rows.map((it, i) => (
            <ListRow key={i}>{it}</ListRow>
          ))}
        </List>
      );
    }
    case 'ChatBubble': {
      const author = str(node, 'author');
      const message = boundOr(ctx, node, 'message', 'Hey — thanks for reaching out!');
      return (
        <ChatBubble
          placement={(str(node, 'placement') || 'start') as ChatPlacement}
          className={r.className}
        >
          {author ? <ChatHeader>{author}</ChatHeader> : null}
          <ChatMessage color={asColor(r.color)}>{message}</ChatMessage>
        </ChatBubble>
      );
    }
    case 'Countdown':
      return (
        <Countdown
          days={str(node, 'days') ? numOr(str(node, 'days'), 0) : undefined}
          hours={str(node, 'hours') ? numOr(str(node, 'hours'), 0) : undefined}
          minutes={str(node, 'minutes') ? numOr(str(node, 'minutes'), 0) : undefined}
          seconds={str(node, 'seconds') ? numOr(str(node, 'seconds'), 0) : undefined}
          showLabels={flag(node, 'showLabels')}
          className={r.className}
        />
      );

    // ── Navigation ────────────────────────────────────────────────────────────
    case 'Menu': {
      const items = pairLines(node, 'items');
      const list = items.length
        ? items
        : [
            { label: 'Dashboard', href: '#' },
            { label: 'Orders', href: '#' },
            { label: 'Settings', href: '#' },
          ];
      return (
        <Menu
          orientation={(str(node, 'orientation') || 'vertical') as MenuOrientation}
          size={asSize(r.size)}
          className={r.className}
        >
          {list.map((it, i) => (
            <MenuItem key={i} href={it.href} active={i === 0}>
              {it.label}
            </MenuItem>
          ))}
        </Menu>
      );
    }
    case 'Steps': {
      const items = textLines(node, 'items');
      const list = items.length ? items : ['x Account', '* Profile', 'Confirm'];
      return (
        <Steps
          orientation={(str(node, 'orientation') || 'horizontal') as StepsOrientation}
          color={asColor(r.color)}
          className={r.className}
        >
          {list.map((raw, i) => {
            let state: StepState = 'upcoming';
            let label = raw;
            if (raw.startsWith('x ')) {
              state = 'complete';
              label = raw.slice(2);
            } else if (raw.startsWith('* ')) {
              state = 'active';
              label = raw.slice(2);
            }
            return (
              <Step key={i} state={state}>
                {label}
              </Step>
            );
          })}
        </Steps>
      );
    }
    case 'Pagination':
      return (
        <Pagination
          page={numOr(str(node, 'page'), 1)}
          total={numOr(str(node, 'total'), 10)}
          className={r.className}
        />
      );
    case 'Breadcrumb': {
      const items = pairLines(node, 'items');
      const list = items.length
        ? items
        : [
            { label: 'Home', href: '/' },
            { label: 'Products', href: '/products' },
            { label: 'Item', href: undefined },
          ];
      return (
        <Breadcrumb className={r.className}>
          {list.map((it, i) => {
            const last = i === list.length - 1;
            return (
              <BreadcrumbItem key={i} href={last ? undefined : it.href} current={last}>
                {it.label}
              </BreadcrumbItem>
            );
          })}
        </Breadcrumb>
      );
    }
    case 'Link':
      return (
        <Link
          href={str(node, 'href') || '#'}
          color={asColor(r.color)}
          underline={(str(node, 'underline') || 'hover') as LinkUnderline}
          className={r.className}
        >
          {boundOr(ctx, node, 'text', 'Learn more')}
        </Link>
      );
    case 'Dock': {
      // Each line is `icon | label` (lucide icon name, then its caption).
      const rows = textLines(node, 'items').map((l) => {
        const p = l.split('|').map((s) => s.trim());
        const icon = p[0];
        return { icon: icon === undefined || icon === '' ? 'circle' : icon, label: p[1] ?? '' };
      });
      const list = rows.length
        ? rows
        : [
            { icon: 'house', label: 'Home' },
            { icon: 'search', label: 'Search' },
            { icon: 'user', label: 'Profile' },
          ];
      return (
        <Dock size={asSize(r.size)} className={r.className}>
          {list.map((it, i) => (
            <DockItem key={i} active={i === 0} label={it.label || undefined}>
              <BuilderIcon name={it.icon} />
            </DockItem>
          ))}
        </Dock>
      );
    }

    // ── Layout / containment ──────────────────────────────────────────────────
    case 'Indicator': {
      const label = str(node, 'label') || (ctx.edit ? '3' : '');
      return (
        <Indicator className={r.className}>
          {ctx.children}
          {label ? (
            <IndicatorItem placement={(str(node, 'placement') || 'top-end') as IndicatorPlacement}>
              <span className="st-badge st-c-primary st-v-solid st-badge--sz-sm">{label}</span>
            </IndicatorItem>
          ) : null}
        </Indicator>
      );
    }
    case 'Join':
      return (
        <Join
          orientation={(str(node, 'orientation') || 'horizontal') as JoinOrientation}
          className={r.className}
        >
          {ctx.children}
        </Join>
      );
    case 'Mask':
      return (
        <Mask shape={(str(node, 'shape') || 'squircle') as MaskShape} className={r.className}>
          {ctx.children ?? (ctx.edit ? <div className="bx-ph bx-ratio-square" /> : null)}
        </Mask>
      );

    // ── Mockup frames ─────────────────────────────────────────────────────────
    case 'Browser':
      return (
        <Browser url={str(node, 'url') || undefined} className={r.className}>
          {ctx.children}
        </Browser>
      );
    case 'Window':
      return (
        <Window title={str(node, 'title') || undefined} className={r.className}>
          {ctx.children}
        </Window>
      );
    case 'Phone':
      return <Phone className={r.className}>{ctx.children}</Phone>;
    case 'Code': {
      const lines = textLines(node, 'lines');
      const list = lines.length ? lines : ['$ | npm install @sparx/site-ui', '$ | pnpm dev'];
      return (
        <Code className={r.className}>
          {list.map((raw, i) => {
            const idx = raw.indexOf('|');
            const prefix = idx >= 0 ? raw.slice(0, idx).trim() || undefined : undefined;
            const code = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
            return (
              <CodeLine key={i} prefix={prefix}>
                {code}
              </CodeLine>
            );
          })}
        </Code>
      );
    }

    // ── Effects / display ─────────────────────────────────────────────────────
    case 'Swap':
      return (
        <Swap
          animation={(str(node, 'animation') || 'none') as SwapAnimation}
          on={str(node, 'on') || '🌙'}
          off={str(node, 'off') || '☀️'}
          className={r.className}
        />
      );
    case 'Filter': {
      const options = textLines(node, 'options').map((label) => ({
        label,
        value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      }));
      const list = options.length
        ? options
        : [
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
            { label: 'Drafts', value: 'drafts' },
          ];
      return (
        <Filter
          name={str(node, 'name') || node.id}
          options={list}
          color={asColor(r.color)}
          className={r.className}
        />
      );
    }
    case 'Calendar':
      return (
        <Calendar
          year={numOr(str(node, 'year'), 2026)}
          month={numOr(str(node, 'month'), 6)}
          selected={str(node, 'selected') ? numOr(str(node, 'selected'), 0) : undefined}
          className={r.className}
        />
      );
    case 'Diff': {
      const before = str(node, 'before');
      const after = str(node, 'after');
      return (
        <Diff className={r.className}>
          <DiffItem1>
            {before ? (
              <img src={before} alt="" className="block h-full w-full object-cover" />
            ) : (
              <div className="bx-ph bx-ratio-wide" />
            )}
          </DiffItem1>
          <DiffItem2>
            {after ? (
              <img src={after} alt="" className="block h-full w-full object-cover" />
            ) : (
              <div className="bx-ph bx-ratio-wide" />
            )}
          </DiffItem2>
          <DiffResizer />
        </Diff>
      );
    }
    case 'TextRotate': {
      const items = textLines(node, 'items');
      return (
        <TextRotate
          items={items.length ? items : ['faster', 'simpler', 'yours']}
          className={r.className}
        />
      );
    }
    case 'Hover3DCard':
      return <Hover3DCard className={r.className}>{ctx.children}</Hover3DCard>;
    case 'HoverGallery': {
      const images = textLines(node, 'images').map((src) => ({ src }));
      if (images.length < 2) return ctx.edit ? <div className="bx-ph bx-ratio-wide" /> : null;
      return <HoverGallery images={images} className={r.className} />;
    }

    // ── Overlay / floating ────────────────────────────────────────────────────
    // Both pin with `position: fixed` from their platform `st-*` CSS (so they
    // bypass the Tailwind allowlist's clickjacking guard, which denies raw `fixed`).
    // In the canvas they float to the stage corner, like the drawer's fixed rail.
    case 'Toast': {
      const horizontal = (str(node, 'horizontal') || 'end') as ToastHorizontal;
      const vertical = (str(node, 'vertical') || 'bottom') as ToastVertical;
      // A dropped notification (Alert/Card) per child; an empty region previews a
      // sample notification in the editor so it stays visible + selectable.
      const body =
        ctx.children ??
        (ctx.edit ? (
          <Alert color="info" variant="soft">
            <Alert.Title>Saved</Alert.Title>
            <Alert.Body>Your changes are live.</Alert.Body>
          </Alert>
        ) : null);
      return (
        <Toast horizontal={horizontal} vertical={vertical} className={r.className}>
          {body}
        </Toast>
      );
    }
    case 'FAB': {
      const icon = str(node, 'icon') || 'plus';
      const label = str(node, 'label') || 'Open actions';
      const href = str(node, 'href');
      const placement = (str(node, 'placement') || 'bottom-end') as FABPlacement;
      return (
        <FAB
          color={asColor(r.color)}
          placement={placement}
          href={href || undefined}
          aria-label={label}
          className={r.className}
        >
          <BuilderIcon name={icon} />
        </FAB>
      );
    }

    default:
      return undefined;
  }
}
