// @wizeworks/section-template-react — the shared React interpreter for custom-section
// templates (docs/38 Phase C). The storefront renders published custom sections
// with it (SSR); the dashboard Section Studio renders the live preview with it —
// one render path, injected adapters, so the preview can't drift from production.
//
// The `bx-tpl-*` CSS family ships alongside as ./section-template.css; import it
// once per host (the storefront layout; the Studio preview container).

export { TemplateRenderer, type TemplateAdapters } from './interpreter';
export { TemplateIcon, TEMPLATE_ICON_NAMES } from './icons';
