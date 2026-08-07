// Catalog-authoring MCP tools — the structural surface behind a site:
// categories (the tree), collections (merchandising lists), bundles +
// configurator templates, variant option lattices, product fitment, and
// per-locale product translations. Each is a thin wrapper over a
// service-layer function (locked decision #7: one service, three transports),
// so a fix in the service is a fix in REST, GraphQL, and MCP at once.
//
// Product create/update/publish/image live in ./write-tools.ts; this file is
// everything ELSE a merchant sets up around a product.

import { z } from 'zod';

import {
  AssignVariantOptionValuesInput,
  BulkAssignFitmentInput,
  CreateBundleInput,
  CreateCategoryInput,
  CreateCollectionInput,
  CreateConfigurationTemplateInput,
  CreateFitmentDomainInput,
  CreateFitmentNodeInput,
  CreateVariantInput,
  RenameVariantSkuInput,
  ReorderFitmentNodesInput,
  ReparentCategoryInput,
  SetCollectionProductsInput,
  SetProductOptionsInput,
  UpdateBundleInput,
  UpdateCategoryInput,
  UpdateCollectionInput,
  UpdateConfigurationTemplateInput,
  UpdateFitmentDomainInput,
  UpdateFitmentNodeInput,
  UpsertProductTranslationInput,
} from '@sparx/commerce-schemas';

import {
  categoryService,
  collectionService,
  configuratorService,
  fitmentService,
  productTranslationService,
  variantService,
} from '../services';
import type { AnyMcpTool, McpToolDefinition } from './registry';

const uuid = () => z.string().uuid();

// ─── Categories (the organizational tree) ────────────────────────────────

const createCategory: McpToolDefinition = {
  name: 'create_category',
  description:
    'Create a product category — a node in the organizational tree a shopper browses (e.g. "Engine > Fuel Injection"). A product lives in one canonical category. Pass parentId to nest it; omit for a top-level category.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateCategoryInput,
  run: (ctx, input) => categoryService.create(ctx, input),
};

const updateCategory: McpToolDefinition = {
  name: 'update_category',
  description:
    'Edit a category — name, handle, description, featured flag, imagery, SEO, or its per-site visibility. Send only the fields to change; omitted fields are left untouched. To MOVE a category in the tree use reparent_category.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateCategoryInput.extend({ categoryId: uuid() }),
  run: (ctx, input) => {
    const { categoryId, ...patch } = input as { categoryId: string } & Record<string, unknown>;
    return categoryService.update(ctx, categoryId, patch);
  },
};

const reparentCategory: McpToolDefinition = {
  name: 'reparent_category',
  description:
    'Move a category to a new parent and position in the tree. Pass newParentId null to make it a top-level category. Descendants move with it.',
  scope: 'write:commerce',
  confirmation: true,
  input: ReparentCategoryInput,
  run: (ctx, input) => categoryService.reparent(ctx, input),
};

const deleteCategory: McpToolDefinition = {
  name: 'delete_category',
  description:
    'Soft-delete a category. Products in it are not deleted — they lose this categorization. A category with children cannot be removed until the children are moved or removed.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ categoryId: uuid() }),
  run: (ctx, input) => categoryService.remove(ctx, (input as { categoryId: string }).categoryId),
};

const setProductCategories: McpToolDefinition = {
  name: 'set_product_categories',
  description:
    'Replace the full set of categories a product belongs to. Pass the product id and the complete list of category ids (an empty list clears them).',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: uuid(), categoryIds: z.array(uuid()).max(50) }),
  run: (ctx, input) => {
    const { productId, categoryIds } = input as { productId: string; categoryIds: string[] };
    return categoryService.setProductCategories(ctx, productId, categoryIds);
  },
};

// ─── Collections (merchandising lists) ────────────────────────────────────

const createCollection: McpToolDefinition = {
  name: 'create_collection',
  description:
    'Create a collection — a merchandising surface like "Featured" or "New for Spring". type `manual` is hand-curated (set members with set_collection_products); type `rules` auto-populates from a rule set evaluated at index time.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateCollectionInput,
  run: (ctx, input) => collectionService.create(ctx, input),
};

