#!/usr/bin/env tsx
// Rebuild the search index for every tenant, or one.
//
//   pnpm --filter @wizeworks/api-rest ops:reindex-search              # dry run
//   pnpm --filter @wizeworks/api-rest ops:reindex-search -- --apply
//   pnpm --filter @wizeworks/api-rest ops:reindex-search -- --apply --tenant=<id>
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
// A tenant's shop page reads the SEARCH INDEX, not the products table. So a
// product row and its search document disagreeing is not a reporting glitch —
// it is what a customer sees, and the console shows the row while the shop shows
// the document.
//
// Migration `20270401000000_uncounted_products_are_sellable` is exactly that
// case. It corrected `commerce_products.in_stock` for every product that had
// been marked Sold out purely for never having been counted (see
// inventory/src/services/availability.ts). It corrects ROWS. Nothing republishes
// them, because a SQL UPDATE raises no event — so without this the index keeps
// serving `in_stock: false` and every one of those products goes on telling
// visitors it is sold out, forever, until somebody happens to edit it.
//
// That is the general shape, and the reason this is a task rather than a
// one-off: any data migration touching a PROJECTED column needs the projection
// rebuilt behind it. CLAUDE.md keeps tasks out of the release pipeline
// deliberately, so it lives here in ops.yml, run once after that release.
//
// ── WHAT IT DOES, AND WHAT IT DOES NOT ──────────────────────────────────────
//
// Publishes one `search.reindex.requested` per tenant — the SAME event the
// console's own reindex button raises, so this adds no second code path to keep
// in step. The commerce-indexer worker does the actual rebuilding.
//
// It therefore reports what it ASKED FOR, never what landed. The work happens on
// a worker, asynchronously, after this process has exited; a script that printed
// "reindexed 49 tenants" would be claiming to have observed something it cannot
// see. Check `GET /v1/search/status` per tenant, or the worker's logs, for what
// actually happened.
//
// `drop_stale` is deliberately NOT set. It deletes documents the rebuild does
// not re-emit, which is right when recovering from corruption and wrong here:
// this is repairing a field on documents that are otherwise correct, and a
// dropped-then-re-added document is briefly missing from a live shop.

// MUST BE FIRST: `publish` resolves its transport from process.env when it is
// CALLED. Without this the script runs, reads the database perfectly (@wizeworks/db
// finds its own env), publishes to the `log` transport and prints a full list of
// tenants it has asked — having asked nobody. Seen on the first run of this file.
import 'dotenv/config';

import crypto from 'node:crypto';

import { prisma } from '@wizeworks/db';
import { closePublisher, publish } from '@wizeworks/api-core/pubsub';

const apply = process.argv.includes('--apply');
const only = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);

// `publish` takes a Fastify logger; there is no request here. Console is the
// right sink for an ops script — its output IS the run's record.
const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
} as unknown as Parameters<typeof publish>[0];

async function main(): Promise<void> {
  const all = await prisma.tenant.findMany({
    where: { status: 'active' },
    select: { id: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });
  const tenants = only ? all.filter((t) => t.id === only) : all;

  if (only && tenants.length === 0) {
    console.error(`No active tenant with id ${only}.`);
    process.exit(1);
  }

  let asked = 0;
  for (const tenant of tenants) {
    if (!apply) {
      console.log(`WOULD ASK  ${tenant.slug}`);
      asked += 1;
      continue;
    }
    const runId = `reindex_${crypto.randomUUID().replace(/-/g, '')}`;
    // actorId null: nobody asked for this, an operator did. The audit trail
    // should not attribute it to a person who was not involved.
    await publish(logger, 'search.reindex.requested', tenant.id, null, {
      runId,
      collections: undefined,
      dropStale: false,
    });
    console.log(`asked  ${tenant.slug}  ${runId}`);
    asked += 1;
  }

  console.log(
    `\n${apply ? 'Asked' : 'Dry run'}: ${String(asked)} of ${String(all.length)} active tenant(s).`
  );
  // Said plainly, because the number above is a count of REQUESTS and reads like
  // a count of results.
  if (apply) {
    console.log('The rebuilds run on the worker. This says what was asked, not what landed —');
    console.log('read GET /v1/search/status per tenant, or the worker logs, for that.');
  } else if (asked > 0) {
    console.log('Re-run with --apply to publish.');
  }
}

// The broker connection is closed as well as the database one. NATS holds an
// open socket, so a script that only disconnects Prisma publishes correctly,
// prints its summary, and then hangs forever — which in an ops workflow looks
// exactly like work still in progress.
async function shutdown(): Promise<void> {
  await Promise.allSettled([prisma.$disconnect(), closePublisher(logger)]);
}

main()
  .then(shutdown)
  .catch(async (error: unknown) => {
    console.error(error);
    await shutdown();
    process.exit(1);
  });
