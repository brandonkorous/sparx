// Custom-section renderer (docs/38 Phase C). A thin storefront wrapper over the
// shared interpreter in @sparx/section-template-react: it supplies the storefront
// adapters (next/link via SbLink, media resolution via mediaUrl) and the section
// chrome, while the AST walk + `st-tpl-*` markup live in the shared package — so
// the dashboard Section Studio preview renders from the exact same path.

import { TemplateRenderer, type TemplateAdapters } from '@sparx/section-template-react';
import type { TemplateNode } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbLink } from './_shared';

/**
 * Render a custom section: a validated template AST + the section's config,
 * resolved against the tenant frame. Wrapped like the other static sections so
 * spacing/width match. The registry/persistence layer resolves a `custom:*`
 * type to its pinned definition and passes the template here.
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
  const adapters: TemplateAdapters = {
    // SbLink's props match the adapter contract exactly (url / label / className).
    Link: SbLink,
    resolveMediaSrc: (ref) => mediaUrl(ref || null, ctx.tenantSlug),
  };
  return (
    <section className="st-container st-section st-sb-custom">
      <TemplateRenderer
        node={template}
        config={config}
        ctx={{ currency: ctx.currency, locale: ctx.locale, tenantSlug: ctx.tenantSlug }}
        scopeExtras={{
          product: ctx.product as unknown as Record<string, unknown> | undefined,
          collection: ctx.collection as unknown as Record<string, unknown> | undefined,
        }}
        adapters={adapters}
      />
    </section>
  );
}
