import { OrderListPage } from '../../_orders/order-list';
import { B2B_ORDER_LENS } from '../../_orders/lens';

// B2B's receivables desk, scoped to account orders — one of three lenses over the shared
// /v1/orders root. The view differs (scope, columns, filters); the components
// do not. See _orders/lens.ts for why three routes exist rather than one.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  return <OrderListPage lens={B2B_ORDER_LENS} searchParams={await searchParams} />;
}
