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

import { withTenant, type TenantContext } from '@wizeworks/db';

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
    // NOTHING FOR THE CRM LISTS, on purpose, and this is the second system —
    // not an oversight.
    //
    // Customers, orders, deals and accounts do not read `saved_views` at all.
    // They mount `<SavedViewsMenu objectKey="contact" …>`, which is the CRM's
    // own feature over `crm_saved_views`, keyed by object rather than by
    // pathname. Six presets used to be seeded here for `/crm/orders`,
    // `/crm/customers`, `/crm/deals` and `/crm/b2b`: every one was written to
    // every tenant, and no screen has ever been able to ask for them.
    //
    // Seeding starter views for the CRM means seeding them THERE, through
    // `crm/saved-view-service`, and it is a different piece of work from this
    // file. `check:saved-view-targets` keeps the mistake from coming back.
  ],
  b2b: [
    { target: '/b2b/accounts', name: 'Credit hold', params: { status: 'credit_hold' } },
    // No quotes view. "Awaiting review" filtered `stage: 'Under Review'`, and
    // the stage filter does not exist anywhere in the chain: the quotes pane has
    // no filters at all (only paging), `useQuotes` sends `account_id`, `take`
    // and `skip`, and `GET /v1/b2b/quotes` takes no stage. So the preset named a
    // filter three layers could not apply, on a target no pane registers.
    // Filtering quotes by stage is a real capability and belongs in its own
    // change, front to back; a seeded row cannot stand in for it.
    { target: '/b2b/invoices', name: 'Overdue', params: { status: 'overdue' } },
    { target: '/b2b/invoices', name: 'Unpaid', params: { status: 'unpaid' } },
  ],
  invoicing: [
    // `pastDue`, not `status: 'overdue'`. The status column is written when
    // something is DONE to a document; a due date passing is not something being
    // done, so nothing writes it and this view found only the late invoices that
    // happened to be touched afterwards. Measured before the change: 54
    // documents / $51,456.69 genuinely past due, 30 / $26,983.76 returned, and
    // one shop owed $986.50 across eight late invoices whose Overdue list was
    // empty. `pastDue` asks the due date instead, the way the aging report
    // always has.
    //
    // The STRING 'true', not a boolean, and not a style choice: a saved view is
    // a snapshot of a list's URL query params, and a query param is text. The
    // console's whole pipeline says so in its types (`Record<string, string>`)
    // and `normalise()` compares values with `!== ''`. The route's `queryBool`
    // reads it back into a real boolean at the edge, which is where that
    // conversion belongs.
    // '/invoicing/invoices', which is the path the LIST registers. It used to
    // read '/invoicing/documents' — the API route, not the screen — so both of
    // these sat in the database on a target no pane ever asks for, and the
    // Views menu on the invoices list said 'No saved views yet' over two rows
    // that existed. A preset's target is a pathname, never an endpoint.
    { target: '/invoicing/invoices', name: 'Overdue', params: { pastDue: 'true' } },
    { target: '/invoicing/invoices', name: 'Unpaid', params: { status: 'unpaid' } },
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
