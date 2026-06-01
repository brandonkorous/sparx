// validateTemplate — author-time semantic checks for a custom-section template
// (docs/handoffs/sitebuilder-custom-section-template-spec.md §4, §10).
//
// SectionTemplate (section-template.ts) enforces SHAPE: the closed node set,
// enum props, the value-expression grammar. This adds the checks that need the
// section's field spec + binding as context:
//
//   • every `$bind` path resolves a legal scope (field.* / item.* / index /
//     ctx.* / product.* / collection.*), with `field.*` against declared fields,
//     `item.*`/`index` only inside a Repeater, and product/collection only when
//     the section declares that binding;
//   • a Repeater's `each` names a `list` field in the current scope;
//   • RichText binds a richtext field;
//   • Embed is rejected until the host allowlist lands (docs/37 §9).
//
// Returns an empty array when the template is valid. Callers map issues to their
// transport's validation envelope.

import { SectionTemplate } from './section-template';
import type { BindExpr, Condition, TemplateNode, ValueExpr } from './section-template';
import type { SectionField } from './fields';

export interface TemplateIssue {
  /** Dotted location within the template, e.g. `(root).children.0.text`. */
  path: string;
  message: string;
}

export interface TemplateValidationOptions {
  fieldSpec: SectionField[];
  /** A bound custom section may resolve `product.*` / `collection.*`. */
  binding?: 'product' | 'collection' | null;
}

const CTX_PATHS = new Set(['ctx.currency', 'ctx.locale', 'ctx.tenantSlug']);

interface Ctx {
  fieldKeys: Set<string>;
  fieldByKey: Map<string, SectionField>;
  binding: 'product' | 'collection' | null;
}

interface Scope {
  /** The current Repeater item's field keys, or null at the top level. */
  itemKeys: Set<string> | null;
  /** `list` fields resolvable by a Repeater `each` in the current scope. */
  listFields: Map<string, SectionField[]>;
}

function keysOf(fields: SectionField[]): Set<string> {
  return new Set(fields.map((f) => f.key));
}

function listFieldsOf(fields: SectionField[]): Map<string, SectionField[]> {
  const m = new Map<string, SectionField[]>();
  for (const f of fields) if (f.type === 'list') m.set(f.key, f.itemFields ?? []);
  return m;
}

function collectBinds(v: ValueExpr, out: BindExpr[]): void {
  if (typeof v === 'string') return;
  if ('$bind' in v) {
    out.push(v);
    return;
  }
  for (const part of v.$concat) collectBinds(part, out);
}

function checkPath(
  path: string,
  scope: Scope,
  ctx: Ctx,
  issues: TemplateIssue[],
  at: string
): void {
  if (path === 'index') {
    if (!scope.itemKeys)
      issues.push({ path: at, message: '`index` is only valid inside a Repeater' });
    return;
  }
  const dot = path.indexOf('.');
  const root = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? '' : path.slice(dot + 1);
  switch (root) {
    case 'field':
      if (!rest || !ctx.fieldKeys.has(rest))
        issues.push({ path: at, message: `unknown field "${rest}" in \`field.${rest}\`` });
      break;
    case 'item':
      if (!scope.itemKeys)
        issues.push({ path: at, message: '`item.*` is only valid inside a Repeater' });
      else if (!rest || !scope.itemKeys.has(rest))
        issues.push({ path: at, message: `unknown item field "${rest}"` });
      break;
    case 'ctx':
      if (!CTX_PATHS.has(path))
        issues.push({ path: at, message: `unknown context path "${path}"` });
      break;
    case 'product':
      if (ctx.binding !== 'product')
        issues.push({ path: at, message: '`product.*` requires a product-bound section' });
      break;
    case 'collection':
      if (ctx.binding !== 'collection')
        issues.push({ path: at, message: '`collection.*` requires a collection-bound section' });
      break;
    default:
      issues.push({ path: at, message: `unknown binding root "${root}" in "${path}"` });
  }
}

function checkValue(
  v: ValueExpr,
  scope: Scope,
  ctx: Ctx,
  issues: TemplateIssue[],
  at: string
): void {
  const binds: BindExpr[] = [];
  collectBinds(v, binds);
  for (const b of binds) checkPath(b.$bind, scope, ctx, issues, at);
}

