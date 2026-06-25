import { api } from '@/lib/api-rest-client';

import type { ProductOption } from './new-template-form';

// Shared server loader for the configurator-template CREATE surface (docs/86 F
// layout). Both the `/new` page route and the @detail overlay wrapper call this to
// feed the SAME `NewTemplateForm` create flow with its product picker — fetch
// products (including archived, so a template can bind to any product), sort by
// title, and map to the form's option shape. Server-side (uses
// `@/lib/api-rest-client`); never a client module.

interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
}

export async function loadConfiguratorProducts(): Promise<ProductOption[]> {
  const { data: items } = await api.getPaged<ProductListItem[]>(
    '/v1/commerce/products?take=250&include_archived=true'
  );
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  return sorted.map((p) => ({ id: p.id, title: p.title, handle: p.handle, status: p.status }));
}
