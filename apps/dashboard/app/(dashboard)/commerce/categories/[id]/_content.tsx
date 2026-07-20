import { notFound } from 'next/navigation';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';

import { CategoryEditForm, type CategoryEditData } from '../_components/category-edit-form';
import { loadCategoryParents } from '../_components/category-parent-options';

// Category detail content (docs/86 edit surface-type rule). The detail view IS a
// single edit form, so it renders directly as the surface-aware SurfaceFrame —
// the SAME component the /new route uses for create — with no bespoke header or
// inline delete: the frame supplies the chrome, and the record's facts + the
// destructive Delete live in the frame's summary aside. Rendered both by the
// `@detail` drawer/modal overlay (`surface="overlay"`, the registry default) and
// the full-page /commerce/categories/[id] route (`surface="page"`).

export const dynamic = 'force-dynamic';

interface CategoryDetailRow extends CategoryEditData {
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function CategoryDetailContent({
  id,
  surface = 'overlay',
}: {
  id: string;
  surface?: 'page' | 'overlay';
}) {
  let category: CategoryDetailRow;
  try {
    category = await api.get<CategoryDetailRow>(`/v1/commerce/categories/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const parents = await loadCategoryParents();
  // Multi-site (docs/49 §3): the tenant's sites, for the "Visible on sites" control.
  // SiteScopeField hides itself for single-site tenants, so this is a no-op there.
  const sites = await listProperties().catch(() => [] as Property[]);

  return (
    <CategoryEditForm
      surface={surface}
      category={category}
      parents={parents}
      sites={sites}
      meta={{
        productCount: category.productCount,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }}
    />
  );
}
