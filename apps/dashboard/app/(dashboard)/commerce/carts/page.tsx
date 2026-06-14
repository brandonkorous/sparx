import { ShoppingCart } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { CartsList, type CartRow } from './_components/carts-list';

export const dynamic = 'force-dynamic';

const FILTER_OPTIONS = [
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'active', label: 'Active' },
  { value: 'recovered', label: 'Recovered' },
];

export default async function CartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filter = stringParam(params.filter);
  const viewParam = stringParam(params.view);
  const { skip, take } = parsePageParams(params);
  const showRecovered = filter === 'recovered';
  const showActive = filter === 'active';
  const filterParam = showRecovered ? 'recovered' : showActive ? 'active' : 'abandoned';

  const query = new URLSearchParams({
    filter: filterParam,
    take: String(take),
    skip: String(skip),
  });
  const [prefs, { data: carts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<CartRow[]>(`/v1/commerce/carts?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? carts.length;

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Carts"
          badge={<Badge color="module">{total} shown</Badge>}
          description="Read-only diagnostic view. Abandoned carts are flagged by the cart-abandonment worker after 2 hours of inactivity; recovered carts converted into orders. Click an ID to inspect the line items and pricing trace."
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'filter', label: 'Lifecycle', options: FILTER_OPTIONS }]}
          enableViewToggle
        />

        {carts.length === 0 ? (
          <Card>
            <CardHeader>
              <Stack gap={1}>
                <Heading level={3}>
                  {showRecovered ? 'Recovered' : showActive ? 'Active' : 'Abandoned'} carts
                </Heading>
                <CardDescription>
                  Storefront writes through cartService; this dashboard is read-only.
                </CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<ShoppingCart className="h-5 w-5" />}
                title="No carts"
                description="Carts surface here when the storefront / B2B portal starts writing."
              />
            </CardContent>
          </Card>
        ) : (
          <Stack gap={1}>
            <Heading level={3}>
              {showRecovered ? 'Recovered' : showActive ? 'Active' : 'Abandoned'} carts
            </Heading>
            <CardDescription>
              Storefront writes through cartService; this dashboard is read-only.
            </CardDescription>
            <CartsList rows={carts} view={view} />
          </Stack>
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
