// Custom-section definitions — the runtime bridge between a stored
// `tenant_section_definitions` row and the code-first SECTION_REGISTRY (docs/38
// Phase C; docs/handoffs/sitebuilder-custom-section-template-spec.md).
//
// A code section ships three artifacts (Zod schema + SectionField[] + a React
// renderer). A custom section is the DATA analogue: its config schema is DERIVED
// from a stored field spec (fieldSpecToZod) and its renderer is a stored template
// AST the storefront interprets. This module:
//   • namespaces custom types as `custom:<slug>` (so they never collide with the
//     code registry and the storefront can branch on the prefix);
//   • turns a persisted record into a registry-shaped definition;
//   • provides custom-AWARE variants of the registry lookups (parse config, target
//     allow-check, section library) that take the tenant's loaded definitions —
//     leaving the synchronous code-only registry functions untouched;
//   • defines the CRUD input contract (shape only; the SEMANTIC template check
//     lives in validateTemplate, which needs the field spec + binding).
//
// Zod-only / React-free, like the rest of this package.

import { z } from 'zod';
import type { SectionField, SectionFieldType } from './fields';
import { fieldSpecToZod } from './field-spec-to-zod';
import { SectionTemplate, type TemplateNode } from './section-template';
import {
  getSectionDefinition,
  sectionsForTarget,
  type SectionDefinition,
} from './section-registry';
import { getLayoutTarget, type TargetBinding } from './layout-targets';

// ── Namespacing ──────────────────────────────────────────────────────────────
// A placed section stores its type in SiteSection.sectionType (VarChar(63)). A
// custom type is `custom:` + slug, so the slug is capped so the whole type fits:
// 63 - "custom:".length(7) = 56.
export const CUSTOM_SECTION_PREFIX = 'custom:';
export const CUSTOM_SLUG_MAX = 56;
/** Lowercase kebab-case, starts with a letter, ≤56 chars (so `custom:<slug>` ≤ 63). */
export const CUSTOM_SLUG_RE = /^[a-z][a-z0-9-]{0,55}$/;

export function isCustomSectionType(type: string): boolean {
  return type.startsWith(CUSTOM_SECTION_PREFIX);
}

export function customSectionType(slug: string): string {
  return `${CUSTOM_SECTION_PREFIX}${slug}`;
}

/** The slug for a `custom:<slug>` type, or null if it isn't a custom type. */
export function customSlugOf(type: string): string | null {
  if (!isCustomSectionType(type)) return null;
  const slug = type.slice(CUSTOM_SECTION_PREFIX.length);
  return slug.length > 0 ? slug : null;
}

// ── Field-spec schema (CRUD validation) ──────────────────────────────────────
// Validates an incoming `SectionField[]` before it's persisted as a definition's
// field spec. Recursive (a `list` field carries itemFields), mirroring the
// section-template.ts z.lazy cast pattern.

// Kept in sync with SectionFieldType (fields.ts) — the type-level assertion
// below fails the build if the two ever diverge.
const SectionFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'richtext',
  'color',
  'font',
  'select',
  'number',
  'range',
  'boolean',
  'media',
  'url',
  'collection',
  'products',
  'list',
]);
type _FieldTypeInSync = [
  z.infer<typeof SectionFieldTypeSchema> extends SectionFieldType ? true : never,
  SectionFieldType extends z.infer<typeof SectionFieldTypeSchema> ? true : never,
];

const SectionFieldOptionSchema = z
  .object({ label: z.string().min(1).max(120), value: z.string().min(1).max(200) })
  .strict();

/** A config field's key — a safe JS identifier (it becomes a config object key). */
const FIELD_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const SectionFieldSchema: z.ZodType<SectionField> = z.lazy(
  () =>
    z
      .object({
        key: z.string().regex(FIELD_KEY_RE, 'must be a letter/digit/underscore identifier').max(64),
        label: z.string().min(1).max(120),
        type: SectionFieldTypeSchema,
        help: z.string().max(500).optional(),
        placeholder: z.string().max(200).optional(),
        options: z.array(SectionFieldOptionSchema).max(50).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
        itemLabel: z.string().max(120).optional(),
        // One level of nesting (a list's per-item fields); deeper nesting isn't
        // supported by the renderer (a Repeater iterates one list).
        itemFields: z.array(z.lazy(() => SectionFieldSchema)).max(30).optional(),
      })
      .strict() as unknown as z.ZodType<SectionField>
);

/** A definition's whole field spec (the inspector form). */
export const SectionFieldSpecSchema = z.array(SectionFieldSchema).max(30);

// ── Runtime definition ───────────────────────────────────────────────────────

/** A custom section's persisted shape (a `tenant_section_definitions` row, minus
 *  tenant/timestamps). `fieldSpec`/`template` are already-parsed JSON. */
export interface CustomSectionRecord {
  slug: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  binding?: string | null;
  fieldSpec: SectionField[];
  template: TemplateNode;
  version: number;
}