const updateCollection: McpToolDefinition = {
  name: 'update_collection',
  description:
    'Edit a collection — name, handle, description, type, rule set, featured flag, hero image, SEO, or per-site visibility. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateCollectionInput.extend({ collectionId: uuid() }),
  run: (ctx, input) => {
    const { collectionId, ...patch } = input as { collectionId: string } & Record<string, unknown>;
    return collectionService.update(ctx, collectionId, patch);
  },
};

const setCollectionProducts: McpToolDefinition = {
  name: 'set_collection_products',
  description:
    'Replace the members of a MANUAL collection with an explicit product list (an empty list clears it). For rule-driven collections, change the rule set via update_collection instead.',
  scope: 'write:commerce',
  confirmation: true,
  input: SetCollectionProductsInput,
  run: (ctx, input) => collectionService.setProducts(ctx, input),
};

const setProductCollections: McpToolDefinition = {
  name: 'set_product_collections',
  description:
    'Replace the full set of manual collections a single product belongs to. Pass the product id and the complete list of collection ids.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: uuid(), collectionIds: z.array(uuid()).max(100) }),
  run: (ctx, input) => {
    const { productId, collectionIds } = input as { productId: string; collectionIds: string[] };
    return collectionService.setProductCollections(ctx, productId, collectionIds);
  },
};

const deleteCollection: McpToolDefinition = {
  name: 'delete_collection',
  description: 'Soft-delete a collection. Its member products are unaffected.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ collectionId: uuid() }),
  run: (ctx, input) =>
    collectionService.remove(ctx, (input as { collectionId: string }).collectionId),
};

const reindexCollection: McpToolDefinition = {
  name: 'reindex_collection',
  description:
    'Recompute a rule-driven collection’s membership now (re-evaluate its rules against the catalog). Membership normally re-projects asynchronously on catalog changes; use this to force it.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ collectionId: uuid() }),
  run: (ctx, input) =>
    collectionService.reindex(ctx, (input as { collectionId: string }).collectionId),
};

// ─── Bundles + configurator templates ─────────────────────────────────────

const createBundle: McpToolDefinition = {
  name: 'create_bundle',
  description:
    'Create a product bundle: a set of component variants sold together with a pricing mode (fixed price, percent off the component sum, or sum-of-components) and an inventory mode.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateBundleInput,
  run: (ctx, input) => configuratorService.createBundle(ctx, input),
};

const updateBundle: McpToolDefinition = {
  name: 'update_bundle',
  description:
    'Edit a bundle — pricing mode, fixed price, percent off, inventory mode, or its component list. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateBundleInput.extend({ bundleId: uuid() }),
  run: (ctx, input) => {
    const { bundleId, ...patch } = input as { bundleId: string } & Record<string, unknown>;
    return configuratorService.updateBundle(ctx, bundleId, patch);
  },
};

const deleteBundle: McpToolDefinition = {
  name: 'delete_bundle',
  description: 'Delete a bundle. Its component products are unaffected.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ bundleId: uuid() }),
  run: (ctx, input) =>
    configuratorService.deleteBundle(ctx, (input as { bundleId: string }).bundleId),
};

const createConfiguratorTemplate: McpToolDefinition = {
  name: 'create_configurator_template',
  description:
    'Create a configurator template for a made-to-order / configurable product: the option groups, rules, and add-ons a shopper picks from to build their configuration.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateConfigurationTemplateInput,
  run: (ctx, input) => configuratorService.createTemplate(ctx, input),
};

const updateConfiguratorTemplate: McpToolDefinition = {
  name: 'update_configurator_template',
  description:
    'Edit a configurator template — name, description, status, layout, options, rules, or add-ons. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateConfigurationTemplateInput.extend({ templateId: uuid() }),
  run: (ctx, input) => {
    const { templateId, ...patch } = input as { templateId: string } & Record<string, unknown>;
    return configuratorService.updateTemplate(ctx, templateId, patch);
  },
};

const deleteConfiguratorTemplate: McpToolDefinition = {
  name: 'delete_configurator_template',
  description: 'Delete a configurator template.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ templateId: uuid() }),
  run: (ctx, input) =>
    configuratorService.deleteTemplate(ctx, (input as { templateId: string }).templateId),
};

// ─── Variants + option lattice ────────────────────────────────────────────