function checkCondition(
  c: Condition,
  scope: Scope,
  ctx: Ctx,
  issues: TemplateIssue[],
  at: string
): void {
  if ('$exists' in c) checkPath(c.$exists, scope, ctx, issues, at);
  else checkPath(c.$eq[0], scope, ctx, issues, at);
}

function walkChildren(
  nodes: TemplateNode[] | undefined,
  scope: Scope,
  ctx: Ctx,
  issues: TemplateIssue[],
  at: string
): void {
  if (!nodes) return;
  nodes.forEach((n, i) => walk(n, scope, ctx, issues, `${at}.children.${i}`));
}

function walk(
  node: TemplateNode,
  scope: Scope,
  ctx: Ctx,
  issues: TemplateIssue[],
  at: string
): void {
  switch (node.type) {
    case 'Stack':
    case 'Box':
      walkChildren(node.children, scope, ctx, issues, at);
      break;
    case 'Grid':
      if (node.cols && typeof node.cols === 'object')
        checkPath(node.cols.$bind, scope, ctx, issues, `${at}.cols`);
      walkChildren(node.children, scope, ctx, issues, at);
      break;
    case 'Heading':
    case 'Text':
      checkValue(node.text, scope, ctx, issues, `${at}.text`);
      break;
    case 'RichText':
      checkValue(node.html, scope, ctx, issues, `${at}.html`);
      if (
        typeof node.html === 'object' &&
        '$bind' in node.html &&
        node.html.$bind.startsWith('field.')
      ) {
        const key = node.html.$bind.slice('field.'.length);
        const f = ctx.fieldByKey.get(key);
        if (f && f.type !== 'richtext')
          issues.push({
            path: `${at}.html`,
            message: 'RichText.html should bind a richtext field',
          });
      }
      break;
    case 'Image':
      checkValue(node.src, scope, ctx, issues, `${at}.src`);
      if (node.alt) checkValue(node.alt, scope, ctx, issues, `${at}.alt`);
      break;
    case 'Icon':
      checkValue(node.name, scope, ctx, issues, `${at}.name`);
      break;
    case 'Button':
    case 'Link':
      checkValue(node.label, scope, ctx, issues, `${at}.label`);
      checkValue(node.url, scope, ctx, issues, `${at}.url`);
      break;
    case 'Divider':
    case 'Spacer':
      break;
    case 'Repeater': {
      const itemFields = scope.listFields.get(node.each);
      if (!itemFields) {
        issues.push({
          path: `${at}.each`,
          message: `Repeater "each" must name a list field in scope; "${node.each}" is not one`,
        });
        break;
      }
      const inner: Scope = { itemKeys: keysOf(itemFields), listFields: listFieldsOf(itemFields) };
      walkChildren(node.children, inner, ctx, issues, at);
      break;
    }
    case 'If':
      checkCondition(node.test, scope, ctx, issues, `${at}.test`);
      walkChildren(node.children, scope, ctx, issues, at);
      if (node.else) walkChildren(node.else, scope, ctx, issues, `${at}.else`);
      break;
    case 'Embed':
      issues.push({
        path: at,
        message: 'Embed is not enabled yet — requires the host allowlist (docs/37 §9)',
      });
      break;
  }
}

/**
 * Validate a custom-section template against its field spec + binding. Returns
 * structural issues (from parsing) OR semantic issues (path/scope/embed) — an
 * empty array means the template is safe to persist.
 */
export function validateTemplate(
  template: unknown,
  opts: TemplateValidationOptions
): TemplateIssue[] {
  const parsed = SectionTemplate.safeParse(template);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({
      path: i.path.length ? i.path.join('.') : '(root)',
      message: i.message,
    }));
  }
  const ctx: Ctx = {
    fieldKeys: keysOf(opts.fieldSpec),
    fieldByKey: new Map(opts.fieldSpec.map((f) => [f.key, f])),
    binding: opts.binding ?? null,
  };
  const scope: Scope = { itemKeys: null, listFields: listFieldsOf(opts.fieldSpec) };
  const issues: TemplateIssue[] = [];
  walk(parsed.data, scope, ctx, issues, '(root)');
  return issues;
}
