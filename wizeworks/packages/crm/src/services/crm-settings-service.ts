// crmSettingsService — the CRM preferences that are decisions, not data
// (docs/144 §11 + §12).
//
// Three settings live here and they have one thing in common: each is a choice
// about how the CRM should BEHAVE, and getting it wrong quietly damages data
// rather than throwing an error. Offering a company by email domain, deciding
// what counts as the same person, and deciding whether a machine may merge two
// records without asking are all in that category, which is why they are settings
// at all rather than constants.
//
// SITE-SCOPED (docs/131). Two unrelated businesses under one owner do not agree
// on what a duplicate is — a parts wholesaler dedupes on the account email, a
// donut shop on the phone number, and applying either to the other produces
// merges nobody asked for.
//
// READS NEVER WRITE. `crmSettings()` returns defaults for a tenant with no row
// rather than creating one, so a first page load is not a write and a read-only
// role is not a permission error. The row appears the first time somebody
// actually changes something.

import { UpdateCrmSettingsInput, type DuplicateMatchRule } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CrmSettings, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';

/** The behaviour of a tenant that has never opened the settings surface. */
export interface ResolvedCrmSettings {
  domainAssociation: boolean;
  duplicateMatchRules: DuplicateMatchRule[];
  autoMergeThreshold: number | null;
}

export const CRM_SETTINGS_DEFAULTS: ResolvedCrmSettings = {
  // Off. Even OFFERING a company on a domain match is a choice a business should
  // meet rather than find already made for them (docs/144 §11).
  domainAssociation: false,
  // What the duplicate scanner did before it was configurable, so turning the
  // surface on changes nothing by itself.
  duplicateMatchRules: ['email', 'name_company'],
  // Never merge without a person. A merge cannot be undone.
  autoMergeThreshold: null,
};

/**
 * The settings in force for this context's site.
 *
 * Falls back site → tenant-wide → defaults. A tenant-wide row is a real and
 * useful state (one owner, one way of working), and the site row overrides it
 * WHOLE rather than field-by-field: a half-inherited settings object is one
 * nobody can predict from either screen.
 */
export async function crmSettings(
  ctx: ServiceContext,
  propertyId: string | null = null
): Promise<ResolvedCrmSettings> {
  const row = await withTenant(ctx, async (tx) => {
    if (propertyId) {
      const site = await tx.crmSettings.findFirst({ where: { propertyId } });
      if (site) return site;
    }
    return tx.crmSettings.findFirst({ where: { propertyId: null } });
  });

  if (!row) return { ...CRM_SETTINGS_DEFAULTS };
  return {
    domainAssociation: row.domainAssociation,
    duplicateMatchRules: row.duplicateMatchRules as DuplicateMatchRule[],
    autoMergeThreshold: row.autoMergeThreshold,
  };
}

/** The stored row for the settings surface — null when nothing has been saved. */
export async function get(
  ctx: ServiceContext,
  propertyId: string | null = null
): Promise<CrmSettings | null> {
  return withTenant(ctx, (tx) => tx.crmSettings.findFirst({ where: { propertyId } }));
}

/**
 * Save. Creates the row on first write.
 *
 * `upsert` is not usable here: the unique index is `(tenant_id, property_id)`
 * with NULLS NOT DISTINCT, which Prisma cannot address as a compound `where`
 * when one half is null. Find-then-write inside the transaction is exact, and
 * the index still refuses a second row if two requests race.
 */
export async function update(
  ctx: ServiceContext,
  rawInput: unknown,
  propertyId: string | null = null
): Promise<CrmSettings> {
  const input = UpdateCrmSettingsInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.crmSettings.findFirst({ where: { propertyId } });

    const data: Prisma.CrmSettingsUncheckedUpdateInput = {
      ...(input.domainAssociation !== undefined
        ? { domainAssociation: input.domainAssociation }
        : {}),
      ...(input.duplicateMatchRules !== undefined
        ? { duplicateMatchRules: input.duplicateMatchRules }
        : {}),
      ...(input.autoMergeThreshold !== undefined
        ? { autoMergeThreshold: input.autoMergeThreshold }
        : {}),
    };

    const saved = existing
      ? await tx.crmSettings.update({ where: { id: existing.id }, data })
      : await tx.crmSettings.create({
          data: {
            tenantId: ctx.tenantId,
            propertyId,
            domainAssociation: input.domainAssociation ?? CRM_SETTINGS_DEFAULTS.domainAssociation,
            duplicateMatchRules:
              input.duplicateMatchRules ?? CRM_SETTINGS_DEFAULTS.duplicateMatchRules,
            autoMergeThreshold:
              input.autoMergeThreshold ?? CRM_SETTINGS_DEFAULTS.autoMergeThreshold,
          },
        });

    // Audited rather than merely saved: an auto-merge threshold is the one
    // setting on this screen that lets the platform destroy a record without
    // anybody watching, so "who turned that on" has to be answerable.
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.settings.updated',
      entityType: 'CrmSettings',
      entityId: saved.id,
      diff: {
        before: existing
          ? {
              domainAssociation: existing.domainAssociation,
              duplicateMatchRules: existing.duplicateMatchRules,
              autoMergeThreshold: existing.autoMergeThreshold,
            }
          : null,
        after: {
          domainAssociation: saved.domainAssociation,
          duplicateMatchRules: saved.duplicateMatchRules,
          autoMergeThreshold: saved.autoMergeThreshold,
        },
      },
    });

    return saved;
  });
}
