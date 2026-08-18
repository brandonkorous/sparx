// The tenant's own columns (docs/146 Phase 11.8).
//
// Definitions in a table, values in a JSON column on the record. The split is
// argued in 63-inventory-onboarding.prisma; what this file adds is the rule that
// makes it safe:
//
//   NOTHING WRITES A CUSTOM-FIELD VALUE EXCEPT `applyCustomFields`.
//
// Every write goes through one coercion (`coerceCustomFieldValue`, pure, in
// @wizeworks/commerce-schemas) and one merge. That is what keeps a field's TYPE a
// promise rather than a hope: the API, the importer, the stock grid and the MCP
// tool all arrive here, so a number field cannot end up holding "n/a" because
// one of the four forgot to check.
//
// A value for a definition that no longer exists stays in the column and stops
// being read. Deleting a field somebody spent a morning filling in is then
// recoverable by re-creating it under the same key, which costs nothing to
// support and is the difference between a settings screen people trust and one
// they are frightened of.

import {
  CreateCustomFieldInput,
  CustomFieldEntity,
  UpdateCustomFieldInput,
  normalizeFieldKey,
  readCustomFields,
  validateCustomFieldValues,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CustomFieldValue,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

/** Which table holds the values for each entity, and what its primary key is
 *  called. One map, so adding a fifth entity is a compile error everywhere it
 *  needs to be rather than a silent no-op in one of five places. */
const VALUE_TABLES: Record<CustomFieldEntity, { table: string; label: string }> = {
  variant: { table: 'commerce_product_variants', label: 'item' },
  level: { table: 'inventory_levels', label: 'stock position' },
  supplier: { table: 'inventory_suppliers', label: 'supplier' },
  purchase_order: { table: 'inventory_purchase_orders', label: 'purchase order' },
};

interface CustomFieldRow {
  id: string;
  entity: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  helpText: string | null;
  required: boolean;
  showInList: boolean;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomFieldRowOut extends CustomFieldDefinition {
  createdAt: string;
  updatedAt: string;
}

function serialize(row: CustomFieldRow): CustomFieldRowOut {
  return {
    id: row.id,
    entity: row.entity as CustomFieldEntity,
    key: row.key,
    label: row.label,
    type: row.type as CustomFieldType,
    options: row.options,
    helpText: row.helpText,
    required: row.required,
    showInList: row.showInList,
    position: row.position,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Definitions ─────────────────────────────────────────────────────────────

export interface ListCustomFieldsFilter {
  entity?: CustomFieldEntity;
  /** Inactive fields are hidden by default — they exist so their values survive,
   *  not so they clutter every form. */
  includeInactive?: boolean;
}

export async function listCustomFields(
  ctx: ServiceContext,
  filter: ListCustomFieldsFilter = {}
): Promise<CustomFieldRowOut[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryCustomField.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(filter.entity ? { entity: filter.entity } : {}),
        ...(filter.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ entity: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(serialize);
  });
}

export async function createCustomField(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CustomFieldRowOut> {
  const input = CreateCustomFieldInput.parse(rawInput);
  const key = input.key ?? normalizeFieldKey(input.label);
  if (key === '') {
    throw new InventoryValidationError('Give the field a name with some letters in it', [
      { field: 'label', message: 'cannot be reduced to a key' },
    ]);
  }
  if ((input.type === 'select' || input.type === 'multi_select') && input.options.length === 0) {
    throw new InventoryValidationError('A list field needs at least one choice', [
      { field: 'options', message: 'empty' },
    ]);
  }

  return withTenant(ctx, async (tx) => {
    const clash = await tx.inventoryCustomField.findFirst({
      where: { tenantId: ctx.tenantId, entity: input.entity, key },
      select: { id: true, label: true, isActive: true },
    });
    if (clash) {
      throw new InventoryValidationError(
        clash.isActive
          ? `There is already a field called ${clash.label} here`
          : `A removed field called ${clash.label} still uses that name — turn it back on instead`,
        [{ field: 'key', message: `duplicate ${key}` }]
      );
    }

    const row = await tx.inventoryCustomField.create({
      data: {
        tenantId: ctx.tenantId,
        entity: input.entity,
        key,
        label: input.label,
        type: input.type,
        options: input.type === 'select' || input.type === 'multi_select' ? input.options : [],
        helpText: input.helpText,
        required: input.required,
        showInList: input.showInList,
        position: input.position,
        createdBy: ctx.userId ?? null,
      },
    });

    await audit(tx, ctx, row.id, 'created', {
      entity: input.entity,
      key,
      label: input.label,
      type: input.type,
    });
    return serialize(row);
  });
}

export async function updateCustomField(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CustomFieldRowOut> {
  const input = UpdateCustomFieldInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryCustomField.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('InventoryCustomField', id);

    const isList = existing.type === 'select' || existing.type === 'multi_select';
    if (input.options !== undefined) {
      if (!isList) {
        throw new InventoryValidationError('Only a list field has choices', [
          { field: 'options', message: `type ${existing.type}` },
        ]);
      }
      if (input.options.length === 0) {
        throw new InventoryValidationError('A list field needs at least one choice', [
          { field: 'options', message: 'empty' },
        ]);
      }
    }

    const row = await tx.inventoryCustomField.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.helpText !== undefined ? { helpText: input.helpText } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.showInList !== undefined ? { showInList: input.showInList } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await audit(tx, ctx, id, 'updated', { ...input });
    return serialize(row);
  });
}

/**
 * Remove a field.
 *
 * Deactivates rather than deletes. The values stay on the records, and turning
 * the field back on brings them all back — which matters because the thing being
 * removed is often a column somebody spent a morning filling in, and a settings
 * screen that can destroy a morning's work gets avoided rather than used.
 */
export async function deleteCustomField(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryCustomField.findFirst({
      where: { id },
      select: { id: true, key: true, entity: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventoryCustomField', id);
    await tx.inventoryCustomField.update({ where: { id }, data: { isActive: false } });
    await audit(tx, ctx, id, 'removed', { entity: existing.entity, key: existing.key });
  });
}

// ─── Values ──────────────────────────────────────────────────────────────────

/** Definitions for one entity, inside a transaction the caller already holds. */
export async function loadCustomFieldDefinitions(
  tx: TxClient,
  tenantId: string,
  entity: CustomFieldEntity
): Promise<CustomFieldDefinition[]> {
  const rows = await tx.inventoryCustomField.findMany({
    where: { tenantId, entity, isActive: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(serialize);
}

export interface ApplyCustomFieldsResult {
  values: Record<string, CustomFieldValue>;
  /** Fields whose keys the definitions know. Empty when nothing changed. */
  changed: string[];
}

/**
 * Validate and write a patch of custom-field values onto one record.
 *
 * A PATCH, not a replace: a request naming two fields leaves the other ten
 * alone. Replacing would mean every caller — the grid editing one cell, the
 * importer setting one column — has to send the whole blob back, and the first
 * one that forgets silently empties a tenant's data.
 *
 * Throws on a bad value rather than dropping it. A number field handed "n/a"
 * that quietly stays empty is the same class of failure as a report showing zero
 * for something nobody measured.
 */
export async function applyCustomFields(
  tx: TxClient,
  ctx: ServiceContext,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string },
  incoming: Record<string, unknown>
): Promise<ApplyCustomFieldsResult> {
  const definitions = await loadCustomFieldDefinitions(tx, ctx.tenantId, entity);
  if (definitions.length === 0) {
    // Nothing is defined, so nothing can be written. Silently ignoring the
    // payload is right here: an importer carrying `cf_*` columns for a tenant
    // who has removed those fields should still import the stock.
    return { values: {}, changed: [] };
  }

  const existing = await readValues(tx, entity, where, definitions);
  const { values, errors } = validateCustomFieldValues(definitions, incoming, existing);
  if (errors.length > 0) {
    throw new InventoryValidationError(
      errors[0]!.message,
      errors.map((error) => ({ field: error.key, message: error.message }))
    );
  }

  const changed = Object.keys(incoming).filter((key) =>
    definitions.some((definition) => definition.key === key)
  );
  if (changed.length === 0) return { values, changed: [] };

  await writeValues(tx, entity, where, values);
  return { values, changed };
}

async function readValues(
  tx: TxClient,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string },
  definitions: readonly CustomFieldDefinition[]
): Promise<Record<string, CustomFieldValue>> {
  const stored = await selectStored(tx, entity, where);
  if (stored === null) {
    throw new InventoryNotFoundError(VALUE_TABLES[entity].label, JSON.stringify(where));
  }
  return readCustomFields(definitions, stored);
}

async function selectStored(
  tx: TxClient,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string }
): Promise<unknown> {
  switch (entity) {
    case 'variant': {
      const row = await tx.productVariant.findFirst({
        where: { id: (where as { id: string }).id },
        select: { customFields: true },
      });
      return row?.customFields ?? null;
    }
    case 'supplier': {
      const row = await tx.supplier.findFirst({
        where: { id: (where as { id: string }).id },
        select: { customFields: true },
      });
      return row?.customFields ?? null;
    }
    case 'purchase_order': {
      const row = await tx.purchaseOrder.findFirst({
        where: { id: (where as { id: string }).id },
        select: { customFields: true },
      });
      return row?.customFields ?? null;
    }
    case 'level': {
      const key = where as { variantId: string; warehouseId: string };
      const row = await tx.inventoryLevel.findFirst({
        where: { variantId: key.variantId, warehouseId: key.warehouseId },
        select: { customFields: true },
      });
      return row?.customFields ?? null;
    }
    default:
      return null;
  }
}

async function writeValues(
  tx: TxClient,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string },
  values: Record<string, CustomFieldValue>
): Promise<void> {
  const data = { customFields: values as unknown as Prisma.InputJsonValue };
  switch (entity) {
    case 'variant':
      await tx.productVariant.update({ where: { id: (where as { id: string }).id }, data });
      return;
    case 'supplier':
      await tx.supplier.update({ where: { id: (where as { id: string }).id }, data });
      return;
    case 'purchase_order':
      await tx.purchaseOrder.update({ where: { id: (where as { id: string }).id }, data });
      return;
    case 'level': {
      const key = where as { variantId: string; warehouseId: string };
      await tx.inventoryLevel.update({
        where: {
          variantId_warehouseId: { variantId: key.variantId, warehouseId: key.warehouseId },
        },
        data,
      });
      return;
    }
    default:
      return;
  }
}

/** Read one record's values back, outside a transaction the caller holds. */
export async function getCustomFieldValues(
  ctx: ServiceContext,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string }
): Promise<{ definitions: CustomFieldDefinition[]; values: Record<string, CustomFieldValue> }> {
  return withTenant(ctx, async (tx) => {
    const definitions = await loadCustomFieldDefinitions(tx, ctx.tenantId, entity);
    if (definitions.length === 0) return { definitions, values: {} };
    return { definitions, values: await readValues(tx, entity, where, definitions) };
  });
}

/**
 * Set values from OUTSIDE a transaction — the API's own patch endpoint.
 *
 * A thin wrapper on purpose. Every path that writes a value ends at
 * `applyCustomFields`, which is the whole reason coercion cannot be skipped.
 */
export async function setCustomFieldValues(
  ctx: ServiceContext,
  entity: CustomFieldEntity,
  where: { id: string } | { variantId: string; warehouseId: string },
  incoming: Record<string, unknown>
): Promise<Record<string, CustomFieldValue>> {
  return withTenant(ctx, async (tx) => {
    const result = await applyCustomFields(tx, ctx, entity, where, incoming);
    if (result.changed.length > 0) {
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'inventory.custom_fields.set',
        entityType: entity,
        // `audit_logs.entity_id` is a UUID column, so a stock position is
        // recorded under its VARIANT with the location in the diff. A composite
        // "<variant>:<warehouse>" string is not a uuid and the insert fails —
        // which would take the whole write down with it.
        entityId: 'id' in where ? where.id : where.variantId,
        diff: {
          after: {
            fields: result.changed,
            ...('variantId' in where ? { warehouseId: where.warehouseId } : {}),
          },
        },
      });
    }
    return result.values;
  });
}

export { CustomFieldEntity };
export type { CustomFieldDefinition, CustomFieldValue };

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  entityId: string,
  action: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.custom_field.${action}`,
    entityType: 'InventoryCustomField',
    entityId,
    diff: { after: diff },
  });
}
