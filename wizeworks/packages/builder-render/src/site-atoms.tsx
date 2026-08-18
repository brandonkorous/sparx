// Site atom renders (docs/102 Track A).
//
// The builder registry exposes silicaui's library as droppable atoms; this module
// is their shared render — the second half of each atom (the first is its
// ComponentDef metadata in the registry). `renderLeaf` delegates any type it
// doesn't itself own to `renderSiteAtom`, so the live site and the editor canvas
// paint the SAME real component. One map, no per-surface drift.
//
// ── The class model ──────────────────────────────────────────────────────────
//
// A node's `class` string IS the silica recipe: a Badge leaf carries
// `badge badge-primary badge-soft badge-sm`, and the inspector's Color/Emphasis
// controls swap tokens within that string. So the atom's job is simply to render
// the right element and put that string on it — `rootClass()` only guarantees the
// base class is present for a node authored before the class-first catalog.
//
// This replaces a `recipeFromClass` bridge that parsed `st-c-*` / `st-v-*` /
// `--sz-*` tokens back OUT of the class and fed them in as typed props, because
// the old vocabulary and the components' prop names were two different spellings
// of the same thing. Under silica there is one spelling, so the bridge is gone.
// See docs/implementation/st-token-retirement.md.
//
// ── Server vs client ─────────────────────────────────────────────────────────
//
// No 'use client' here: the live RSC tree and the client canvas both call it. An
// atom that is markup + classes is emitted directly, so it ships ZERO JavaScript;
// an atom that is a genuine behavior (Rating, Calendar, Diff, Pagination, Filter,
// Switch, Countdown, Field) uses the real `@wizeworks/silicaui-react` component,
// which is a `'use client'` module — so those pay for a client bundle, and only on
// pages whose author actually dropped one.

import * as React from 'react';
import {
  Calendar,
  Countdown,
  Diff,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Filter,
  FilterItem,
  Pagination,
  Progress,
  RadialProgress,
  Rating,
  Swap,
  Switch,
  Validator,
} from '@wizeworks/silicaui-react';
// `cx` comes from the SERVER entry, not the barrel above. The barrel is a
// `'use client'` module, so a plain function imported from it can't be CALLED
// during a server render — only components can cross that boundary. The `/server`
// entry exists for exactly this.
import { cx } from '@wizeworks/silicaui-react/server';
import type { BuilderNode, Cardinality } from '@wizeworks/builder-schemas';

import { BuilderIcon } from './icon';
import { FAB, Hover3DCard, HoverGallery, TextRotate, ToastRegion } from './atoms';
import type { FABPlacement, ToastHorizontal, ToastVertical } from './atoms';

