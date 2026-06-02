// definitionService — CRUD for a tenant's custom section TYPES (docs/38 Phase C;
// docs/handoffs/sitebuilder-custom-section-template-spec.md). A definition is the
// data-defined analogue of a code SECTION_REGISTRY entry: a field spec (the
// inspector form) + a render-template AST the storefront interprets. Placed
// sections reference it by `custom:<slug>`.
//
// Tenant-scoped via withTenant; TenantSectionDefinition is ENABLE+FORCE RLS, so a
// findFirst by slug is implicitly tenant-isolated (a cross-tenant slug is
// invisible). Shape is validated by SectionDefinitionInput; the SEMANTIC template
// check (bound paths reference declared fields, embed gating) runs here via
// validateTemplate before persisting. Editing bumps `version` so a later publish
// re-pins the new AST into its snapshot (publish-internals).

import {
  SectionDefinitionInput,
  SectionDefinitionUpdateInput,
  validateTemplate,
  customSectionType,
  toCustomSectionDefinition,
  type CustomSectionDefinition,
  type SectionField,
  type TemplateNode,
} from '@sparx/sitebuilder-schemas';
import type { Prisma, TenantSectionDefinition, TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import {
  SitebuilderConflictError,
  SitebuilderNotFoundError,
  SitebuilderValidationError,
} from '../errors';

export interface DefinitionView {
  id: string;
  slug: string;
  /** The placed-section type — `custom:<slug>`. */
  type: string;
  label: string;
  description: string | null;
  icon: string | null;
  binding: 'product' | 'collection' | null;
  fieldSpec: SectionField[];
  template: TemplateNode;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function normalizeBinding(b: string | null): 'product' | 'collection' | null {
  return b === 'product' || b === 'collection' ? b : null;
}

function toView(row: TenantSectionDefinition): DefinitionView {
  return {
    id: row.id,
    slug: row.slug,
    type: customSectionType(row.slug),
    label: row.label,
    description: row.description,
    icon: row.icon,
    binding: normalizeBinding(row.binding),
    fieldSpec: (row.fieldSpec ?? []) as unknown as SectionField[],
    template: row.template as unknown as TemplateNode,
    version: row.version,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Load the tenant's ACTIVE custom definitions as registry-shaped definitions
 * (each with a derived config schema). Consumed by sectionService to validate +
 * scope-check `custom:<slug>` writes, and by the editor's section library. The
 * stored field spec / template were validated at write time, so the parse →
 * definition conversion trusts them.
 */
export async function loadCustomDefinitions(tx: TxClient): Promise<CustomSectionDefinition[]> {
  const rows = await tx.tenantSectionDefinition.findMany({ where: { status: 'active' } });
  return rows.map((r) =>
    toCustomSectionDefinition({
      slug: r.slug,
      label: r.label,
      description: r.description,
      icon: r.icon,
      binding: r.binding,
      fieldSpec: (r.fieldSpec ?? []) as unknown as SectionField[],
      template: r.template as unknown as TemplateNode,
      version: r.version,
    })
  );
}

export function list(ctx: ServiceContext): Promise<DefinitionView[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.tenantSectionDefinition.findMany({ orderBy: { label: 'asc' } });
    return rows.map(toView);
  });
}

export async function get(ctx: ServiceContext, slug: string): Promise<DefinitionView> {
  const row = await withTenant(ctx, (tx) =>
    tx.tenantSectionDefinition.findFirst({ where: { slug } })
  );
  if (!row) throw new SitebuilderNotFoundError('TenantSectionDefinition', slug);
  return toView(row);
}

// Reject a template whose bound paths / structure don't fit its field spec +
// binding. Shape is already enforced by SectionDefinitionInput; this adds the
// semantic checks that need the field spec as context.
function assertTemplateValid(
  template: unknown,
  fieldSpec: SectionField[],
  binding: 'product' | 'collection' | null
): void {
  const issues = validateTemplate(template, { fieldSpec, binding });
  if (issues.length > 0) {
    throw new SitebuilderValidationError(
      'The section template is invalid.',
      issues.map((i) => ({ field: i.path, message: i.message }))
    );
  }
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<DefinitionView> {
  const input = SectionDefinitionInput.parse(rawInput);
  const binding = input.binding ?? null;
  assertTemplateValid(input.template, input.fieldSpec, binding);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.tenantSectionDefinition.findFirst({ where: { slug: input.slug } });
    if (existing) {
      throw new SitebuilderConflictError(
        `A custom section with the slug "${input.slug}" already exists.`,
        'slug'
      );
    }
    const row = await tx.tenantSectionDefinition.create({
      data: {
        tenantId: ctx.tenantId,
        slug: input.slug,
        label: input.label,
        description: input.description ?? null,
        icon: input.icon ?? null,
        binding,
        fieldSpec: input.fieldSpec as unknown as Prisma.InputJsonValue,
        template: input.template as unknown as Prisma.InputJsonValue,
        version: 1,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.definition.created',
      entityType: 'TenantSectionDefinition',
      entityId: row.id,
      diff: { after: { slug: row.slug, label: row.label } },
    });
    return toView(row);
  });
}

/** Replace a definition (PUT semantics) and bump its version so the next publish
 *  re-pins the new template. The slug is immutable (it's the placed-section type). */
export async function update(
  ctx: ServiceContext,
  slug: string,
  rawInput: unknown
): Promise<DefinitionView> {
  const input = SectionDefinitionUpdateInput.parse(rawInput);
  const binding = input.binding ?? null;
  assertTemplateValid(input.template, input.fieldSpec, binding);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.tenantSectionDefinition.findFirst({ where: { slug } });
    if (!existing) throw new SitebuilderNotFoundError('TenantSectionDefinition', slug);
    const row = await tx.tenantSectionDefinition.update({
      where: { id: existing.id },
      data: {
        label: input.label,
        description: input.description ?? null,
        icon: input.icon ?? null,
        binding,
        fieldSpec: input.fieldSpec as unknown as Prisma.InputJsonValue,
        template: input.template as unknown as Prisma.InputJsonValue,
        version: existing.version + 1,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.definition.updated',
      entityType: 'TenantSectionDefinition',
      entityId: row.id,
      diff: { before: { version: existing.version }, after: { version: row.version } },
    });
    return toView(row);
  });
}

/**
 * Delete a definition. Refuses while DRAFT sections still place it (deleting
 * would leave unrenderable draft sections); already-published pages are
 * unaffected because publish pins the template into the version snapshot. The
 * tenant removes the placed sections first (or a future `archive` hides it from
 * the library without breaking drafts).
 */
export async function remove(ctx: ServiceContext, slug: string): Promise<{ slug: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.tenantSectionDefinition.findFirst({ where: { slug } });
    if (!existing) throw new SitebuilderNotFoundError('TenantSectionDefinition', slug);
    const inUse = await tx.siteSection.count({ where: { sectionType: customSectionType(slug) } });
    if (inUse > 0) {
      throw new SitebuilderConflictError(
        `"${existing.label}" is used by ${inUse} section${inUse === 1 ? '' : 's'}. Remove ${inUse === 1 ? 'it' : 'them'} before deleting this custom section.`,
        'slug'
      );
    }
    await tx.tenantSectionDefinition.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.definition.deleted',
      entityType: 'TenantSectionDefinition',
      entityId: existing.id,
      diff: { before: { slug: existing.slug, label: existing.label } },
    });
    return { slug };
  });
}
