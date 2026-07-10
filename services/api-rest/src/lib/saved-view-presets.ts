// Saved-view presets — the platform's seeded starter views for dashboard lists
// (docs/104 §5.A item 5). A saved view is a named snapshot of a list's URL query
// params (see ./saved-views.ts); these presets give every tenant a starter set of
// the operational queues people actually live in — unfulfilled orders, overdue
// invoices, abandoned carts, pending reviews, credit-hold accounts — so a freshly
// enabled module's lists open to more than a blank filter bar.
//
// Design rules:
//  - SHARED, tenant-wide (`ownerUserId` null) — visible to the whole team.
//  - NEVER `isDefault`. A default auto-applies on open (saved-views-menu.tsx),
//    silently hiding rows; a seeded preset must be an opt-in one-click, never a
//    surprise filter. The merchant promotes one to default if they want it.
//  - `target` is the list's route path — the exact `SavedView.target` the UI
//    snapshots (`target={pathname}`), so a preset lands on the right list with no
//    per-list wiring.
//  - `params` carry ONLY universal, tenant-agnostic filter values — the real
//    filter contract of each list (verified against the page's filter config).
//    Never a tenant-specific id (pipeline/workflow/warehouse), never the active-
//    site-follow `site` filter, never a catalog-browse facet.
//  - Seeded per OWNING module (the module that gates the route segment), so a
//    preset appears exactly when its surface does. Invoicing rides the bundle
//    graph — it seeds for any Commerce/B2B tenant too (see module-provisioning).
//
// find-or-create by (tenant, target, name) among shared views; idempotent, kept
// on deactivate, and back-filled by the 6h module-provisioning reconcile.

import { withTenant, type TenantContext } from '@sparx/db';

export interface SavedViewPreset {
  /** Route path identifying the list (matches `SavedView.target`). */
  target: string;
  /** Display name shown in the Views menu. */
  name: string;
  /** Query params the view applies — the list's real filter keys/values. */
  params: Record<string, string>;
}

/** Preset catalog, grouped by the module whose activation seeds it. Keys are
 *  `ModuleSlug`s; the seeder is bundle-aware so `invoicing` also seeds for
 *  Commerce/B2B tenants (where its flag is never explicitly written). */
export const SAVED_VIEW_PRESETS: Record<string, readonly SavedViewPreset[]> = {
  commerce: [
    { target: '/commerce/returns', name: 'Awaiting review', params: { status: 'requested' } },
    { target: '/commerce/reviews', name: 'Pending moderation', params: { status: 'pending' } },
    { target: '/commerce/reviews', name: 'Flagged', params: { status: 'flagged' } },
    { target: '/commerce/discounts', name: 'Active codes', params: { status: 'active' } },
    { target: '/commerce/subscriptions', name: 'Past due', params: { status: 'past_due' } },
    { target: '/commerce/carts', name: 'Abandoned carts', params: { filter: 'abandoned' } },
    { target: '/commerce/products', name: 'Drafts', params: { status: 'draft' } },
  ],
  crm: [
    { target: '/crm/orders', name: 'To fulfill', params: { status: 'placed' } },
    { target: '/crm/orders', name: 'Awaiting payment', params: { paymentStatus: 'pending' } },
    { target: '/crm/customers', name: 'Prospects', params: { type: 'prospect' } },
    { target: '/crm/customers', name: 'Top spenders', params: { sort: 'totalSpent' } },
    { target: '/crm/deals', name: 'Open deals', params: { state: 'open' } },
    { target: '/crm/b2b', name: 'Credit hold', params: { status: 'credit_hold' } },
  ],
  b2b: [
    { target: '/b2b/accounts', name: 'Credit hold', params: { status: 'credit_hold' } },
    { target: '/b2b/quotes', name: 'Awaiting review', params: { stage: 'Under Review' } },
    { target: '/b2b/invoices', name: 'Overdue', params: { status: 'overdue' } },
    { target: '/b2b/invoices', name: 'Unpaid', params: { status: 'unpaid' } },
    { target: '/b2b/appointments', name: 'Awaiting confirmation', params: { status: 'requested' } },
  ],
  invoicing: [
    { target: '/invoicing/documents', name: 'Overdue', params: { status: 'overdue' } },
    { target: '/invoicing/documents', name: 'Unpaid', params: { status: 'unpaid' } },
  ],
  cms: [
    { target: '/cms/content', name: 'Drafts', params: { status: 'draft' } },
    { target: '/cms/content', name: 'Scheduled', params: { status: 'scheduled' } },
  ],
};

/** The modules that carry a preset catalog — the bundle-aware seeder probes each
 *  against `isModuleEnabled` per tenant. */
export const SAVED_VIEW_PRESET_MODULES = Object.keys(SAVED_VIEW_PRESETS);

/** Seed one module's preset views for a tenant. find-or-create by
 *  (tenant, target, name) among SHARED views, so a merchant's own edits and any
 *  redelivered/repeated event are safe no-ops. Returns how many rows were created. */
export async function bootstrapSavedViewPresets(
  ctx: TenantContext,
  module: string
): Promise<{ created: number }> {
  const presets = SAVED_VIEW_PRESETS[module];
  if (!presets || presets.length === 0) return { created: 0 };
  return withTenant(ctx, async (tx) => {
    let created = 0;
    for (const preset of presets) {
      const existing = await tx.savedView.findFirst({
        where: {
          tenantId: ctx.tenantId,
          target: preset.target,
          name: preset.name,
          ownerUserId: null,
        },
        select: { id: true },
      });
      if (existing) continue;
      await tx.savedView.create({
        data: {
          tenantId: ctx.tenantId,
          ownerUserId: null,
          target: preset.target,
          name: preset.name,
          config: { params: preset.params },
          isDefault: false,
        },
      });
      created += 1;
    }
    return { created };
  });
}
