import { Gift } from 'lucide-react';

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
import { IssueGiftCardForm } from './_components/issue-gift-card-form';
import { GiftCardsList, type GiftCardSummary } from './_components/gift-cards-list';

export const dynamic = 'force-dynamic';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GiftCardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = stringParam(params.q);
  const query = new URLSearchParams({ take: '100' });
  if (q) query.set('q', q);

  const [prefs, cards] = await Promise.all([
    getUserPreferences(),
    api.get<GiftCardSummary[]>(`/v1/commerce/gift-cards?${query.toString()}`),
  ]);

  const outstandingCents = cards
    .filter((c) => c.status === 'active')
    .reduce((acc, c) => acc + c.balanceCents, 0);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Gift className="h-5 w-5" />}
          title="Gift cards"
          badge={
            <Badge color="module">{moneyFmt.format(outstandingCents / 100)} outstanding</Badge>
          }
          description="Issue, look up, and adjust gift cards. Cards sold as a product (a future Phase 4 sellable product type) link back to the order item so a refund revokes the unspent balance."
        />

        <Card>
          <CardHeader>
            <Stack gap={1}>
              <Heading level={3}>Issue a new card</Heading>
              <CardDescription>
                Codes are auto-generated (16 alphanumeric, hyphen-grouped). Use a custom code only
                when migrating from a legacy system.
              </CardDescription>
            </Stack>
          </CardHeader>
          <CardContent>
            <IssueGiftCardForm />
          </CardContent>
        </Card>

        <ListToolbar searchPlaceholder="Search code, recipient name or email…" enableViewToggle />

        {cards.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Gift className="h-5 w-5" />}
              title="No gift cards yet"
              description="Issue one above. Cards stay active until spent, expired, or cancelled."
            />
          </Card>
        ) : (
          <GiftCardsList cards={cards} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
