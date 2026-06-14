import { CreditCard } from 'lucide-react';

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
import {
  CheckoutSessionsList,
  type CheckoutSessionRow,
} from './_components/checkout-sessions-list';

export const dynamic = 'force-dynamic';

const STEP_ORDER = ['cart_review', 'contact', 'shipping', 'payment', 'review'] as const;

const STEP_OPTIONS = [
  ...STEP_ORDER.map((s) => ({ value: s, label: labelForStep(s) })),
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

export default async function CheckoutSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const step = stringParam(params.step);
  const viewParam = stringParam(params.view);
  const { skip, take } = parsePageParams(params);
  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (step) query.set('step', step);
  const [prefs, { data: sessions, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<CheckoutSessionRow[]>(`/v1/commerce/checkout-sessions?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? sessions.length;

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Checkout sessions"
          badge={<Badge color="module">{total} in-flight</Badge>}
          description="Read-only diagnostic. The state machine advances cart_review → contact → shipping → payment → review → completed. Sessions stuck in a non-terminal step are auto-expired on TTL by the worker; staff can manually expire a session from the API if needed."
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'step', label: 'Steps', options: STEP_OPTIONS }]}
          enableViewToggle
        />

        {sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <Stack gap={1}>
                <Heading level={3}>{step ? labelForStep(step) : 'Active'}</Heading>
                <CardDescription>
                  Click a cart ID to see the items + pricing trace; the session lifecycle is the
                  table here.
                </CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No sessions"
                description="Checkout sessions appear here when the storefront starts writing."
              />
            </CardContent>
          </Card>
        ) : (
          <Stack gap={1}>
            <Heading level={3}>{step ? labelForStep(step) : 'Active'}</Heading>
            <CardDescription>
              Click a cart ID to see the items + pricing trace; the session lifecycle is the table
              here.
            </CardDescription>
            <CheckoutSessionsList rows={sessions} view={view} />
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

function labelForStep(s: string): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
