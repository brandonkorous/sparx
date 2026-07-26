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
  SpacerNode,
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
  /** Which theme role this text tracks (silicaui 0.33). Omitted → `baseContent`.
   *  Use `primary` for the ONE key datum, or a semantic role (`success` / `warning`
   *  / `info` / `error`) for a status. Repaints per tenant. */
  colorRole?: TextNode['colorRole'];
  /** Colour for `<a>` inside `html`, by theme role — replaces the client-default
   *  hyperlink blue with a brand-adaptive link colour (no more `color:inherit`). */
  linkColorRole?: TextNode['linkColorRole'];
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
    ...(opts.colorRole ? { colorRole: opts.colorRole } : {}),
    ...(opts.linkColorRole ? { linkColorAuto: true, linkColorRole: opts.linkColorRole } : {}),
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

export function button(
  label: string,
  href: string,
  align: ButtonNode['align'] = 'left'
): ButtonNode {
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
    align,
    paddingX: 24,
    paddingY: 12,
  };
}

/** A secondary, low-emphasis action rendered as a TEXT LINK beneath the primary
 *  button, so a confirmation has ONE clear primary and a quiet "and also…" under it.
 *  `linkColorRole:'primary'` paints the `<a>` in the brand colour (theme-adaptive)
 *  instead of the client's default hyperlink blue. */
export const actionLink = (
  label: string,
  href: string,
  align: TextNode['align'] = 'center'
): TextNode =>
  text(`<a href="${href}">${label}</a>`, { align, weight: 'semibold', linkColorRole: 'primary' });

export const divider = (): DividerNode => ({
  id: sid('divider'),
  kind: 'divider',
  color: C.base300,
  colorAuto: true,
  thickness: 1,
});

/** Vertical breathing room between blocks. The schema's own `spacer` — cheaper than
 *  an empty section and it survives the projector as a real gap. */
export const spacer = (height = 16): SpacerNode => ({ id: sid('spacer'), kind: 'spacer', height });

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
  // Column widths sum to 93%, NOT 100%: the projector renders columns as
  // `display:inline-block`, and the whitespace between them adds a space's worth of
  // width — three columns at a full 100% overflow and the last wraps, tearing each
  // item's price onto its own centred line. The 7% slack absorbs the inter-column
  // whitespace so the row stays intact. `align:'left'` hugs the row to the left edge
  // (the section's `<td>` is otherwise `align:center`, same fix `detailPanel` uses).
  const COL = { item: 54, qty: 13, amount: 26 } as const;
  const header: SectionNode = {
    ...section(
      [
        columns([
          column(COL.item, [caption('Item')]),
          column(COL.qty, [caption('Qty', 'right')]),
          column(COL.amount, [caption('Amount', 'right')]),
        ]),
        divider(),
      ],
      8
    ),
    align: 'left',
  };
  const rows: SectionNode = {
    ...section(
      [
        columns([
          column(COL.item, [text('Item', { ref: 'name' })]),
          column(COL.qty, [text('1', { align: 'right', ref: 'quantity' })]),
          column(COL.amount, [text('—', { align: 'right', ref: 'lineTotal' })]),
        ]),
      ],
      8
    ),
    align: 'left',
    data: { kind: 'collection', ref },
  };
  return [header, rows];
}

// ── Detail panel ───────────────────────────────────────────────────────────────

/** One label→value line in a detail panel. `value` is inline-safe HTML and may
 *  carry `{{tokens}}`. `ref` marks an OPTIONAL row: when that data path resolves
 *  empty the whole row drops (same `hideWhenEmpty` mechanism as `when()`), so a
 *  booking with no location never shows a dangling "Location" label. `emphasize`
 *  marks the ONE datum that matters most (a booking's date/time) — rendered large
 *  and in the brand colour so the eye lands on it first. */
export interface DetailRow {
  label: string;
  value: string;
  ref?: string;
  emphasize?: boolean;
}

/** An optional status shown at the top of the card — a semantic-coloured state on
 *  the record (`success` Confirmed · `info` Upcoming · `warning` Rescheduled …). */
export interface DetailStatus {
  label: string;
  role: TextNode['colorRole'];
}

/**
 * A scannable label→value panel — the centrepiece of a confirmation/receipt email,
 * and the single biggest lift over a run of prose paragraphs: the reader finds the
 * "what / when / where" at a glance instead of parsing a sentence. It renders as a
 * rounded, bordered, INSET card (silicaui 0.33 section box-decoration) that stands
 * off the body and tints to the tenant theme.
 *
 * Two projector facts still shape the rows:
 *   · a section renders with `align` (here `left`); inline-block `columns` wrap when
 *     their widths sum to ~100%, so a label|value row is a single FULL-WIDTH `column`
 *     holding a stacked tag-over-value pair, never a 2-column row.
 *   · the card fill/border track the `base200`/`base300` roles (`bgRole` /
 *     `borderColorRole`), so they follow each tenant's palette instead of a frozen
 *     hex. Outlook ignores `radius` → square corners, the accepted degradation.
 *
 * An OPTIONAL row (`ref`) still drops whole — label, value, and trailing gap — via
 * the same `hideWhenEmpty` mechanism as `when()`, never leaving a dangling label.
 */
export function detailPanel(rows: DetailRow[], opts: { status?: DetailStatus } = {}): SectionNode {
  const row = (r: DetailRow): ColumnsNode => {
    const value = r.emphasize
      ? text(r.value, { size: 20, weight: 'semibold', colorRole: 'primary' })
      : text(r.value, { size: SIZE.body });
    const cols = columns([
      column(100, [text(r.label, { size: SIZE.caption, weight: 'semibold' }), value, spacer(12)]),
    ]);
    return r.ref ? { ...cols, data: { kind: 'value', ref: r.ref } } : cols;
  };
  const children: LayoutChild[] = [];
  if (opts.status) {
    children.push(
      text(opts.status.label, {
        size: SIZE.caption,
        weight: 'semibold',
        colorRole: opts.status.role,
      }),
      spacer(10)
    );
  }
  children.push(...rows.map(row));
  return {
    ...section(children, 18),
    paddingX: 20,
    // Tinted fill + hairline border that track the theme (0.33 roles), rounded, and
    // inset from the email edges by the outer margin.
    bg: C.base200,
    bgAuto: true,
    bgRole: 'base200',
    borderColor: C.base300,
    borderColorAuto: true,
    borderColorRole: 'base300',
    borderWidth: 1,
    radius: 16,
    marginX: 24,
    marginY: 8,
    align: 'left',
  };
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
      // Declare both schemes so Apple Mail / Outlook-for-Mac render the light design
      // as authored instead of force-inverting it; Gmail/Outlook.com ignore it.
      colorScheme: 'light dark',
      children: body,
    },
  };
}

/** A one-section body — the shape almost every default takes: a heading, some copy,
 *  and a call to action, with any conditionals appended as their own sections. */
export function copyBlock(children: ContentNode[]): SectionNode {
  return section(children);
}
