import type { EntityType } from '@sparx/seo-audit';

// The dashboard editor URL for an audited entity, so the SEO report can link to
// where the fixes are actually made. The builder page editor reads `?page=<id>`
// to open that page active on mount (builder/page/page.tsx → BuilderApp).
export function entityEditorHref(type: EntityType, id: string): string {
  switch (type) {
    case 'product':
      return `/commerce/products/${id}`;
    case 'collection':
      return `/commerce/collections/${id}`;
    case 'cms_page':
      return `/cms/${id}`;
    case 'builder_page':
      return `/builder/page?page=${id}`;
  }
}

export function entityEditLabel(type: EntityType): string {
  switch (type) {
    case 'product':
      return 'Open product';
    case 'collection':
      return 'Open collection';
    case 'cms_page':
      return 'Open page';
    case 'builder_page':
      return 'Open in builder';
  }
}
