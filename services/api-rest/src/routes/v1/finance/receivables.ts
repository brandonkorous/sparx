// Finance — receivables (what is owed to you, and how late).
//
//   GET /v1/finance/receivables[?property=]  → open billing documents, each with
//                                              how far past due it is, plus the
//                                              aging-bucket rollup.
//
// The canonical open-AR view returns bucket TOTALS (GET /v1/invoicing/aging); the
// receivables surface needs the DOCUMENTS themselves, grouped by how late — so
// this reads the open billing documents directly (72-invoicing) and buckets them
// on the stored `overdueDays`, the same figure the aging report and the invoice
// list already agree on. Gated on the invoicing module (which Commerce/B2B
// tenants get free via BUNDLED_FREE), site-scoped like every list.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { type Prisma } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { requireInvoicingModule } from '../../../lib/invoicing-context.js';
import { resolveListScope } from '../../../lib/property.js';

const BUCKET_KEYS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;

const Query = z.object({
  property: z.string().min(1).max(63).optional(),
  // Free text over the resolved customer name AND the invoice number.
  q: z.string().max(255).optional(),
  // Restrict the LIST to one aging bucket. The summary always spans everything.
  bucket: z.enum(['all', ...BUCKET_KEYS]).optional(),
  sort_by: z.enum(['overdueDays', 'balance']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

// The five aging buckets, keyed on days past due. Matches billing-ar.bucketAging
// so the finance receivables view and the AR aging report never disagree.
const BUCKETS = [
  { key: 'current', label: 'Not yet due', min: -Infinity, max: 0 },
  { key: 'd1_30', label: '1–30 days late', min: 1, max: 30 },
  { key: 'd31_60', label: '31–60 days late', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 days late', min: 61, max: 90 },
  { key: 'd90_plus', label: '90+ days late', min: 91, max: Infinity },
] as const;

type BucketKey = (typeof BUCKETS)[number]['key'];

function bucketFor(days: number): BucketKey {
  for (const b of BUCKETS) if (days >= b.min && days <= b.max) return b.key;
  return 'current';
}

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function partyName(billTo: unknown): string | null {
  if (billTo && typeof billTo === 'object' && 'name' in billTo) {
    const name = (billTo as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

/** The first non-empty candidate string, else null. */
function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

const financeReceivablesRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/finance/receivables', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireInvoicingModule(request);
    const q = Query.parse(request.query);
    const scope = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const docs = await withRequestTenant(request, (tx) =>
      tx.billingDocument.findMany({
        where: {
          deletedAt: null,
          status: { in: ['unpaid', 'partial', 'overdue'] },
          balance: { gt: 0 },
          ...(scope ? { propertyId: scope } : {}),
        },
        // Oldest due date first; the final "most overdue first" ordering is
        // applied in JS off the query-time days-past-due below.
        orderBy: [{ dueAt: 'asc' }],
        select: {
          id: true,
          number: true,
          status: true,
          balance: true,
          total: true,
          currency: true,
          dueAt: true,
          billTo: true,
          customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
          company: { select: { companyName: true } },
        },
      })
    );

    // Compute days-past-due from `dueAt` at query time, exactly as the canonical
    // AR aging report (billing-ar.bucketAging) does — NOT from the stored
    // `overdueDays` column, which is only as fresh as the last overdue-recompute
    // job and would put a three-weeks-late invoice in "Not yet due" until that job
    // ran. A doc with no due date (pay-now, no terms) counts as current.
    const now = Date.now();
    const DAY = 86_400_000;

    const items = docs.map((d) => {
      const c = d.customer;
      const name =
        firstNonEmpty(
          partyName(d.billTo),
          d.company?.companyName,
          [c?.firstName, c?.lastName].filter(Boolean).join(' '),
          c?.companyName,
          c?.email
        ) ?? 'Customer';
      const daysPast = d.dueAt ? Math.floor((now - d.dueAt.getTime()) / DAY) : 0;
      return {
        id: d.id,
        number: d.number,
        customerName: name,
        status: d.status,
        balance: num(d.balance),
        total: num(d.total),
        currency: d.currency,
        dueAt: d.dueAt?.toISOString() ?? null,
        overdueDays: Math.max(0, daysPast),
        bucket: bucketFor(daysPast),
      };
    });

    // The summary (aging buckets + headline total) spans the WHOLE outstanding
    // set — it is the headline for everything owed, so it is computed BEFORE any
    // search or bucket filter narrows the list below it.
    const buckets = BUCKETS.map((b) => {
      const inBucket = items.filter((i) => i.bucket === b.key);
      return {
        key: b.key,
        label: b.label,
        count: inBucket.length,
        balance: Math.round(inBucket.reduce((s, i) => s + i.balance, 0) * 100) / 100,
      };
    });
    const totalOutstanding = Math.round(items.reduce((s, i) => s + i.balance, 0) * 100) / 100;
    const totalCount = items.length;

    // Now the LIST: filter, sort, page — server-side, so each reflects the whole
    // matching set rather than one loaded window.
    const needle = q.q?.trim().toLowerCase();
    const bucket = q.bucket ?? 'all';
    const filtered = items.filter(
      (i) =>
        (bucket === 'all' || i.bucket === bucket) &&
        (!needle ||
          i.customerName.toLowerCase().includes(needle) ||
          (i.number ?? '').toLowerCase().includes(needle))
    );

    const sortKey = q.sort_by ?? 'overdueDays';
    // Default: most overdue first (oldest debt leads the chase list). `balance`
    // defaults to largest-first.
    const dir = q.order ?? 'desc';
    const factor = dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) =>
      sortKey === 'balance'
        ? (a.balance - b.balance) * factor
        : (a.overdueDays - b.overdueDays) * factor
    );

    const take = q.take ?? 50;
    const skip = q.skip ?? 0;

    return ok({
      currency: items[0]?.currency ?? 'USD',
      totalOutstanding,
      totalCount,
      buckets,
      items: filtered.slice(skip, skip + take),
      // The count of rows MATCHING the current filter/search — drives paging.
      total: filtered.length,
    });
  });

  return Promise.resolve();
};

export default financeReceivablesRoutes;
