'use client';

// Live render preview for the Section Studio (docs/38 Phase C; Section Studio
// increment 5). Renders the in-progress template AST against a synthesized sample
// config using the SAME interpreter the storefront uses at SSR
// (@sparx/section-template-react), via injected dashboard adapters — so what the
// author sees here is what a fresh (un-themed) storefront will render. Sample
// values are derived from the field spec; media resolves to a neutral placeholder
// and links render as inert spans (a preview never navigates).

import * as React from 'react';
import { TemplateRenderer, type TemplateAdapters } from '@sparx/section-template-react';
import type { EvalContext, SectionField, TemplateNode } from '@sparx/sitebuilder-schemas';

import '@sparx/section-template-react/section-template.css';
import './section-preview.css';

// A neutral image placeholder so `Image` nodes show framing without a real asset.
const PLACEHOLDER_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">' +
      '<rect width="160" height="120" fill="#e4e4e7"/>' +
      '<g fill="none" stroke="#a1a1aa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="40" y="34" width="80" height="56" rx="4"/>' +
      '<circle cx="62" cy="56" r="8"/>' +
      '<path d="M48 86l22-20 16 14 12-10 14 16"/></g></svg>'
  );

// Preview adapters: links/buttons render as inert spans carrying the same class
// (visually identical to the storefront's anchors, but a preview never navigates);
// media resolves to the placeholder.
const PREVIEW_ADAPTERS: TemplateAdapters = {
  Link: ({ label, className }) => (label ? <span className={className}>{label}</span> : null),
  resolveMediaSrc: (ref) => (ref ? PLACEHOLDER_IMG : null),
};

const SAMPLE_PRODUCT: Record<string, unknown> = {
  title: 'Sample Product',
  vendor: 'Acme Co.',
  price: 49.99,
  compareAtPrice: 64.99,
  sku: 'SP-001',
  description: 'A representative product used to preview product-bound sections.',
};

const SAMPLE_COLLECTION: Record<string, unknown> = {
  title: 'Sample Collection',
  description: 'A representative collection used to preview collection-bound sections.',
  productCount: 12,
};

// First non-blank candidate (trimmed), or undefined — so `??` can chain to a
// default without an empty string short-circuiting it.
function firstText(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

// Build a plausible sample value per field type so bound nodes resolve to
// something readable in the preview.
function synthesizeConfig(fields: SectionField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.key) continue;
    switch (f.type) {
      case 'text':
        out[f.key] = firstText(f.placeholder, f.label) ?? 'Sample text';
        break;
      case 'textarea':
        out[f.key] =
          firstText(f.placeholder) ??
          'A short paragraph of sample copy showing how body text reads in this section.';
        break;
      case 'richtext':
        out[f.key] =
          '<p>A paragraph of <strong>rich text</strong> with an <a href="#">inline link</a> to show formatting.</p>';
        break;
      case 'select':
        out[f.key] = f.options?.[0]?.value ?? '';
        break;
      case 'number':
      case 'range':
        out[f.key] = typeof f.min === 'number' ? f.min : 3;
        break;
      case 'boolean':
        out[f.key] = true;
        break;
      case 'media':
        out[f.key] = 'sample-media';
        break;
      case 'url':
        out[f.key] = '#';
        break;
      case 'list':
        out[f.key] = [synthesizeConfig(f.itemFields ?? []), synthesizeConfig(f.itemFields ?? [])];
        break;
      case 'products':
        out[f.key] = [];
        break;
      // color / font / collection carry no renderable text in v1.
      default:
        out[f.key] = '';
    }
  }
  return out;
}

export interface SectionPreviewProps {
  /** The validated template AST, or null while the template is invalid. */
  node: TemplateNode | null;
  fieldSpec: SectionField[];
  binding: 'product' | 'collection' | null;
}

export function SectionPreview({ node, fieldSpec, binding }: SectionPreviewProps) {
  const config = React.useMemo(() => synthesizeConfig(fieldSpec), [fieldSpec]);

  if (!node) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-[var(--color-border-default)] p-6 text-center text-xs text-[var(--color-text-muted)]">
        Fix the template to see a live preview.
      </div>
    );
  }

  const ctx: EvalContext = { currency: 'USD', locale: 'en-US', tenantSlug: '' };
  const scopeExtras =
    binding === 'product'
      ? { product: SAMPLE_PRODUCT }
      : binding === 'collection'
        ? { collection: SAMPLE_COLLECTION }
        : undefined;

  return (
    <div className="sb-section-preview">
      <div className="sb-section-preview__surface">
        <TemplateRenderer
          node={node}
          config={config}
          ctx={ctx}
          scopeExtras={scopeExtras}
          adapters={PREVIEW_ADAPTERS}
        />
      </div>
    </div>
  );
}
