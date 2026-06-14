// Custom-section template AST (docs/38 Phase C;
// docs/handoffs/sitebuilder-custom-section-template-spec.md).
//
// A custom section type's renderer is DATA, not code: a typed JSON component
// tree the storefront interprets server-side. This file is the structural
// contract — the closed node set, the value-expression grammar, and the
// condition grammar. It is deliberately zod-only (no React) so it stays in the
// server-safe schemas package; the interpreter that turns a parsed node into
// markup lives in the storefront.
//
// SECURITY MODEL: there is no path from template data to a raw color, class,
// style, or executable string. Every styleable prop is a closed enum the
// interpreter maps to a `data-*` attribute on a fixed `st-tpl-*` class; every
// text/url value is a value-expression that resolves a bounded scope (no
// function calls, no operators, no arbitrary JS). Author-time semantic checks
// (do bound paths reference declared fields, etc.) live in
// section-template-validate.ts; this file enforces shape only.

import { z } from 'zod';

// ── Value expressions ───────────────────────────────────────────────────────
// A prop value is exactly one of: a string literal, a single binding, or a
// concatenation of those. Formatters are a closed named set — nothing else
// transforms a value.

export const ValueFormat = z.enum(['none', 'money', 'number', 'date']);
export type ValueFormat = z.infer<typeof ValueFormat>;

export interface BindExpr {
  $bind: string;
  default?: string;
  format?: ValueFormat;
}
export interface ConcatExpr {
  $concat: ValueExpr[];
}
export type ValueExpr = string | BindExpr | ConcatExpr;

export const BindExpr: z.ZodType<BindExpr> = z
  .object({
    // A scope path like `field.heading`, `item.title`, `index`, `ctx.currency`,
    // `product.price`. Validated against the section's field spec + binding at
    // author time (section-template-validate.ts).
    $bind: z.string().min(1).max(200),
    default: z.string().max(2048).optional(),
    format: ValueFormat.optional(),
  })
  .strict();

export const ValueExpr: z.ZodType<ValueExpr> = z.lazy(() =>
  z.union([
    z.string().max(2048),
    BindExpr,
    z
      .object({ $concat: z.array(ValueExpr).min(1).max(20) })
      .strict() as unknown as z.ZodType<ConcatExpr>,
  ])
);

// ── Conditions (for the `If` node) ──────────────────────────────────────────
// The ceiling is a single test — no boolean algebra, no arithmetic.

export const Condition = z.union([
  z.object({ $exists: z.string().min(1).max(200) }).strict(),
  z
    .object({
      $eq: z.tuple([z.string().min(1).max(200), z.union([z.string(), z.number(), z.boolean()])]),
    })
    .strict(),
]);
export type Condition = z.infer<typeof Condition>;

// ── Styleable prop enums (each maps to a `data-*` value on an `st-tpl-*` class) ─
const Gap = z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']);
const Pad = z.enum(['none', 'sm', 'md', 'lg', 'xl']);
const Dir = z.enum(['col', 'row']);
const AlignItems = z.enum(['start', 'center', 'end', 'stretch']);
const Justify = z.enum(['start', 'center', 'end', 'between']);
const BoxTone = z.enum(['none', 'surface', 'subtle', 'inverse', 'brand-tint', 'accent-tint']);
const TextTone = z.enum(['default', 'secondary', 'muted']);
const IconTone = z.enum(['default', 'muted', 'accent', 'brand']);
const Radius = z.enum(['none', 'sm', 'md', 'lg', 'pill']);
const TextSize = z.enum(['sm', 'md', 'lg']);
const IconSize = z.enum(['sm', 'md', 'lg']);
const SpacerSize = z.enum(['sm', 'md', 'lg', 'xl']);
const Cols = z.enum(['1', '2', '3', '4']);
const HeadingLevel = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const ImageRatio = z.enum(['auto', '1:1', '4:3', '16:9', '21:9']);
const ImageFit = z.enum(['cover', 'contain']);
const ButtonVariant = z.enum(['solid', 'light', 'dark', 'ghost', 'link']);
const EmbedRatio = z.enum(['16:9', '4:3', '1:1']);

/** A variant prop the tenant MAY bind to a field; the interpreter validates
 *  the resolved value against the enum at render and falls back to the default
 *  when it isn't a member. (Only `Grid.cols` uses this in v1.) */
const Bindable = <T extends z.ZodTypeAny>(lit: T) => z.union([lit, BindExpr]);

// ── Node types (TS) ─────────────────────────────────────────────────────────
// Hand-written so the recursive `children` is well-typed for consumers.