/** A custom section resolved into the registry's definition shape, plus the
 *  extras the interpreter + snapshot need (the template AST + its version). A
 *  structural superset of SectionDefinition (its `type` is the wider `string`). */
export interface CustomSectionDefinition {
  type: string; // `custom:<slug>`
  slug: string;
  label: string;
  description: string;
  icon: string;
  binding?: TargetBinding;
  schema: z.ZodType;
  fields: SectionField[];
  template: TemplateNode;
  version: number;
  /** Discriminator so consumers can branch a code vs custom definition. */
  custom: true;
}

export type AnySectionDefinition = SectionDefinition | CustomSectionDefinition;

export function isCustomDefinition(def: AnySectionDefinition): def is CustomSectionDefinition {
  return 'custom' in def && def.custom === true;
}

function normalizeBinding(b: string | null | undefined): TargetBinding | undefined {
  return b === 'product' || b === 'collection' ? b : undefined;
}

/** Build the live definition for a stored custom-section record: derive its config
 *  validator from the field spec and carry the template AST + version through. */
export function toCustomSectionDefinition(rec: CustomSectionRecord): CustomSectionDefinition {
  return {
    type: customSectionType(rec.slug),
    slug: rec.slug,
    label: rec.label,
    description: rec.description ?? '',
    icon: rec.icon ?? 'Puzzle',
    binding: normalizeBinding(rec.binding),
    schema: fieldSpecToZod(rec.fieldSpec),
    fields: rec.fieldSpec,
    template: rec.template,
    version: rec.version,
    custom: true,
  };
}

// ── Custom-aware registry lookups ─────────────────────────────────────────────
// These mirror the code-only functions in section-registry.ts but also consult a
// tenant's loaded custom definitions. The service loads `customDefs` once per
// request (tenant-scoped via RLS) and threads it through.

/** Resolve a section type to its definition — code registry first, then the
 *  tenant's custom definitions for a `custom:<slug>` type. */
export function resolveSectionDefinition(
  type: string,
  customDefs: CustomSectionDefinition[] = []
): AnySectionDefinition | undefined {
  if (isCustomSectionType(type)) return customDefs.find((d) => d.type === type);
  return getSectionDefinition(type);
}

/**
 * Validate + fill defaults for a section's config against its resolved definition
 * (code or custom). Throws ZodError on bad input / unknown type — the same
 * contract as parseSectionConfig, extended to custom types.
 */
export function parseSectionConfigWith(
  type: string,
  raw: unknown,
  customDefs: CustomSectionDefinition[] = []
): Record<string, unknown> {
  const def = resolveSectionDefinition(type, customDefs);
  if (!def) {
    throw new z.ZodError([
      { code: 'custom', message: `Unknown section type: ${type}`, path: ['sectionType'], input: type },
    ]);
  }
  return def.schema.parse(raw ?? {}) as Record<string, unknown>;
}

/** Whether a section type (code or custom) may be added to a target's layout —
 *  static everywhere; a bound section only in targets of the same binding. */
export function isSectionAllowedInTargetWith(
  type: string,
  targetId: string,
  customDefs: CustomSectionDefinition[] = []
): boolean {
  const def = resolveSectionDefinition(type, customDefs);
  if (!def) return false;
  if (!def.binding) return true;
  const target = getLayoutTarget(targetId);
  return !!target && target.binding === def.binding;
}

/** The custom definitions addable within a target (same binding rule as code). */
export function customSectionsForTarget(
  targetId: string,
  customDefs: CustomSectionDefinition[]
): CustomSectionDefinition[] {
  return customDefs.filter((d) => isSectionAllowedInTargetWith(d.type, targetId, customDefs));
}

/** The full section library for a target — code sections then the tenant's
 *  custom ones (the editor's "add a section" list). */
export function mergedSectionsForTarget(
  targetId: string,
  customDefs: CustomSectionDefinition[]
): AnySectionDefinition[] {
  return [...sectionsForTarget(targetId), ...customSectionsForTarget(targetId, customDefs)];
}

// ── CRUD input ─────────────────────────────────────────────────────────────
// Shape-only validation for create/update of a definition. The service runs
// validateTemplate(template, { fieldSpec, binding }) on top of this for the
// semantic checks (path references, embed gating) and persists `version`.

export const SectionDefinitionInput = z
  .object({
    slug: z.string().regex(CUSTOM_SLUG_RE, 'lowercase kebab-case, starts with a letter, ≤56 chars'),
    label: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    icon: z.string().max(63).optional(),
    binding: z.enum(['product', 'collection']).nullish(),
    fieldSpec: SectionFieldSpecSchema,
    template: SectionTemplate,
  })
  .strict();
export type SectionDefinitionInput = z.infer<typeof SectionDefinitionInput>;

/** Update omits the slug (immutable — it's the type identity that placed sections
 *  reference); every other field is replaceable. */
export const SectionDefinitionUpdateInput = SectionDefinitionInput.omit({ slug: true });
export type SectionDefinitionUpdateInput = z.infer<typeof SectionDefinitionUpdateInput>;
