import { Gift, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
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
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Gift className="h-5 w-5" />}
          title="Gift cards"
          badge={
            <Badge color="module">{moneyFmt.format(outstandingCents / 100)} outstanding</Badge>
          }
          description="Issue, look up, and adjust gift cards. Cards sold as a product (a future Phase 4 sellable product type) link back to the order item so a refund revokes the unspent balance."
          actions={
            <EntityCreateButton
              entityType="gift-card"
              newHref="/commerce/gift-cards/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar searchPlaceholder="Search code, recipient name or email…" enableViewToggle />

        {cards.length === 0 ? (
          <Card className="bg-module bg-soft">
            <EmptyState
              icon={<Gift className="h-5 w-5" />}
              title="No gift cards yet"
              description="Issue one with the New button. Cards stay active until spent, expired, or cancelled."
              actions={
                <EntityCreateButton
                  entityType="gift-card"
                  newHref="/commerce/gift-cards/new"
                  color="module"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <GiftCardsList cards={cards} view={view} />
        )}
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
