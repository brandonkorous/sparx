// Record-types slice (docs/144 §3) — applied only when the `crm` module is on.
//
// Two jobs, in this order:
//
//   1. Make sure the four built-in record definitions EXIST. Sample data can be
//      loaded into a tenant that enabled CRM before the registry shipped and so
//      never got the activation event that seeds them; without this the property
//      panel has no schema to render and the pack's authored values would be
//      written into a bag nothing knows how to show.
//   2. ADD the pack's declared properties to those definitions.
//
// "Add" is exact and load-bearing. A pack MERGES its properties into whatever
// the tenant already has, matching on field key, and never removes one. Loading
// sample data into a tenant who has spent a month declaring their own fields
// must not take any of them away — the same rule module activation follows, for
// the same reason.
//
// A pack only ever extends the BUILT-INS. Inventing a record type is a decision
// about how a business works, and that belongs to the business.
//
// CLEAR DELIBERATELY DOES NOT REMOVE THESE. Every other slice writes ROWS, and a
// sample row is safe to delete. A declared property is part of the tenant's
// SCHEMA: by the time someone clears sample data they may have filled it in on
// two hundred real customers, and taking the field away would strand every one
// of those values. Leaving an unused field behind costs a person one click in
// the property editor; removing a used one costs them their data.

import type { SampleDataPack, SampleRecordProperty, SampleRecordType } from '../types';
import type { ApplyCtx } from './context';

/** The four sparx ships, worded the way a business owner would. Kept in step
 *  with BUILTIN_OBJECT_SEEDS in @wizeworks/crm — duplicated rather than imported
 *  because @wizeworks/db sits BELOW @wizeworks/crm and must not depend upwards. */
const BUILTIN_SEEDS: {
  key: string;
  label: string;
  labelPlural: string;
  iconKey: string;
  description: string;
}[] = [
  {
    key: 'contact',
    label: 'Customer',
    labelPlural: 'Customers',
    iconKey: 'users',
    description: 'The people you do business with.',
  },
  {
    key: 'company',
    label: 'Company',
    labelPlural: 'Companies',
    iconKey: 'building-2',
    description: 'The businesses your customers work for or buy through.',
  },
  {
    key: 'deal',
    label: 'Deal',
    labelPlural: 'Deals',
    iconKey: 'target',
    description: 'The sales you are working on.',
  },
  {
    key: 'ticket',
    label: 'Request',
    labelPlural: 'Requests',
    iconKey: 'life-buoy',
    description: 'Questions and problems your customers need help with.',
  },
];

interface StoredSchema {
  fields: SampleRecordProperty[];
}

function readFields(raw: unknown): SampleRecordProperty[] {
  if (raw && typeof raw === 'object' && 'fields' in raw && Array.isArray(raw.fields)) {
    return (raw as StoredSchema).fields;
  }
  return [];
}

/**
 * The tenant's fields with the pack's merged in — theirs first, in their order.
 *
 * A key that already exists is LEFT ALONE rather than overwritten: if someone
 * has renamed the pack's "Membership tier" to "Plan" and added three options,
 * re-loading sample data must not undo that.
 */
function mergeFields(
  existing: SampleRecordProperty[],
  incoming: SampleRecordProperty[]
): { fields: SampleRecordProperty[]; added: number } {
  const have = new Set(existing.map((field) => field.key));
  const added = incoming.filter((field) => !have.has(field.key));
  return { fields: [...existing, ...added], added: added.length };
}

export async function applyRecordTypes(ctx: ApplyCtx, pack: SampleDataPack): Promise<void> {
  if (!ctx.isOn('crm')) return;
  const { tx, tenantId } = ctx;

  // 1 — the built-ins exist. `create`-only: a tenant who renamed "Customers" to
  // "Patients" keeps it.
  for (const seed of BUILTIN_SEEDS) {
    await tx.crmObjectDef.upsert({
      where: { tenantId_key: { tenantId, key: seed.key } },
      update: {},
      create: {
        tenantId,
        key: seed.key,
        kind: 'builtin',
        label: seed.label,
        labelPlural: seed.labelPlural,
        iconKey: seed.iconKey,
        description: seed.description,
        propertySchema: { fields: [] },
      },
    });
  }

  // 2 — the pack's declared properties.
  for (const declared of pack.recordTypes ?? []) {
    await applyOne(ctx, declared);
  }
}

async function applyOne(ctx: ApplyCtx, declared: SampleRecordType): Promise<void> {
  const { tx, tenantId } = ctx;
  const row = await tx.crmObjectDef.findUnique({
    where: { tenantId_key: { tenantId, key: declared.objectKey } },
    select: { id: true, propertySchema: true },
  });
  // A pack naming a record type that does not exist is an authoring mistake, not
  // a reason to fail a load — the other slices still have a tenant to populate.
  if (!row) return;

  const { fields, added } = mergeFields(readFields(row.propertySchema), declared.properties);
  if (added === 0) return;

  await tx.crmObjectDef.update({
    where: { id: row.id },
    data: { propertySchema: { fields } as never },
  });
}
