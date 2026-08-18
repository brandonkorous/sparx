#!/usr/bin/env tsx
// Seed the finance expense categories for tenants that predate the consumer.
//
//   pnpm --filter @wizeworks/api-rest ops:backfill-finance-categories            # dry run
//   pnpm --filter @wizeworks/api-rest ops:backfill-finance-categories -- --apply
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────
// `provisionFinance` seeds the category set a tenant needs before it can file a
// cost, and its own doc comment says it is "called by the module-activation
// path". Nothing outside its tests ever called it. So the seed shipped, the
// migration shipped, and NO TENANT ANYWHERE had a single category row:
//
//   • Spending had nothing to file a cost against.
//   • The staff labour deriver looks up the `wages` bucket BY SLUG and correctly
//     refuses to invent one, so every run failed `STAFF_WAGES_CATEGORY_MISSING`
//     and approved hours never became a wage cost. The whole staff → finance
//     chain was inert in production.
//
// `wizeworks/packages/finance-worker` now consumes `module.activated` and provisions on
// it, which fixes every tenant from here on — including the BUNDLED case, since
// turning on Commerce or B2B announces `finance` with no finance flag of its
// own. But an activation event only fires once, and every existing tenant fired
// theirs before the consumer existed. That is what this closes.
//
// Safe to re-run: `seedCategories` upserts on `(tenant, slug)` and only ever
// writes machine-owned fields, so a tenant who already has the set, or who
// renamed "Wages" to "Payroll", keeps exactly what they have.
//
// ── WHY THE COUNT IS WRAPPED IN `withTenant` ─────────────────────────────────
// `finance_expense_categories` is FORCE ROW LEVEL SECURITY. A bare
// `prisma.financeExpenseCategory.count()` has no `app.tenant_id` on the
// connection, so RLS filters every row out and the query returns 0 — it does not
// error. The first version of this script counted that way, which made the
// "already seeded" branch permanently dead and printed `0 already seeded, 49 to
// seed` on a run immediately after a successful apply. Reading a tenant-scoped
// table outside a tenant context does not report emptiness, it reports nothing,
// and the two are not the same number.

import { prisma, withTenant } from '@wizeworks/db';
import { provisionFinance } from '@wizeworks/finance';

import { listTenantsWithModule } from '../lib/module-tenants.js';

const apply = process.argv.includes('--apply');
const only = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);

async function main(): Promise<void> {
  // Availability is DERIVED, never read off `settings.modules.finance.enabled`
  // — finance is BUNDLED_FREE, so that flag is unwritten for almost everyone who
  // has it. Shared with the finance cron, which needs the same set for the same
  // reason (`lib/module-tenants.ts`).
  const all = await listTenantsWithModule('finance');
  const tenants = only ? all.filter((t) => t.id === only) : all;

  const eligible = tenants.length;
  let seeded = 0;
  let alreadyDone = 0;

  for (const tenant of tenants) {
    // Count first, so a dry run reports the truth and an applied run can tell
    // "seeded 12" apart from "already had them". Inside the tenant context, or
    // RLS answers 0 for everyone (see the header).
    const existing = await withTenant({ tenantId: tenant.id }, (tx) =>
      tx.financeExpenseCategory.count()
    );
    if (existing > 0) {
      alreadyDone += 1;
      continue;
    }

    const how = tenant.source === 'bundled' ? `bundled via ${tenant.includedBy.join('/')}` : 'on';
    if (!apply) {
      console.log(`WOULD SEED  ${tenant.slug} — finance ${how}, 0 categories`);
      seeded += 1;
      continue;
    }

    // `categoriesSeeded` is rows CREATED, so this prints 0 if something seeded
    // the tenant between the count above and here. That is the honest report.
    const { categoriesSeeded, categoriesTotal } = await provisionFinance(tenant.id);
    console.log(
      `seeded ${String(categoriesSeeded)} of ${String(categoriesTotal)}  ` +
        `${tenant.slug} — ${how}`
    );
    seeded += 1;
  }

  console.log(
    `\n${apply ? 'Applied' : 'Dry run'}: ${String(eligible)} tenants with finance available, ` +
      `${String(alreadyDone)} already seeded, ${String(seeded)} ${apply ? 'seeded' : 'to seed'}.`
  );
  if (!apply && seeded > 0) console.log('Re-run with --apply to write.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    void prisma.$disconnect();
    process.exit(1);
  });
