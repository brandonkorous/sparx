import { notFound } from 'next/navigation';
import { FolderTree, Star } from 'lucide-react';

import { Badge, Heading, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { CategoryDeleteButton } from '../_components/category-delete-button';
import { CategoryEditForm, type CategoryEditData } from '../_components/category-edit-form';
import { loadCategoryParents } from '../_components/category-parent-options';

// Category detail content (§13.1). Rendered both by the `@detail` drawer/modal
// overlay and the full-page /commerce/categories/[id] route, so editing a
// category is uniform with every other entity rather than inline on the tree.

export const dynamic = 'force-dynamic';

interface CategoryDetailRow extends CategoryEditData {
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function CategoryDetailContent({ id }: { id: string }) {
  let category: CategoryDetailRow;
  try {
    category = await api.get<CategoryDetailRow>(`/v1/commerce/categories/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const parents = await loadCategoryParents();

  return (
    <Stack gap={6}>
      <Stack direction="row" align="end" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <FolderTree className="h-5 w-5" />
            <Heading level={1}>{category.name}</Heading>
            {category.featured && (
              <Badge variant="outline">
                <Star className="mr-1 h-3 w-3" />
                featured
              </Badge>
            )}
            <Badge variant="outline">
              {category.productCount} product{category.productCount === 1 ? '' : 's'}
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            /{category.handle}
          </Text>
        </Stack>
        <CategoryDeleteButton categoryId={category.id} name={category.name} />
      </Stack>

      <CategoryEditForm category={category} parents={parents} />
    </Stack>
  );
}
