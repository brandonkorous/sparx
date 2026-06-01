// Custom-section interpreter — turns a validated template AST into markup
// (docs/38 Phase C; docs/handoffs/sitebuilder-custom-section-template-spec.md).
//
// The shared half of the interpreter: it walks the closed node set and emits a
// closed family of `sf-tpl-*` classes + `data-*` enums (defined once in
// section-template.css), delegating ALL value resolution to the pure evaluator in
// @sparx/sitebuilder-schemas. App-specific concerns — how a link renders, how a
// media ref resolves to a URL — are injected as ADAPTERS, so the storefront (SSR)
// and the dashboard Section Studio preview render identically from this one path.
//
// There is no route from template data to a raw class, style, or executable
// string: every styleable prop is an enum mapped to a `data-*` attribute, every
// text/url is a resolved value-expression, and unknown icons / gated Embed render
// nothing.

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

import { TemplateIcon } from './icons';

const COLS = ['1', '2', '3', '4'] as const;
const BUTTON_VARIANTS = ['solid', 'light', 'dark', 'ghost', 'link'] as const;
// Defensive cap mirroring the AST's 50-iteration ceiling.
const REPEATER_CAP = 50;

/** App-specific render concerns the interpreter delegates, so the package owns no
 *  Next.js / storefront / dashboard dependency. */
export interface TemplateAdapters {
  /** Render a link or button anchor. The adapter decides internal vs external
   *  routing; renders nothing when label/url is empty. */
  Link: (props: { url: string; label: string; className?: string }) => ReactNode;
  /** Resolve a media ref (asset id or pasted URL) to a usable src, or null. */
  resolveMediaSrc: (ref: string) => string | null;
}

function renderChildren(
  nodes: TemplateNode[] | undefined,
  scope: EvalScope,
  ctx: EvalContext,
  adapters: TemplateAdapters,
  key: string
): ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => renderNode(n, scope, ctx, adapters, `${key}.${i}`));
}

function renderNode(
  node: TemplateNode,
  scope: EvalScope,
  ctx: EvalContext,
  adapters: TemplateAdapters,
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
          {renderChildren(node.children, scope, ctx, adapters, key)}
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
          {renderChildren(node.children, scope, ctx, adapters, key)}
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
          {renderChildren(node.children, scope, ctx, adapters, key)}
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
      // as the rich-text section); the host renders its own published content.
      return <div key={key} className="sf-prose" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'Image': {
      const ref = resolveValue(node.src, scope, ctx);
      const url = ref ? adapters.resolveMediaSrc(ref) : null;
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
    case 'Button': {
      const { Link } = adapters;
      return (
        <Link
          key={key}
          className={`sf-tpl-btn sf-tpl-btn--${resolveEnum(node.variant, BUTTON_VARIANTS, 'solid', scope, ctx)}`}
          url={resolveValue(node.url, scope, ctx)}
          label={resolveValue(node.label, scope, ctx)}
        />
      );
    }
    case 'Link': {
      const { Link } = adapters;
      return (
        <Link
          key={key}
          className="sf-tpl-link"
          url={resolveValue(node.url, scope, ctx)}
          label={resolveValue(node.label, scope, ctx)}
        />
      );
    }
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
              adapters,
              `${key}.${i}`
            )
          )}
        </Fragment>
      );
    }
    case 'If': {
      const branch = evalCondition(node.test, scope, ctx) ? node.children : (node.else ?? []);
      return <Fragment key={key}>{renderChildren(branch, scope, ctx, adapters, key)}</Fragment>;
    }
    case 'Embed':
      // Gated until the host allowlist + CSP work lands (docs/37 §9).
      return null;
  }
}

/**
 * Render a validated custom-section template AST against the section's config and
 * an evaluation context, using the injected adapters for links + media. Emits the
 * inner node tree only — the host wraps it (the storefront in a `<section>`, the
 * Studio in a scoped preview container).
 */
export function TemplateRenderer({
  node,
  config,
  ctx,
  scopeExtras,
  adapters,
}: {
  node: TemplateNode;
  config: Record<string, unknown>;
  ctx: EvalContext;
  scopeExtras?: { product?: Record<string, unknown>; collection?: Record<string, unknown> };
  adapters: TemplateAdapters;
}): ReactNode {
  const scope: EvalScope = {
    field: config,
    product: scopeExtras?.product,
    collection: scopeExtras?.collection,
  };
  return renderNode(node, scope, ctx, adapters, 'n');
}
