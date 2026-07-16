import Link from 'next/link';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Button, Card, cn, Input, PageHeader, Stack, Text } from '@sparx/ui';
import {
  OperatorApiError,
  type OperatorOrderSearchResult,
  type OperatorCustomerSearchResult,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { OrderResults } from './_components/order-results';
import { CustomerResults } from './_components/customer-results';

type Mode = 'orders' | 'customers';

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; q?: string }>;
}) {
  const operator = await requireCapability('support:read');
  const canAct = hasCapability(operator, 'support:act');
  const sp = await searchParams;
  const mode: Mode = sp.mode === 'customers' ? 'customers' : 'orders';
  const q = (sp.q ?? '').trim();

  if (q) {
    try {
      await logOperatorAction({
        operatorId: operator.id,
        operatorEmail: operator.email,
        capability: 'support:read',
        action: mode === 'orders' ? 'support.order.search' : 'support.customer.search',
        diff: { q },
      });
    } catch {
      // best-effort audit
    }
  }

  let orders: OperatorOrderSearchResult | null = null;
  let customers: OperatorCustomerSearchResult | null = null;
  let error: string | null = null;
  if (q) {
    try {
      if (mode === 'orders') {
        orders = await operatorApi().searchOrders({ q }, operator.id);
      } else {
        customers = await operatorApi().searchCustomers({ q }, operator.id);
      }
    } catch (err) {
      error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
    }
  }

  const found = mode === 'orders' ? orders?.found : customers?.found;

  return (
    <Stack gap={6}>
      <PageHeader
        title="Support"
        description="Look up any order or customer across every tenant. Orders are found by number, customer name, email, or SKU; customers by name, email, company, or phone."
      />

      <Stack direction="row" align="center" gap={4} className="flex-wrap">
        <ModeTab label="Orders" href="/sparx/support?mode=orders" active={mode === 'orders'} />
        <ModeTab
          label="Customers"
          href="/sparx/support?mode=customers"
          active={mode === 'customers'}
        />
      </Stack>

      <form method="get" className="flex gap-2">
        <input type="hidden" name="mode" value={mode} />
        <Input
          name="q"
          defaultValue={q}
          placeholder={
            mode === 'orders' ? 'Order number, customer, or SKU' : 'Email, name, company, or phone'
          }
          aria-label={`Search ${mode}`}
          className="max-w-md"
        />
        <Button type="submit" variant="soft">
          Search
        </Button>
      </form>

      {!q ? (
        <Card>
          <Text variant="muted">
            Enter a search above to look up {mode} across the whole platform.
          </Text>
        </Card>
      ) : error ? (
        <Card>
          <Text variant="muted">{error}</Text>
        </Card>
      ) : (
        <Stack gap={3}>
          <Text size="sm" variant="muted">
            {found === 0
              ? `No ${mode} match “${q}”.`
              : `${found} ${found === 1 ? 'match' : 'matches'} for “${q}”${
                  found &&
                  found > (mode === 'orders' ? orders!.orders.length : customers!.customers.length)
                    ? ` — showing the first ${mode === 'orders' ? orders!.orders.length : customers!.customers.length}`
                    : ''
                }.`}
          </Text>
          {mode === 'orders' && orders && orders.orders.length > 0 ? (
            <OrderResults orders={orders.orders} canAct={canAct} />
          ) : null}
          {mode === 'customers' && customers && customers.customers.length > 0 ? (
            <CustomerResults customers={customers.customers} />
          ) : null}
        </Stack>
      )}

      <Text size="xs" variant="muted">
        Cross-tenant search reads the platform search index. A tenant’s own index health and a
        rebuild live on that tenant’s{' '}
        <Link href="/sparx/tenants" className="text-module hover:underline">
          detail page
        </Link>
        .
      </Text>
    </Stack>
  );
}

/** Orders / Customers mode tab — active reads as an underline (never a filled pill). */
function ModeTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'border-b-2 pb-1 text-sm font-medium transition-colors',
        active
          ? 'border-module text-base-content'
          : 'text-base-content hover:text-base-content border-transparent'
      )}
    >
      {label}
    </Link>
  );
}
