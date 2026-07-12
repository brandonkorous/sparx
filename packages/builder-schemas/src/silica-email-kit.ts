// The authoring vocabulary for silica-native email bodies (docs/120 slice 6) — the
// email twin of `catalog/_kit.ts`. It exists so the ~24 provisioned defaults read as
// COPY, not as node literals: `heading('Your order is confirmed')` rather than fifteen
// lines of `{ id, kind: 'text', align, color, colorAuto, fontSize, … }`.
//
// Three constraints from silica's CLOSED email schema shape everything here:
//
//   1. A `body` holds ONLY sections; a section holds columns-or-content. A section
//      can NOT nest in a section — so anything that repeats or toggles is a
//      TOP-LEVEL section, never an inline wrapper.
//   2. `collection` repeats a container's CHILDREN once per item, so a line-item
//      table's header row must live in its own section OUTSIDE the repeating one.
//   3. A bound node with no `attr` fills its kind's DEFAULT field — but `section` has
//      no default field, so a bound section fills nothing and acts as a pure
//      show/hide wrapper. That is `when()`: the replacement for the legacy
//      `conditional_block` node type.
//
// Colors are authored as silica's neutral defaults WITH the `*Auto` flags set, so
// they repaint from the tenant's brand — live in the editor (silica's own
// `setColorDefaults`) and at send (`@sparx/email/silica`'s brand pass). An author who
// picks a color by hand freezes that field, exactly as silica intends.

import type {
  ButtonNode,
  ColumnNode,
  ColumnsNode,
  ContentNode,
  DividerNode,
  EmailDocument,
  LayoutChild,
  SectionNode,
  TextNode,
} from '@wizeworks/silicaui-builder/email';

/** silica's neutral palette (`DEFAULT_EMAIL_COLORS`), which it doesn't export. Every
 *  value here is paired with its `*Auto` flag, so these are the pre-brand fallbacks —
 *  what a document looks like before a tenant theme touches it, never a final color. */
const C = {
  primary: '#111827',
  primaryContent: '#ffffff',
  baseContent: '#18181b',
  base100: '#ffffff',
  base200: '#f4f4f5',
  base300: '#e4e4e7',
} as const;

/** The body's type scale. 16px is the floor for anything a reader reads as prose;
 *  14px is reserved for the table column captions. */
const SIZE = { heading: 28, body: 16, caption: 14 } as const;

// Authored, deterministic ids — a `def-` prefix keeps them clear of the editor's
// runtime `makeId` scheme. The counter runs once at module load, so every provisioned
// document gets a stable id sequence (cf. `default-emails.ts`).
let n = 0;
const sid = (kind: string): string => `def-s-${kind}-${(n += 1)}`;

// ── Leaves ───────────────────────────────────────────────────────────────────

interface TextOptions {
  size?: number;
  weight?: TextNode['fontWeight'];
  align?: TextNode['align'];
  /** Bind this node's copy to a data path; the resolver fills it and, when the value
   *  is absent, DROPS the node (see `when()`). */
  ref?: string;
}

/** A text block. `html` is inline-safe HTML (`<b>`, `<i>`, `<a href>`, `<br>`) and may
 *  carry `{{tokens}}` — silica interpolates those natively at resolve time. */
export function text(html: string, opts: TextOptions = {}): TextNode {
  const fontSize = opts.size ?? SIZE.body;
  return {
    id: sid('text'),
    kind: 'text',
    html,
    align: opts.align ?? 'left',
    color: C.baseContent,
    colorAuto: true,
    fontSize,
    fontWeight: opts.weight ?? 'normal',
    // Tighter leading on a heading, roomy on prose — both derived so a resized
    // block never ends up with leading that fights its size.
    lineHeight: Math.round(fontSize * (fontSize >= SIZE.heading ? 1.3 : 1.6)),
    ...(opts.ref ? { data: { kind: 'value' as const, ref: opts.ref } } : {}),
  };
}

export const heading = (html: string): TextNode =>
  text(html, { size: SIZE.heading, weight: 'bold' });

export const para = (html: string): TextNode => text(html);