const createVariant: McpToolDefinition = {
  name: 'create_variant',
  description:
    'Add a variant (a sellable SKU) to an existing product — its own price, SKU, and stock policy, mapped onto the product’s option lattice via optionValueIds. For a single-variant product, create_product already made the default variant; use this to add sizes/colours.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateVariantInput.extend({ productId: uuid() }),
  run: (ctx, input) => {
    const { productId, ...body } = input as { productId: string } & Record<string, unknown>;
    return variantService.create(ctx, productId, body);
  },
};

const renameVariantSku: McpToolDefinition = {
  name: 'rename_variant_sku',
  description:
    'Change a variant’s SKU. SKUs are unique per tenant (even across soft-deleted variants); a collision is rejected. A dedicated tool because update_variant deliberately excludes the SKU.',
  scope: 'write:commerce',
  confirmation: true,
  input: RenameVariantSkuInput.extend({ variantId: uuid() }),
  run: (ctx, input) => {
    const { variantId, ...body } = input as { variantId: string } & Record<string, unknown>;
    return variantService.renameSku(ctx, variantId, body);
  },
};

const setDefaultVariant: McpToolDefinition = {
  name: 'set_default_variant',
  description:
    'Make a variant the product’s default — the one selected first on the product page and used for the product’s headline price.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ variantId: uuid() }),
  run: (ctx, input) => variantService.setDefault(ctx, (input as { variantId: string }).variantId),
};

const archiveVariant: McpToolDefinition = {
  name: 'archive_variant',
  description:
    'Archive (soft-delete) a variant. It drops out of the live site and lists but its SKU stays reserved and history is preserved. Restore with restore_variant.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ variantId: uuid() }),
  run: (ctx, input) => variantService.archive(ctx, (input as { variantId: string }).variantId),
};

const restoreVariant: McpToolDefinition = {
  name: 'restore_variant',
  description: 'Restore a previously archived variant.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ variantId: uuid() }),
  run: (ctx, input) => variantService.restore(ctx, (input as { variantId: string }).variantId),
};

const setProductOptions: McpToolDefinition = {
  name: 'set_product_options',
  description:
    'Replace a product’s full option set (e.g. Size, Colour) in one call. Existing options + values are dropped and re-created; existing variants are NOT touched — rebind them with assign_variant_option_values once the new lattice exists.',
  scope: 'write:commerce',
  confirmation: true,
  input: SetProductOptionsInput.extend({ productId: uuid() }),
  run: (ctx, input) => {
    const { productId, ...body } = input as { productId: string } & Record<string, unknown>;
    return variantService.setOptions(ctx, productId, body);
  },
};

const assignVariantOptionValues: McpToolDefinition = {
  name: 'assign_variant_option_values',
  description:
    'Map a variant onto the product’s option lattice by listing the option-value ids it represents (e.g. Size=M, Colour=Red). The set must span every option exactly once.',
  scope: 'write:commerce',
  confirmation: true,
  input: AssignVariantOptionValuesInput,
  run: (ctx, input) => variantService.assignOptionValues(ctx, input),
};

// ─── Product fitment (compatibility) ──────────────────────────────────────

const createFitmentDomain: McpToolDefinition = {
  name: 'create_fitment_domain',
  description:
    'Create a fitment domain — a compatibility taxonomy (e.g. "Vehicles" with Year/Make/Model/Engine levels) products can be matched against. Nodes (the actual values) are added with create_fitment_node.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateFitmentDomainInput,
  run: (ctx, input) => fitmentService.createDomain(ctx, input),
};

const updateFitmentDomain: McpToolDefinition = {
  name: 'update_fitment_domain',
  description:
    'Edit a fitment domain — display name, description, icon, dimensions, or position. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateFitmentDomainInput.extend({ domainId: uuid() }),
  run: (ctx, input) => {
    const { domainId, ...patch } = input as { domainId: string } & Record<string, unknown>;
    return fitmentService.updateDomain(ctx, domainId, patch);
  },
};

const deleteFitmentDomain: McpToolDefinition = {
  name: 'delete_fitment_domain',
  description:
    'Delete a fitment domain and its node tree. Product fitment rows referencing it are removed.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ domainId: uuid() }),
  run: (ctx, input) => fitmentService.deleteDomain(ctx, (input as { domainId: string }).domainId),
};

