// assignmentService — per-record template overrides (docs/51 §6).
//
// A record (a content entry, a product, …) may pin itself to a specific
// collection template, beating the record type's default. The override lives in
// BuilderPageAssignment (builder-owned, keyed by recordType + itemRef), the
// analogue of the legacy sections tier's SiteLayoutAssignment. The storefront
// resolver (pageService.getPublishedByRecordType) consults these first.
//
// Tenant-scoped via withTenant() — a callsite that forgets it sees nothing
// (FORCE RLS). One service, many transports: REST mounts these; MCP/Server
// Actions reuse them unchanged.

import {
  SetAssignmentInput,
  type BuilderAssignmentDto,
  type BuilderTemplateOption,
} from '@sparx/builder-schemas';
import { withTenant } from '@sparx/db';

import type { PropertyContext } from '../errors';
import { BuilderNotFoundError, BuilderValidationError } from '../errors';

/** The collection templates a record type can resolve to — the option set the
 *  entry-editor's per-record picker lists, with the type default flagged. Ordered
 *  by catalog position so the picker reads stably. */
export function listTemplateOptions(
  ctx: PropertyContext,
  recordType: string
): Promise<BuilderTemplateOption[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: { recordType, kind: 'collection', propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isDefault: true, publishedTree: true },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      published: r.publishedTree != null,
    }));
  });
}

/** The current per-record override for (recordType, itemRef), or null when the
 *  record falls back to the type default. */
export function getAssignment(
  ctx: PropertyContext,
  recordType: string,
  itemRef: string
): Promise<BuilderAssignmentDto | null> {
  return withTenant(ctx, async (tx) => {
    const a = await tx.builderPageAssignment.findFirst({
      where: { recordType, itemRef, propertyId: ctx.propertyId },
    });
    return a
      ? { recordType: a.recordType, itemRef: a.itemRef, builderPageId: a.builderPageId }
      : null;
  });
}

/** Set or CLEAR (builderPageId: null) a per-record override. Setting validates
 *  the target is a collection template for the SAME recordType, so an override
 *  can never point a record at a template built for a different type. */
export async function setAssignment(
  ctx: PropertyContext,
  rawInput: unknown
): Promise<BuilderAssignmentDto | null> {
  const input = SetAssignmentInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    if (input.builderPageId === null) {
      await tx.builderPageAssignment.deleteMany({
        where: { recordType: input.recordType, itemRef: input.itemRef, propertyId: ctx.propertyId },
      });
      return null;
    }
    const page = await tx.builderPage.findFirst({
      where: { id: input.builderPageId, propertyId: ctx.propertyId },
    });
    if (!page) throw new BuilderNotFoundError('BuilderPage', input.builderPageId);
    if (page.kind !== 'collection' || page.recordType !== input.recordType) {
      throw new BuilderValidationError('That template does not target this record type.', [
        { field: 'builderPageId', message: 'Pick a collection template for this record type.' },
      ]);
    }
    const a = await tx.builderPageAssignment.upsert({
      where: {
        tenantId_propertyId_recordType_itemRef: {
          tenantId: ctx.tenantId,
          propertyId: ctx.propertyId,
          recordType: input.recordType,
          itemRef: input.itemRef,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        recordType: input.recordType,
        itemRef: input.itemRef,
        builderPageId: input.builderPageId,
      },
      update: { builderPageId: input.builderPageId },
    });
    return { recordType: a.recordType, itemRef: a.itemRef, builderPageId: a.builderPageId };
  });
}
