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

import { ListToolbar } from '../../_components/list-toolbar';
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
  searchParams: Promise<{ filter?: string; view?: string }>;
}) {
  const { filter, view: viewParam } = await searchParams;
  const showRecovered = filter === 'recovered';
  const showActive = filter === 'active';
  const filterParam = showRecovered ? 'recovered' : showActive ? 'active' : 'abandoned';

  const [prefs, carts] = await Promise.all([
    getUserPreferences(),
    api.get<CartRow[]>(`/v1/commerce/carts?filter=${filterParam}&take=250`),
  ]);

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Carts"
          badge={<Badge color="module">{carts.length} shown</Badge>}
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
      </Stack>
    </Container>
  );
}
