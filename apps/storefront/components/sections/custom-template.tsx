// Custom-section interpreter — turns a validated template AST into storefront
// markup (docs/38 Phase C; docs/handoffs/sitebuilder-custom-section-template-spec.md).
//
// This is the thin React half of the interpreter: it walks the closed node set
// and emits a closed family of `sf-tpl-*` classes + `data-*` enums (defined once
// in storefront.css), delegating ALL value resolution to the pure evaluator in
// @sparx/sitebuilder-schemas. There is no path from template data to a raw class,
// style, or executable string — every styleable prop is an enum, every text/url
// is a resolved value-expression, and unknown icons / gated Embed render nothing.

import { Fragment } from 'react';
import type { ReactNode } from 'react';

import {
  resolveValue,
  evalCondition,
  resolveEnum,
  type TemplateNode,
  type EvalContext,
  type EvalScope,
} from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbLink } from './_shared';
import { TemplateIcon } from './_icons';

const COLS = ['1', '2', '3', '4'] as const;
const BUTTON_VARIANTS = ['solid', 'light', 'dark', 'ghost', 'link'] as const;
// Defensive cap mirroring the AST's 50-iteration ceiling.
const REPEATER_CAP = 50;

function renderChildren(
  nodes: TemplateNode[] | undefined,
  scope: EvalScope,
  ctx: EvalContext,
  sctx: SectionContext,
  key: string
): ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => renderNode(n, scope, ctx, sctx, `${key}.${i}`));
}

function renderNode(
  node: TemplateNode,
  scope: EvalScope,
  ctx: EvalContext,
  sctx: SectionContext,
  key: string
): ReactNode {
  switch (node.type) {
    case 'Stack':
      return (
        <div
          key={key}
          className="sf-tpl-stack"
          data-dir={node.dir}
          data-gap={node.gap}
          data-align={node.align}
          data-justify={node.justify}
          data-wrap={node.wrap ? '' : undefined}
        >
          {renderChildren(node.children, scope, ctx, sctx, key)}
        </div>
      );
    case 'Grid':
      return (
        <div
          key={key}
          className="sf-tpl-grid"
          data-cols={resolveEnum(node.cols, COLS, '2', scope, ctx)}
          data-gap={node.gap}
        >
          {renderChildren(node.children, scope, ctx, sctx, key)}
        </div>
      );
    case 'Box':
      return (
        <div
          key={key}
          className="sf-tpl-box"
          data-pad={node.pad}
          data-tone={node.tone}
          data-radius={node.radius}
          data-border={node.border ? '' : undefined}
        >
          {renderChildren(node.children, scope, ctx, sctx, key)}
        </div>
      );
    case 'Heading': {
      const text = resolveValue(node.text, scope, ctx);
      if (node.level === 1)
        return (
          <h1 key={key} className="sf-h1">
            {text}
          </h1>
        );
      if (node.level === 3)
        return (
          <h3 key={key} className="sf-h3">
            {text}
          </h3>
        );
      return (
        <h2 key={key} className="sf-h2">
          {text}
        </h2>
      );
    }
    case 'Text':
      return (
        <p key={key} className="sf-tpl-text" data-tone={node.tone} data-size={node.size}>
          {resolveValue(node.text, scope, ctx)}
        </p>
      );
    case 'RichText': {
      const html = resolveValue(node.html, scope, ctx);
      if (!html) return null;
      // richtext field values are sanitized at write time (the same trust model
      // as the rich-text section — see rich-text.tsx); the storefront renders its
      // own published content.
      return <div key={key} className="sf-prose" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'Image': {
      const url = mediaUrl(resolveValue(node.src, scope, ctx) || null, sctx.tenantSlug);
      if (!url) return null;
      const alt = node.alt ? resolveValue(node.alt, scope, ctx) : '';
      return (
        <div
          key={key}
          className="sf-tpl-img"
          data-ratio={node.ratio ?? '16:9'}
          data-fit={node.fit}
          role="img"
          aria-label={alt || undefined}
          style={{ backgroundImage: `url("${url}")` }}
        />
      );
    }
    case 'Icon':
      return (
        <span key={key} className="sf-tpl-icon" data-size={node.size} data-tone={node.tone}>
          <TemplateIcon name={resolveValue(node.name, scope, ctx)} />
        </span>
      );
    case 'Button':
      return (
        <SbLink
          key={key}
          className={`sf-btn sf-btn--${resolveEnum(node.variant, BUTTON_VARIANTS, 'solid', scope, ctx)}`}
          url={resolveValue(node.url, scope, ctx)}
          label={resolveValue(node.label, scope, ctx)}
        />
      );
    case 'Link':
      return (
        <SbLink
          key={key}
          className="sf-tpl-link"
          url={resolveValue(node.url, scope, ctx)}
          label={resolveValue(node.label, scope, ctx)}
        />
      );
    case 'Divider':
      return <hr key={key} className="sf-tpl-divider" />;
    case 'Spacer':
      return <div key={key} className="sf-tpl-spacer" data-size={node.size} aria-hidden="true" />;
    case 'Repeater': {
      // `each` names a list field in the current frame (top-level config, or the
      // enclosing Repeater item when nested) — matching the validator's scoping.
      const frame = scope.item ?? scope.field;
      const raw = frame[node.each];
      const items = Array.isArray(raw) ? raw.slice(0, REPEATER_CAP) : [];
      return (
        <Fragment key={key}>
          {items.map((item, i) =>
            renderChildren(
              node.children,
              { ...scope, item: item as Record<string, unknown>, index: i },
              ctx,
              sctx,
              `${key}.${i}`
            )
          )}
        </Fragment>
      );
    }
    case 'If': {
      const branch = evalCondition(node.test, scope, ctx) ? node.children : (node.else ?? []);
      return <Fragment key={key}>{renderChildren(branch, scope, ctx, sctx, key)}</Fragment>;
    }
    case 'Embed':
      // Gated until the host allowlist + CSP work lands (docs/37 §9).
      return null;
  }
}

/**
 * Render a custom section: a validated template AST + the section's config,
 * resolved against the tenant frame. Wrapped like the other static sections so
 * spacing/width match. Unwired until the registry/persistence layer resolves a
 * `custom:*` type to its pinned definition.
 */
export function CustomTemplateSection({
  template,
  config,
  ctx,
}: {
  template: TemplateNode;
  config: Record<string, unknown>;
  ctx: SectionContext;
}) {
  const evalCtx: EvalContext = {
    currency: ctx.currency,
    locale: ctx.locale,
    tenantSlug: ctx.tenantSlug,
  };
  const scope: EvalScope = {
    field: config,
    product: ctx.product as unknown as Record<string, unknown> | undefined,
    collection: ctx.collection as unknown as Record<string, unknown> | undefined,
  };
  return (
    <section className="sf-container sf-section sf-sb-custom">
      {renderNode(template, scope, evalCtx, ctx, 'n')}
    </section>
  );
}