export interface AtomRenderCtx {
  /** node.class for a leaf that styles its own element (leafWearsClass) — the
   *  full silica recipe plus any layout utilities. */
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

// ── Class + content helpers ───────────────────────────────────────────────────

/** The leaf's own class string, guaranteed to carry `base`. A node authored before
 *  the class-first catalog — or one whose class an author cleared — still renders as
 *  the component rather than as unstyled markup. */
export function rootClass(base: string, leafClass: string | undefined): string {
  const tokens = (leafClass ?? '').split(/\s+/).filter(Boolean);
  return tokens.includes(base) ? tokens.join(' ') : [base, ...tokens].join(' ');
}

/** The color token a leaf carries for a given silica family, e.g. `badge-primary`
 *  → `primary`. Used only by the few atoms that take color as a PROP (silica's
 *  React components) rather than as a class. */
function colorOf(base: string, leafClass: string | undefined): string | undefined {
  const prefix = `${base}-`;
  const skip = new Set(['soft', 'outline', 'dash', 'ghost', 'xs', 'sm', 'md', 'lg', 'xl']);
  for (const t of (leafClass ?? '').split(/\s+/)) {
    if (t.startsWith(prefix)) {
      const rest = t.slice(prefix.length);
      if (!skip.has(rest)) return rest;
    }
  }
  return undefined;
}

/** The size step a leaf carries for a given silica family, e.g. `input-lg` → `lg`. */
function sizeOf(base: string, leafClass: string | undefined): string | undefined {
  const sizes = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
  for (const t of (leafClass ?? '').split(/\s+/)) {
    if (t.startsWith(`${base}-`) && sizes.has(t.slice(base.length + 1))) {
      return t.slice(base.length + 1);
    }
  }
  return undefined;
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

// The size axis is a CLOSED union (`xs`…`xl`), so the lifted token needs a cast.
// Color needs none: silica types it `… | (string & {})` precisely so a tenant's
// own registered color is accepted, and a plain `string` already satisfies it.
type AnySize = Parameters<typeof Pagination>[0]['size'];

// ── The atom render map ───────────────────────────────────────────────────────

/** Render a site atom by type, or `undefined` when `node.type` isn't one (so
 *  `renderLeaf` falls through to its own default). */
export function renderSiteAtom(node: BuilderNode, ctx: AtomRenderCtx): React.ReactNode | undefined {
  const cls = ctx.leafClass;

  switch (node.type) {
    // ── Form controls (Tier 3) ───────────────────────────────────────────────
    case 'Input':
      return (
        <input
          type={str(node, 'type') || 'text'}
          name={str(node, 'name') || undefined}
          placeholder={str(node, 'placeholder') || undefined}
          className={rootClass('input', cls)}
        />
      );
    case 'Textarea':
      return (
        <textarea
          name={str(node, 'name') || undefined}
          placeholder={str(node, 'placeholder') || undefined}
          rows={numOr(str(node, 'rows'), 4)}
          className={rootClass('textarea', cls)}
        />
      );
    case 'Select': {
      const options = textLines(node, 'options');
      const opts = options.length ? options : ['Option one', 'Option two', 'Option three'];
      return (
        <select name={str(node, 'name') || undefined} className={rootClass('select', cls)}>
          {opts.map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    case 'Checkbox':
      return (
        <input
          type="checkbox"
          name={str(node, 'name') || undefined}
          className={rootClass('checkbox', cls)}
        />
      );
    case 'Radio':
      return (
        <input
          type="radio"
          name={str(node, 'name') || undefined}
          className={rootClass('radio', cls)}
        />
      );
    case 'Switch':
      // Base UI behind it (a real switch role + keyboard semantics), so this is
      // the silica component rather than markup.
      return (
        <Switch
          name={str(node, 'name') || undefined}
          color={colorOf('switch', cls)}
          size={sizeOf('switch', cls) as AnySize}
          className={cls}
        />
      );
    case 'Range':
      return (
        <input
          type="range"
          name={str(node, 'name') || undefined}
          min={numOr(str(node, 'min'), 0)}
          max={numOr(str(node, 'max'), 100)}
          className={rootClass('range', cls)}
        />
      );
    case 'FileInput':
      return (
        <input
          type="file"
          name={str(node, 'name') || undefined}
          className={rootClass('file-input', cls)}
        />
      );
    case 'Label':
      return (
        <label className={rootClass('label', cls)}>
          {boundOr(ctx, node, 'text', 'Label')}
          {flag(node, 'required') ? <span className="label-required" aria-hidden /> : null}
        </label>
      );
    case 'Field': {
      const label = str(node, 'label') || (ctx.edit ? 'Field label' : '');
      const hint = str(node, 'hint');
      return (
        <Field className={cls}>
          {label ? <FieldLabel required={flag(node, 'required')}>{label}</FieldLabel> : null}
          {ctx.children ?? (ctx.edit ? <FieldControl placeholder="Value" /> : null)}
          {hint ? <FieldDescription>{hint}</FieldDescription> : null}
        </Field>
      );
    }
    case 'Validator': {
      // silica's Validator styles exactly ONE control child; with nothing dropped
      // in it there is nothing to validate, so an empty node previews a control.
      const control =
        ctx.children ?? (ctx.edit ? <input className="input" placeholder="Value" /> : null);
      if (!React.isValidElement(control)) return null;
      const hint = str(node, 'hint');
      return (
        <div className={cls}>
          <Validator>{control as React.ReactElement<{ className?: string }>}</Validator>
          {hint ? <p className="validator-hint">{hint}</p> : null}
        </div>
      );
    }

    // ── Feedback / status ─────────────────────────────────────────────────────
    // Callout was a second editorial flavour of the same thing; silica has one
    // Alert, with `soft`/`outline`/`dash` covering the range, so both map here.
    case 'Alert':
    case 'Callout': {
      const icon = str(node, 'icon');
      const isCallout = node.type === 'Callout';
      const title = boundOr(ctx, node, 'title', isCallout ? 'Good to know' : 'Heads up');
      const body = boundOr(
        ctx,
        node,
        'body',
        isCallout
          ? 'A longer note with context and a recommendation.'
          : 'A short supporting message goes here.'
      );
      return (
        <div
          role="alert"
          className={cx(rootClass('alert', cls), flag(node, 'vertical') && 'flex-col items-start')}
        >
          {icon ? <BuilderIcon name={icon} /> : null}
          <div className="alert-content">
            {title ? <div className="alert-title">{title}</div> : null}
            {body ? <div className="alert-description">{body}</div> : null}
          </div>
        </div>
      );
    }
    // Both progress atoms are silica COMPONENTS rather than markup: each paints
    // its fill from a CSS custom property that has to be set per instance, and
    // silica's own component is the only sanctioned place that happens.
    case 'Progress': {
      const raw = str(node, 'value');
      return (
        <Progress
          value={raw ? numOr(raw, 0) : undefined}
          max={numOr(str(node, 'max'), 100)}
          label={str(node, 'label') || undefined}
          color={colorOf('progress', cls)}
          size={sizeOf('progress', cls) as AnySize}
          className={cls}
        />
      );
    }
    case 'RadialProgress': {
      const value = numOr(str(node, 'value'), 0);
      const max = numOr(str(node, 'max'), 100);
      return (
        <RadialProgress
          value={(value / (max || 100)) * 100}
          color={colorOf('radial-progress', cls)}
          className={cls}
        />
      );
    }
    case 'Skeleton': {
      const shape = str(node, 'shape') || 'block';
      const modifier =
        shape === 'circle' ? 'skeleton-circle' : shape === 'text' ? 'skeleton-text' : '';
      return <div aria-hidden className={cx(rootClass('skeleton', cls), modifier)} />;
    }
    case 'Spinner':
      // silica calls it `loading`; the builder's node type predates that name and
      // is persisted in tenant trees, so the TYPE stays `Spinner`.
      return <span role="status" aria-label="Loading" className={rootClass('loading', cls)} />;

    // ── Data display ──────────────────────────────────────────────────────────
    case 'Avatar': {
      const src = str(node, 'src');
      const name = str(node, 'name');
      const statusV = str(node, 'status');
      const shape = str(node, 'shape');
      return (
        <span
          className={cx(
            rootClass('avatar', cls),
            shape === 'rounded' && 'avatar-rounded',
            (statusV === 'online' || statusV === 'offline') && `avatar-${statusV}`
          )}
          role={src ? undefined : 'img'}
          aria-label={src ? undefined : name || undefined}
        >
          {src ? <img src={src} alt={name} /> : initialsOf(name)}
        </span>
      );
    }
    case 'Tag':
      // The builder type is `Tag`; silica's equivalent is the badge.
      return <span className={rootClass('badge', cls)}>{boundOr(ctx, node, 'text', 'Tag')}</span>;
    case 'Rating':
      return (
        <Rating
          value={
            ctx.bound && typeof ctx.value === 'number' ? ctx.value : numOr(str(node, 'value'), 0)
          }
          max={numOr(str(node, 'count'), 5)}
          readOnly
          color={colorOf('rating', cls)}
          size={sizeOf('rating', cls) as AnySize}
          className={cls}
        />
      );
    case 'Kbd':
      return <kbd className={rootClass('kbd', cls)}>{boundOr(ctx, node, 'text', 'Ctrl')}</kbd>;
    case 'Status': {
      const label = str(node, 'label');
      return (
        <span
          className={cx(rootClass('status', cls), flag(node, 'pulse') && 'status-ping')}
          role={label ? 'status' : undefined}
          aria-label={label || undefined}
        />
      );
    }
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
        <table className={cx(rootClass('table', cls), flag(node, 'zebra') && 'table-zebra')}>
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
        </table>
      );
    }
    case 'List': {
      const items = textLines(node, 'items');
      const rows = items.length ? items : ['First item', 'Second item', 'Third item'];
      return (
        <div className={rootClass('list', cls)}>
          {rows.map((it, i) => (
            <div key={i} className="list-row">
              {it}
            </div>
          ))}
        </div>
      );
    }
    case 'ChatBubble': {
      const author = str(node, 'author');
      const message = boundOr(ctx, node, 'message', 'Hey — thanks for reaching out!');
      const side = str(node, 'placement') === 'end' ? 'chat-end' : 'chat-start';
      return (
        <div className={cx(rootClass('chat', cls), side)}>
          {author ? <div className="chat-header">{author}</div> : null}
          <div className={cx('chat-bubble', colorClassFor('chat-bubble', cls))}>{message}</div>
        </div>
      );
    }
    case 'Countdown': {
      // silica counts down to a TARGET; the node stores a duration, so the target
      // is "now plus that duration". `to` is read once per render, which is what a
      // preview of an authored duration means.
      const secs =
        numOr(str(node, 'days'), 0) * 86400 +
        numOr(str(node, 'hours'), 0) * 3600 +
        numOr(str(node, 'minutes'), 0) * 60 +
        numOr(str(node, 'seconds'), 0);
      const units = (['days', 'hours', 'minutes', 'seconds'] as const).filter(
        (u) => str(node, u) !== ''
      );
      return (
        <Countdown
          to={Date.now() + secs * 1000}
          units={units.length ? [...units] : undefined}
          plain={!flag(node, 'showLabels')}
          className={cls}
        />
      );
    }

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
        <ul
          className={cx(
            rootClass('menu', cls),
            str(node, 'orientation') === 'horizontal' && 'menu-horizontal'
          )}
        >
          {list.map((it, i) => (
            <li key={i}>
              <a href={it.href ?? '#'} {...(i === 0 ? { 'aria-current': 'page' as const } : {})}>
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      );
    }
    case 'Steps': {
      const items = textLines(node, 'items');
      const list = items.length ? items : ['x Account', '* Profile', 'Confirm'];
      // A step's color marks it as reached; an upcoming step carries none. The
      // authored `x ` / `* ` prefixes mean complete / active.
      const color = colorOf('step', cls) ?? 'primary';
      return (
        <ol className={rootClass('steps', cls)}>
          {list.map((raw, i) => {
            const reached = raw.startsWith('x ') || raw.startsWith('* ');
            const label = reached ? raw.slice(2) : raw;
            return (
              <li key={i} className={cx('step', reached && `step-${color}`)}>
                {label}
              </li>
            );
          })}
        </ol>
      );
    }
    case 'Pagination':
      return (
        <Pagination
          page={numOr(str(node, 'page'), 1)}
          count={numOr(str(node, 'total'), 10)}
          color={colorOf('pagination', cls)}
          size={sizeOf('pagination', cls) as AnySize}
          className={cls}
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
        <nav aria-label="Breadcrumb" className={rootClass('breadcrumb', cls)}>
          <ol>
            {list.map((it, i) => {
              const last = i === list.length - 1;
              return (
                <li key={i}>
                  {last || !it.href ? (
                    <span aria-current={last ? 'page' : undefined}>{it.label}</span>
                  ) : (
                    <a href={it.href}>{it.label}</a>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      );
    }
    case 'Link':
      return (
        <a
          href={str(node, 'href') || '#'}
          className={cx(rootClass('link', cls), str(node, 'underline') === 'hover' && 'link-hover')}
        >
          {boundOr(ctx, node, 'text', 'Learn more')}
        </a>
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
        <div className={rootClass('dock', cls)}>
          {list.map((it, i) => (
            <button
              type="button"
              key={i}
              className={cx('dock-item', i === 0 && 'dock-item-active')}
            >
              <BuilderIcon name={it.icon} />
              {it.label ? <span className="dock-label">{it.label}</span> : null}
            </button>
          ))}
        </div>
      );
    }

    // ── Layout / containment ──────────────────────────────────────────────────
    case 'Indicator': {
      const label = str(node, 'label') || (ctx.edit ? '3' : '');
      const placement = str(node, 'placement') || 'top-end';
      return (
        <span className={rootClass('indicator', cls)}>
          {ctx.children}
          {label ? (
            <span
              className={cx(
                'indicator-item',
                placement.endsWith('start') && 'indicator-start',
                placement.startsWith('bottom') && 'indicator-bottom'
              )}
            >
              <span className="badge badge-primary badge-sm">{label}</span>
            </span>
          ) : null}
        </span>
      );
    }
    case 'Join':
      return (
        <div
          className={cx(
            rootClass('join', cls),
            str(node, 'orientation') === 'vertical' && 'join-vertical'
          )}
        >
          {ctx.children}
        </div>
      );
    case 'Mask':
      return (
        <div className={cx(rootClass('mask', cls), `mask-${str(node, 'shape') || 'squircle'}`)}>
          {ctx.children ?? (ctx.edit ? <div className="bx-ph bx-ratio-square" /> : null)}
        </div>
      );

    // ── Mockup frames ─────────────────────────────────────────────────────────
    case 'Browser':
      return (
        <div className={rootClass('mockup-browser', cls)}>
          <div className="mockup-browser-toolbar">
            <div className="mockup-browser-input">{str(node, 'url')}</div>
          </div>
          {ctx.children}
        </div>
      );
    case 'Window':
      return (
        <div className={rootClass('mockup-window', cls)} data-title={str(node, 'title')}>
          {ctx.children}
        </div>
      );
    case 'Phone':
      return (
        <div className={rootClass('mockup-phone', cls)}>
          <div className="mockup-phone-display">{ctx.children}</div>
        </div>
      );
    case 'Code': {
      const lines = textLines(node, 'lines');
      const list = lines.length ? lines : ['$ | pnpm install', '$ | pnpm dev'];
      return (
        <div className={rootClass('mockup-code', cls)}>
          {list.map((raw, i) => {
            const idx = raw.indexOf('|');
            const prefix = idx >= 0 ? raw.slice(0, idx).trim() || undefined : undefined;
            const code = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
            return (
              <pre key={i} data-prefix={prefix}>
                <code>{code}</code>
              </pre>
            );
          })}
        </div>
      );
    }

    // ── Effects / display ─────────────────────────────────────────────────────
    case 'Swap':
      return (
        <Swap
          variant={(str(node, 'animation') || 'fade') as 'fade' | 'flip' | 'rotate'}
          on={str(node, 'on') || '🌙'}
          off={str(node, 'off') || '☀️'}
          className={cls}
        />
      );
    case 'Filter': {
      const options = textLines(node, 'options');
      const list = options.length ? options : ['Active', 'Archived', 'Drafts'];
      return (
        <Filter color={colorOf('filter', cls)} className={cls}>
          {list.map((label, i) => (
            <FilterItem key={i} value={label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
              {label}
            </FilterItem>
          ))}
        </Filter>
      );
    }
    case 'Calendar': {
      // The node stores a year + 1-based month; silica takes a Date for the month
      // to show. `selected` is a day-of-month.
      const year = numOr(str(node, 'year'), 2026);
      const month = numOr(str(node, 'month'), 6);
      const day = str(node, 'selected') ? numOr(str(node, 'selected'), 0) : 0;
      return (
        <Calendar
          defaultMonth={new Date(year, month - 1, 1)}
          defaultValue={day > 0 ? new Date(year, month - 1, day) : undefined}
          color={colorOf('calendar', cls)}
          className={cls}
        />
      );
    }
    case 'Diff': {
      const before = str(node, 'before');
      const after = str(node, 'after');
      const layer = (src: string) =>
        src ? (
          <img src={src} alt="" className="block h-full w-full object-cover" />
        ) : (
          <div className="bx-ph bx-ratio-wide" />
        );
      return <Diff before={layer(before)} after={layer(after)} className={cls} />;
    }
    case 'TextRotate': {
      const items = textLines(node, 'items');
      return (
        <TextRotate items={items.length ? items : ['faster', 'simpler', 'yours']} className={cls} />
      );
    }
    case 'Hover3DCard':
      return <Hover3DCard className={cls}>{ctx.children}</Hover3DCard>;
    case 'HoverGallery': {
      const images = textLines(node, 'images').map((src) => ({ src }));
      if (images.length < 2) return ctx.edit ? <div className="bx-ph bx-ratio-wide" /> : null;
      return <HoverGallery images={images} className={cls} />;
    }

    // ── Overlay / floating ────────────────────────────────────────────────────
    // Both pin with `position: fixed`. In the canvas they float to the stage
    // corner, like the drawer's fixed rail.
    case 'Toast': {
      // A dropped notification (Alert/Card) per child; an empty region previews a
      // sample notification in the editor so it stays visible + selectable.
      const body =
        ctx.children ??
        (ctx.edit ? (
          <div role="alert" className="alert alert-info alert-soft">
            <div className="alert-content">
              <div className="alert-title">Saved</div>
              <div className="alert-description">Your changes are live.</div>
            </div>
          </div>
        ) : null);
      return (
        <ToastRegion
          horizontal={(str(node, 'horizontal') || 'end') as ToastHorizontal}
          vertical={(str(node, 'vertical') || 'bottom') as ToastVertical}
          className={cls}
        >
          {body}
        </ToastRegion>
      );
    }
    case 'FAB':
      return (
        <FAB
          color={colorOf('btn', cls)}
          placement={(str(node, 'placement') || 'bottom-end') as FABPlacement}
          href={str(node, 'href') || undefined}
          aria-label={str(node, 'label') || 'Open actions'}
          className={cls}
        >
          <BuilderIcon name={str(node, 'icon') || 'plus'} />
        </FAB>
      );

    default:
      return undefined;
  }
}

/** Initials for an avatar fallback — at most two, from the first and last word. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** A `<base>-<color>` class lifted from the leaf, for a PART that must repeat the
 *  root's color (the chat bubble inside a chat row). */
function colorClassFor(base: string, leafClass: string | undefined): string | undefined {
  const color = colorOf(base, leafClass) ?? colorOf('chat', leafClass);
  return color ? `${base}-${color}` : undefined;
}
