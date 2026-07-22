// Finance — payouts (the money actually landing in the bank).
//
//   GET /v1/finance/payouts      → each bank deposit, newest arrival first
//   GET /v1/finance/payouts/:id  → one deposit + the individual sales it settles
//
// A payout is DERIVED, not stored: sparx does not yet persist a settlement
// ledger, so this groups CAPTURED gateway payments (26-crm-order-payments) into
// the batch that lands together — one deposit per (settlement day, processor).
// Manual tenders (cash, check, wire, net terms) are excluded: they are money
// received, but not a gateway deposit sparx can see arriving. Settlement is
// modelled as capture + 2 calendar days, the ordinary card-processor delay.
//
// The synthetic id is `<processor>~<YYYY-MM-DD>` so a deposit is addressable
// (openable in its own pane) without a table to hold it. Gated on order access
// and site-scoped exactly like the payments feed.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { type Prisma } from '@sparx/db';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { withRequestTenant } from '@sparx/api-core/db';
import { notFound } from '@sparx/api-core/errors';
import { requireOrderAccess } from '../../../lib/order-context.js';
import { resolveListScope } from '../../../lib/property.js';

// Processors whose captures settle to a bank on a schedule. A manual/check/wire
// payment is money in hand, not a deposit that "arrives".
const GATEWAY_PROCESSORS = ['stripe', 'paypal', 'square', 'sparx_pay'] as const;
const SETTLEMENT_DAYS = 2;
const DAY_MS = 86_400_000;

const ListQuery = z.object({
  property: z.string().min(1).max(63).optional(),
  status: z.enum(['all', 'in_transit', 'paid']).optional(),
  // Restrict to one funding source — the processors that settle to a bank.
  processor: z.enum(['all', ...GATEWAY_PROCESSORS]).optional(),
  sort_by: z.enum(['arrivalDate', 'amount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  take: z.coerce.number().int().min(1).max(120).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const PayoutId = z.object({ id: z.string().min(3).max(80) });

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** UTC date (YYYY-MM-DD) the capture settles on. */
function settlementDay(captured: Date): string {
  const d = new Date(captured.getTime() + SETTLEMENT_DAYS * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** The first non-empty candidate string, else null. */
function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

interface CapturedRow {
  id: string;
  processor: string;
  amount: number;
  currency: string;
  settledOn: string;
  order: {
    id: string;
    orderNumber: string;
    name: string | null;
    channel: string | null;
    source: string | null;
  };
}

async function loadCaptured(
  request: FastifyRequest,
  scope: string | undefined
): Promise<CapturedRow[]> {
  const rows = await withRequestTenant(request, (tx) =>
    tx.orderPayment.findMany({
      where: {
        status: 'captured',
        processor: { in: [...GATEWAY_PROCESSORS] },
        order: scope ? { propertyId: scope } : {},
      },
      select: {
        id: true,
        processor: true,
        amount: true,
        currency: true,
        capturedAt: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            channel: true,
            source: true,
            customer: {
              select: { firstName: true, lastName: true, company: true, email: true },
            },
          },
        },
      },
    })
  );

  return rows.map((r) => {
    const c = r.order?.customer;
    const name = firstNonEmpty(
      [c?.firstName, c?.lastName].filter(Boolean).join(' '),
      c?.company,
      c?.email
    );
    return {
      id: r.id,
      processor: r.processor,
      amount: num(r.amount),
      currency: r.currency,
      settledOn: settlementDay(r.capturedAt ?? r.createdAt),
      order: {
        id: r.order?.id ?? '',
        orderNumber: r.order?.orderNumber ?? '—',
        name,
        channel: r.order?.channel ?? null,
        source: r.order?.source ?? null,
      },
    };
  });
}

function payoutKey(processor: string, day: string): string {
  return `${processor}~${day}`;
}

const financePayoutRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/finance/payouts', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const q = ListQuery.parse(request.query);
    const scope = await resolveListScope(auth, q.property, request.headers['x-sparx-property-id']);

    const captured = await loadCaptured(request, scope);
    const todayDay = new Date().toISOString().slice(0, 10);

    const groups = new Map<
      string,
      { processor: string; day: string; currency: string; gross: number; count: number }
    >();
    for (const row of captured) {
      const key = payoutKey(row.processor, row.settledOn);
      const g = groups.get(key) ?? {
        processor: row.processor,
        day: row.settledOn,
        currency: row.currency,
        gross: 0,
        count: 0,
      };
      g.gross = Math.round((g.gross + row.amount) * 100) / 100;
      g.count += 1;
      groups.set(key, g);
    }

    const built = [...groups.entries()].map(([id, g]) => ({
      id,
      processor: g.processor,
      arrivalDate: g.day,
      currency: g.currency,
      amount: g.gross,
      salesCount: g.count,
      // Arrived once the settlement day has passed; still moving otherwise.
      status: g.day <= todayDay ? 'paid' : 'in_transit',
    }));

    // Facets applied to the WHOLE derived set before paging, so a filter or a
    // sort reflects every deposit, not just the loaded window.
    const status = q.status ?? 'all';
    const processor = q.processor ?? 'all';
    const filtered = built.filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (processor === 'all' || p.processor === processor)
    );

    const sortKey = q.sort_by ?? 'arrivalDate';
    // Default: newest arrival first — the deposit an owner is looking for is the
    // most recent one. `amount` defaults to largest-first.
    const dir = q.order ?? 'desc';
    const factor = dir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * factor;
      return (a.arrivalDate < b.arrivalDate ? -1 : a.arrivalDate > b.arrivalDate ? 1 : 0) * factor;
    });

    const take = q.take ?? 50;
    const skip = q.skip ?? 0;
    return paged(filtered.slice(skip, skip + take), { total: filtered.length, per_page: take });
  });

  app.get('/v1/finance/payouts/:id', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireOrderAccess(request);
    const { id } = PayoutId.parse(request.params);
    const { property } = ListQuery.parse(request.query);
    const scope = await resolveListScope(auth, property, request.headers['x-sparx-property-id']);

    const sep = id.indexOf('~');
    const processor = sep >= 0 ? id.slice(0, sep) : '';
    const day = sep >= 0 ? id.slice(sep + 1) : '';
    if (!processor || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw notFound('Payout', id);

    const captured = await loadCaptured(request, scope);
    const sales = captured
      .filter((r) => r.processor === processor && r.settledOn === day)
      .map((r) => ({
        paymentId: r.id,
        orderId: r.order.id,
        orderNumber: r.order.orderNumber,
        customerName: r.order.name,
        channel: r.order.channel,
        source: r.order.source,
        amount: r.amount,
        currency: r.currency,
      }));

    if (sales.length === 0) throw notFound('Payout', id);

    const amount = Math.round(sales.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const todayDay = new Date().toISOString().slice(0, 10);
    return ok({
      id,
      processor,
      arrivalDate: day,
      currency: sales[0]!.currency,
      amount,
      salesCount: sales.length,
      status: day <= todayDay ? 'paid' : 'in_transit',
      sales,
    });
  });

  return Promise.resolve();
};

export default financePayoutRoutes;