interface StackNode {
  type: 'Stack';
  dir?: z.infer<typeof Dir>;
  gap?: z.infer<typeof Gap>;
  align?: z.infer<typeof AlignItems>;
  justify?: z.infer<typeof Justify>;
  wrap?: boolean;
  children?: TemplateNode[];
}
interface GridNode {
  type: 'Grid';
  cols?: z.infer<typeof Cols> | BindExpr;
  gap?: z.infer<typeof Gap>;
  children?: TemplateNode[];
}
interface BoxNode {
  type: 'Box';
  pad?: z.infer<typeof Pad>;
  tone?: z.infer<typeof BoxTone>;
  radius?: z.infer<typeof Radius>;
  border?: boolean;
  children?: TemplateNode[];
}
interface HeadingNode {
  type: 'Heading';
  level?: 1 | 2 | 3;
  text: ValueExpr;
}
interface TextNode {
  type: 'Text';
  text: ValueExpr;
  tone?: z.infer<typeof TextTone>;
  size?: z.infer<typeof TextSize>;
}
interface RichTextNode {
  type: 'RichText';
  html: ValueExpr;
}
interface ImageNode {
  type: 'Image';
  src: ValueExpr;
  alt?: ValueExpr;
  ratio?: z.infer<typeof ImageRatio>;
  fit?: z.infer<typeof ImageFit>;
}
interface IconNode {
  type: 'Icon';
  name: ValueExpr;
  size?: z.infer<typeof IconSize>;
  tone?: z.infer<typeof IconTone>;
}
interface ButtonNode {
  type: 'Button';
  label: ValueExpr;
  url: ValueExpr;
  variant?: z.infer<typeof ButtonVariant>;
}
interface LinkNode {
  type: 'Link';
  label: ValueExpr;
  url: ValueExpr;
}
interface DividerNode {
  type: 'Divider';
}
interface SpacerNode {
  type: 'Spacer';
  size?: z.infer<typeof SpacerSize>;
}
interface RepeaterNode {
  type: 'Repeater';
  each: string;
  children: TemplateNode[];
}
interface IfNode {
  type: 'If';
  test: Condition;
  children: TemplateNode[];
  else?: TemplateNode[];
}
interface EmbedNode {
  type: 'Embed';
  url: ValueExpr;
  title?: ValueExpr;
  ratio?: z.infer<typeof EmbedRatio>;
}

export type TemplateNode =
  | StackNode
  | GridNode
  | BoxNode
  | HeadingNode
  | TextNode
  | RichTextNode
  | ImageNode
  | IconNode
  | ButtonNode
  | LinkNode
  | DividerNode
  | SpacerNode
  | RepeaterNode
  | IfNode
  | EmbedNode;

/** The recognized node `type` literals — used by the validator + interpreter. */
export const TEMPLATE_NODE_TYPES = [
  'Stack',
  'Grid',
  'Box',
  'Heading',
  'Text',
  'RichText',
  'Image',
  'Icon',
  'Button',
  'Link',
  'Divider',
  'Spacer',
  'Repeater',
  'If',
  'Embed',
] as const;

// ── Node schemas ─────────────────────────────────────────────────────────────
// `children` defers to the (later-defined) node union via z.lazy so the
// recursive reference resolves at parse time, not definition time.

const children = (min = 0) =>
  z
    .array(z.lazy((): z.ZodType<TemplateNode> => SectionTemplate))
    .min(min)
    .max(50);

const Stack = z
  .object({
    type: z.literal('Stack'),
    dir: Dir.optional(),
    gap: Gap.optional(),
    align: AlignItems.optional(),
    justify: Justify.optional(),
    wrap: z.boolean().optional(),
    children: children().optional(),
  })
  .strict();

const Grid = z
  .object({
    type: z.literal('Grid'),
    cols: Bindable(Cols).optional(),
    gap: Gap.optional(),
    children: children().optional(),
  })
  .strict();

const Box = z
  .object({
    type: z.literal('Box'),
    pad: Pad.optional(),
    tone: BoxTone.optional(),
    radius: Radius.optional(),
    border: z.boolean().optional(),
    children: children().optional(),
  })
  .strict();

const Heading = z
  .object({
    type: z.literal('Heading'),
    level: HeadingLevel.optional(),
    text: ValueExpr,
  })
  .strict();

const Text = z
  .object({
    type: z.literal('Text'),
    text: ValueExpr,
    tone: TextTone.optional(),
    size: TextSize.optional(),
  })
  .strict();

const RichText = z.object({ type: z.literal('RichText'), html: ValueExpr }).strict();

const Image = z
  .object({
    type: z.literal('Image'),
    src: ValueExpr,
    alt: ValueExpr.optional(),
    ratio: ImageRatio.optional(),
    fit: ImageFit.optional(),
  })
  .strict();

const Icon = z
  .object({
    type: z.literal('Icon'),
    name: ValueExpr,
    size: IconSize.optional(),
    tone: IconTone.optional(),
  })
  .strict();

const Button = z
  .object({
    type: z.literal('Button'),
    label: ValueExpr,
    url: ValueExpr,
    variant: ButtonVariant.optional(),
  })
  .strict();

const Link = z.object({ type: z.literal('Link'), label: ValueExpr, url: ValueExpr }).strict();

const Divider = z.object({ type: z.literal('Divider') }).strict();

const Spacer = z.object({ type: z.literal('Spacer'), size: SpacerSize.optional() }).strict();

const Repeater = z
  .object({
    type: z.literal('Repeater'),
    // The key of a `list` field (in the current scope) to iterate.
    each: z.string().min(1).max(100),
    children: children(1),
  })
  .strict();

const If = z
  .object({
    type: z.literal('If'),
    test: Condition,
    children: children(1),
    else: children(1).optional(),
  })
  .strict();

const Embed = z
  .object({
    type: z.literal('Embed'),
    url: ValueExpr,
    title: ValueExpr.optional(),
    ratio: EmbedRatio.optional(),
  })
  .strict();

/**
 * The custom-section template: a single root node. Recursive via z.lazy on
 * `children`. Parsing enforces SHAPE (closed node set, enum props, value-expr
 * grammar); `validateTemplate` adds the SEMANTIC checks (path references, bound
 * scope, embed gating).
 */
export const SectionTemplate: z.ZodType<TemplateNode> = z.lazy(
  () =>
    z.discriminatedUnion('type', [
      Stack,
      Grid,
      Box,
      Heading,
      Text,
      RichText,
      Image,
      Icon,
      Button,
      Link,
      Divider,
      Spacer,
      Repeater,
      If,
      Embed,
    ]) as unknown as z.ZodType<TemplateNode>
);
