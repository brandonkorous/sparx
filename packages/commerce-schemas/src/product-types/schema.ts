// Product types (docs/143) — the commerce mirror of CMS content types.
//
// A ProductType declares an `attributeSchema` (a @sparx/field-schema
// FieldSchema — the same 15 field kinds content types use) that governs a
// product's `attributes` JSONB bag. The fixed commerce spine (variants, prices,
// inventory, images, SEO) is NEVER type-defined; only the descriptive attribute
// layer is. This file owns the schema shapes; ./builtins owns the starter set.

import { z } from 'zod';
import { FieldSchema } from '@sparx/field-schema';
import { ProductTypeKey } from '../products';

// A product type's attribute schema IS a field schema — one engine, two domains.
export const ProductTypeSchema = FieldSchema;
export type ProductTypeSchema = z.infer<typeof ProductTypeSchema>;

// The in-memory shape of a built-in or custom product type. Mirrors the columns
// of `commerce_product_types` so the seed migration and the api-rest boot
// re-upsert can read it directly.
export interface ProductTypeDefinition {
  key: string;
  name: string;
  pluralName?: string;
  description?: string;
  icon?: string;
  attributeSchema: ProductTypeSchema;
}

// ── Write surfaces (REST / MCP / workbench) ──────────────────────────────────

// Create a tenant product type. `key` is immutable once set (it's the link
// products carry); name/schema are editable via the update/replace-schema calls.
export const CreateProductTypeInput = z.object({
  key: ProductTypeKey,
  name: z.string().min(1).max(127),
  pluralName: z.string().min(1).max(127).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(63).optional(),
  // The web PROPERTY this type is scoped to. Omitted / null = available to every
  // site (the common case — a type is a generic schema). Mirrors ContentType.
  propertyId: z.string().uuid().nullish(),
  attributeSchema: ProductTypeSchema,
});
export type CreateProductTypeInput = z.infer<typeof CreateProductTypeInput>;

// Update a product type's presentation + schema. `key` is NOT updatable — a
// product type is renamed/reshaped, never re-keyed (that would orphan every
// product pointing at the old key). Editing a built-in forks it in the service.
export const UpdateProductTypeInput = z.object({
  name: z.string().min(1).max(127).optional(),
  pluralName: z.string().min(1).max(127).nullish(),
  description: z.string().max(2000).nullish(),
  icon: z.string().max(63).nullish(),
  propertyId: z.string().uuid().nullish(),
  attributeSchema: ProductTypeSchema.optional(),
});
export type UpdateProductTypeInput = z.infer<typeof UpdateProductTypeInput>;

// Replace ONLY the attribute schema (the field-builder's Save). A dedicated
// surface so a schema edit forks a built-in without also touching presentation.
export const ReplaceProductTypeSchemaInput = z.object({
  attributeSchema: ProductTypeSchema,
});
export type ReplaceProductTypeSchemaInput = z.infer<typeof ReplaceProductTypeSchemaInput>;