const createFitmentNode: McpToolDefinition = {
  name: 'create_fitment_node',
  description:
    'Add a value node to a fitment domain (e.g. a make "Ford" under the domain, or a model under a make). Pass parentId to nest it; omit for a top-level node.',
  scope: 'write:commerce',
  confirmation: true,
  input: CreateFitmentNodeInput,
  run: (ctx, input) => fitmentService.createNode(ctx, input),
};

const updateFitmentNode: McpToolDefinition = {
  name: 'update_fitment_node',
  description:
    'Edit a fitment node — name, slug, attributes, or position. Send only the fields to change.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpdateFitmentNodeInput.extend({ nodeId: uuid() }),
  run: (ctx, input) => {
    const { nodeId, ...patch } = input as { nodeId: string } & Record<string, unknown>;
    return fitmentService.updateNode(ctx, nodeId, patch);
  },
};

const deleteFitmentNode: McpToolDefinition = {
  name: 'delete_fitment_node',
  description: 'Delete a fitment node and its descendants.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ nodeId: uuid() }),
  run: (ctx, input) => fitmentService.deleteNode(ctx, (input as { nodeId: string }).nodeId),
};

const reorderFitmentNodes: McpToolDefinition = {
  name: 'reorder_fitment_nodes',
  description:
    'Set the order of sibling fitment nodes (same parent within a domain) by listing their ids in the desired order.',
  scope: 'write:commerce',
  confirmation: true,
  input: ReorderFitmentNodesInput,
  run: (ctx, input) => fitmentService.reorderNodes(ctx, input),
};

const bulkAssignFitment: McpToolDefinition = {
  name: 'bulk_assign_fitment',
  description:
    'Assign a fitment rule (a domain node + optional numeric ranges) to many products at once — "these 40 brake pads all fit this vehicle range".',
  scope: 'write:commerce',
  confirmation: true,
  input: BulkAssignFitmentInput,
  run: (ctx, input) => fitmentService.bulkAssign(ctx, input),
};

const deleteFitment: McpToolDefinition = {
  name: 'delete_fitment',
  description: 'Remove a single product-fitment rule (one applicability row) by its id.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ fitmentId: uuid() }),
  run: (ctx, input) =>
    fitmentService.deleteFitment(ctx, (input as { fitmentId: string }).fitmentId),
};

// ─── Product translations (localized copy) ────────────────────────────────

const upsertProductTranslation: McpToolDefinition = {
  name: 'upsert_product_translation',
  description:
    'Create or replace one locale’s translation of a product — localized title, description, and SEO. Pass the product id and the locale’s content.',
  scope: 'write:commerce',
  confirmation: true,
  input: UpsertProductTranslationInput.extend({ productId: uuid() }),
  run: (ctx, input) => {
    const { productId, ...body } = input as { productId: string } & Record<string, unknown>;
    return productTranslationService.upsert(ctx, productId, body);
  },
};

const deleteProductTranslation: McpToolDefinition = {
  name: 'delete_product_translation',
  description:
    'Remove one locale’s translation of a product; the base-language content is unaffected.',
  scope: 'write:commerce',
  confirmation: true,
  input: z.object({ productId: uuid(), locale: z.string().min(2).max(10) }),
  run: (ctx, input) => {
    const { productId, locale } = input as { productId: string; locale: string };
    return productTranslationService.remove(ctx, productId, locale);
  },
};

export const catalogWriteTools: AnyMcpTool[] = [
  createCategory,
  updateCategory,
  reparentCategory,
  deleteCategory,
  setProductCategories,
  createCollection,
  updateCollection,
  setCollectionProducts,
  setProductCollections,
  deleteCollection,
  reindexCollection,
  createBundle,
  updateBundle,
  deleteBundle,
  createConfiguratorTemplate,
  updateConfiguratorTemplate,
  deleteConfiguratorTemplate,
  createVariant,
  renameVariantSku,
  setDefaultVariant,
  archiveVariant,
  restoreVariant,
  setProductOptions,
  assignVariantOptionValues,
  createFitmentDomain,
  updateFitmentDomain,
  deleteFitmentDomain,
  createFitmentNode,
  updateFitmentNode,
  deleteFitmentNode,
  reorderFitmentNodes,
  bulkAssignFitment,
  deleteFitment,
  upsertProductTranslation,
  deleteProductTranslation,
];