/** A column caption in the line-item table — the one place 14px is right, because it
 *  labels the data rather than being read as prose. */
const caption = (html: string, align: TextNode['align'] = 'left'): TextNode =>
  text(html, { size: SIZE.caption, weight: 'semibold', align });

export function button(label: string, href: string): ButtonNode {
  return {
    id: sid('button'),
    kind: 'button',
    label,
    href,
    bg: C.primary,
    bgAuto: true,
    color: C.primaryContent,
    colorAuto: true,
    radius: 6,
    align: 'left',
    paddingX: 24,
    paddingY: 12,
  };
}

export const divider = (): DividerNode => ({
  id: sid('divider'),
  kind: 'divider',
  color: C.base300,
  colorAuto: true,
  thickness: 1,
});

// ── Containers ───────────────────────────────────────────────────────────────

export function section(children: LayoutChild[], paddingY = 24): SectionNode {
  return {
    id: sid('section'),
    kind: 'section',
    bg: C.base100,
    bgAuto: true,
    paddingX: 24,
    paddingY,
    children,
  };
}

const column = (widthPct: number, children: LayoutChild[]): ColumnNode => ({
  id: sid('column'),
  kind: 'column',
  widthPct,
  children,
});

const columns = (cols: ColumnNode[]): ColumnsNode => ({
  id: sid('columns'),
  kind: 'columns',
  children: cols,
  // A three-column line-item row is a TABLE, not a layout: stacking it on mobile
  // would tear each item's name away from its price. Kept side-by-side.
  stackOnMobile: false,
});

/** A block shown only when `ref` resolves to something. The `conditional_block`
 *  replacement: a bound section fills no field (section has no default bindable
 *  field), so resolution either passes it through untouched or — when the value is
 *  absent and the resolver runs with `hideWhenEmpty` — drops it whole. */
export function when(ref: string, children: LayoutChild[]): SectionNode {
  return { ...section(children, 8), data: { kind: 'value', ref } };
}

/** A line-item table over a bound collection (`order.items` / `cart.items` /
 *  `quote.items` / `invoice.items` — all four share the same item vocabulary:
 *  `name` · `quantity` · `unitPrice` · `lineTotal`).
 *
 *  TWO sections, because `collection` repeats a container's children: the header row
 *  sits in its own section so it prints once, and the row section repeats. The item
 *  refs are bare field keys — inside a collection scope the resolver reads them off
 *  the current item.
 *
 *  The authored cell copy is not filler: silica renders the authored children once
 *  when a collection resolves empty, so this is what an item-less email shows. */
export function itemsTable(ref: string): SectionNode[] {
  const header = section(
    [
      columns([
        column(58, [caption('Item')]),
        column(14, [caption('Qty', 'right')]),
        column(28, [caption('Amount', 'right')]),
      ]),
      divider(),
    ],
    8
  );
  const rows: SectionNode = {
    ...section(
      [
        columns([
          column(58, [text('Item', { ref: 'name' })]),
          column(14, [text('1', { align: 'right', ref: 'quantity' })]),
          column(28, [text('—', { align: 'right', ref: 'lineTotal' })]),
        ]),
      ],
      8
    ),
    data: { kind: 'collection', ref },
  };
  return [header, rows];
}

// ── The document ─────────────────────────────────────────────────────────────

/** Wrap authored sections in an email body. The brand wordmark header and the legal
 *  footer are NOT here — the send composes both (`@sparx/email/silica`), so an author
 *  edits only their own copy and can't delete the compliance footer off a marketing
 *  email. */
export function emailDoc(subject: string, preheader: string, body: SectionNode[]): EmailDocument {
  return {
    version: '1',
    subject,
    preheader,
    root: {
      id: sid('body'),
      kind: 'body',
      width: 600,
      bg: C.base200,
      bgAuto: true,
      contentBg: C.base100,
      contentBgAuto: true,
      fontFamily: 'Arial, Helvetica, sans-serif',
      children: body,
    },
  };
}

/** A one-section body — the shape almost every default takes: a heading, some copy,
 *  and a call to action, with any conditionals appended as their own sections. */
export function copyBlock(children: ContentNode[]): SectionNode {
  return section(children);
}
