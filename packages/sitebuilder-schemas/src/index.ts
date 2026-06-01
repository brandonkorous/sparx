// @sparx/sitebuilder-schemas — barrel.
//
// Single source of truth for the shape of every Site Builder section config,
// the site-settings overlay, layout-slot configs, and the write inputs used
// across the service layer (@sparx/sitebuilder), REST/MCP transports, the
// dashboard customizer, and the storefront renderer.

export * from './common';
export * from './fields';
export * from './layout-targets';
export * from './section-registry';
// Custom-section template language (docs/38 Phase C): the AST schema, the
// field-spec→Zod deriver, and the author-time validator.
export * from './section-template';
export * from './field-spec-to-zod';
export * from './section-template-validate';
export * from './default-templates';
export * from './page-templates';
export * from './site-settings';
export * from './inputs';

// Section config schemas + inferred types (for storefront render typing).
export * from './sections/hero';
export * from './sections/featured-products';
export * from './sections/collection-grid';
export * from './sections/rich-text';
export * from './sections/image-banner';
export * from './sections/testimonials';
export * from './sections/email-signup';
export * from './sections/panels';
export * from './sections/media-text';
export * from './sections/stats';
export * from './sections/carousel';
export * from './sections/product-bound';
export * from './sections/collection-bound';
