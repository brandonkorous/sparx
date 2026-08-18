'use client';

// ══════════════════════════════════════════════════════════════════════════
// WHOLESALE ORDERS — a B2B lens over the shared order spine.
//
// A wholesale order is an ordinary order whose buyer belongs to a trade account.
// There is no separate "B2B order" table: the platform identifies one by the
// customer's `companyId`, so this reads the same `/v1/orders` root every order
// list does, with `b2b_only=true` (and optionally one account) applied.
//
// The row shape, the decimal coercion, and the paid/sent state language all live
// in the commerce order data layer already — re-deriving them here would be two
// definitions of one row, which is how a list ends up reading a field the other
// never fetched. So this file adds ONLY the B2B-scoped query; everything else is
// re-exported from there.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import {
  normalizeOrder,
  type Order,
  type OrderSortKey,
  type SortDirection,
} from '../commerce/data';

export {
  customerName,
  formatDate,
  formatMoney,
  paymentState,
  shippingState,
  type Order,
  type OrderSortKey,
  type SortDirection,
} from '../commerce/data';

export interface WholesaleOrderQuery {
  q?: string;
  status?: string;
  paymentStatus?: string;
  accountId?: string;
  sortBy: OrderSortKey;
  order: SortDirection;
  take: number;
  skip: number;
}

export function useWholesaleOrders(query: WholesaleOrderQuery) {
  return useQuery({
    queryKey: ['b2b', 'orders', query],
    queryFn: () =>
      api
        .list<Order>('/v1/orders', {
          b2b_only: 'true',
          ...(query.accountId ? { b2b_account_id: query.accountId } : {}),
          ...(query.q ? { q: query.q } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.paymentStatus ? { payment_status: query.paymentStatus } : {}),
          sort_by: query.sortBy,
          order: query.order,
          take: query.take,
          skip: query.skip,
        })
        .then((result) => ({
          items: result.items.map(normalizeOrder),
          total: result.total,
        })),
    placeholderData: (previous) => previous,
  });
}
