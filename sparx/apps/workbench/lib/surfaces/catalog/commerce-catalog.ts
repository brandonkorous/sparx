// What the business sells — products, the ways they are grouped, and the
// fitment and configurator structures attached to them.

import { Blocks, Layers, Package, Puzzle, Settings2, Shapes, Tags } from 'lucide-react';
import type { SurfaceDefinition } from '../registry';
import { ProductDetailSurface } from '../../../surfaces/commerce/product-detail';
import { ProductsListSurface } from '../../../surfaces/commerce/products-list';
import { ProductTypesListSurface } from '../../../surfaces/commerce/product-types-list';
import { ProductTypeDetailSurface } from '../../../surfaces/commerce/product-type-detail';
import { CollectionsListSurface } from '../../../surfaces/commerce/collections-list';
import { CollectionDetailSurface } from '../../../surfaces/commerce/collection-detail';
import { CategoriesListSurface } from '../../../surfaces/commerce/categories-list';
import { CategoryDetailSurface } from '../../../surfaces/commerce/category-detail';
import { BundlesListSurface } from '../../../surfaces/commerce/bundles-list';
import { BundleDetailSurface } from '../../../surfaces/commerce/bundle-detail';
import { ConfiguratorListSurface } from '../../../surfaces/commerce/configurator-list';
import { ConfiguratorTemplateDetailSurface } from '../../../surfaces/commerce/configurator-template-detail';
import { FitmentListSurface } from '../../../surfaces/commerce/fitment-list';
import { FitmentDomainDetailSurface } from '../../../surfaces/commerce/fitment-domain-detail';

export const CATALOG_SURFACES: SurfaceDefinition[] = [
  {
    key: 'commerce.products.list',
    title: 'Products',
    module: 'commerce',
    icon: Package,
    section: 'Catalog',
    order: 10,
    keywords: ['catalog', 'items', 'stock', 'sku', 'price', 'inventory'],
    component: ProductsListSurface,
    createSurface: 'commerce.product.detail',
    createLabel: 'Add a product',
  },
  {
    key: 'commerce.product.detail',
    title: 'Product',
    module: 'commerce',
    icon: Package,
    component: ProductDetailSurface,
    // Reachable from the list and from the nav panel's `+`, not as a launcher
    // entry of its own: opening "a product" with no product in mind is not a
    // thing anyone wants, and adding one is already offered where products live.
    listed: false,
  },
  {
    key: 'commerce.collections.list',
    title: 'Collections',
    module: 'commerce',
    icon: Layers,
    section: 'Catalog',
    order: 11,
    keywords: ['groups', 'categories'],
    // Custom list, not the generic entity list: it carries its own "Add a
    // collection" button and distinguishes manual from rule-driven collections.
    component: CollectionsListSurface,
  },
  {
    key: 'commerce.collection.detail',
    title: 'Collection',
    module: 'commerce',
    icon: Layers,
    component: CollectionDetailSurface,
    // Opened from the list ({id:'new'} to create, {id} to edit); a create is the
    // same surface as an edit, so it is a pane, not a launcher entry.
    listed: false,
  },
  {
    key: 'commerce.categories.list',
    title: 'Categories',
    module: 'commerce',
    icon: Tags,
    section: 'Catalog',
    order: 12,
    // Custom list that FLATTENS the category tree — the generic list showed only
    // root categories, so every sub-category was unreachable. Carries its own add.
    component: CategoriesListSurface,
  },
  {
    key: 'commerce.category.detail',
    title: 'Category',
    module: 'commerce',
    icon: Tags,
    component: CategoryDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.bundles.list',
    title: 'Bundles',
    module: 'commerce',
    icon: Blocks,
    section: 'Catalog',
    order: 13,
    keywords: ['kits', 'packages', 'sets'],
    component: BundlesListSurface,
  },
  {
    key: 'commerce.bundle.detail',
    title: 'Bundle',
    module: 'commerce',
    icon: Blocks,
    component: BundleDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.fitment.list',
    title: 'Fitment',
    module: 'commerce',
    icon: Puzzle,
    section: 'Catalog',
    order: 14,
    keywords: ['compatibility', 'fits', 'vehicles', 'models'],
    component: FitmentListSurface,
    createSurface: 'commerce.fitment.domain.detail',
    createLabel: 'New compatibility list',
  },
  {
    key: 'commerce.fitment.domain.detail',
    title: 'Compatibility list',
    module: 'commerce',
    icon: Puzzle,
    component: FitmentDomainDetailSurface,
    listed: false,
  },
  {
    key: 'commerce.configurator.list',
    title: 'Configurator',
    module: 'commerce',
    icon: Settings2,
    section: 'Catalog',
    order: 15,
    keywords: ['options', 'custom', 'build'],
    component: ConfiguratorListSurface,
  },
  {
    key: 'commerce.configurator-template.detail',
    title: 'Build template',
    module: 'commerce',
    icon: Settings2,
    component: ConfiguratorTemplateDetailSurface,
    listed: false,
  },
  // Product TYPES (docs/143) — the typed attribute schema a product carries, the
  // commerce mirror of CMS content types. NOT a product facet (the frozen set
  // above): this is a catalog-structure list + its editor, added here per docs/143
  // §6.7, so the "do not add a facet" rule above does not apply.
  {
    key: 'commerce.product-types.list',
    title: 'Product types',
    module: 'commerce',
    icon: Shapes,
    section: 'Catalog',
    order: 16,
    keywords: ['attributes', 'schema', 'fields', 'kind', 'fabric', 'ingredients', 'specs'],
    component: ProductTypesListSurface,
    createSurface: 'commerce.product-types.detail',
    createLabel: 'New product type',
  },
  {
    key: 'commerce.product-types.detail',
    title: 'Product type',
    module: 'commerce',
    icon: Shapes,
    component: ProductTypeDetailSurface,
    // Opened from the list and the nav panel's `+` ({key:'new'} to define, {key} to
    // edit) — a create is the same surface as an edit, so it is a pane, not a
    // launcher entry of its own.
    listed: false,
  },
];
