import { DollarSign, Plus } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Container,
  EmptyState,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { TierCreateButton } from './_components/tier-create-button';

export const dynamic = 'force-dynamic';

interface PricingTierRow {
  id: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  productScope: string;
  minOrderCents: number;
  accountCount?: number;
  createdAt: string;
}

function discountLabel(t: PricingTierRow) {
  if (t.discountType === 'percentage') return `${t.discountValue}% off list`;
  return `$${(t.discountValue / 100).toFixed(2)} off`;
}

function scopeLabel(scope: string) {
  if (scope === 'all') return 'All products';
  if (scope === 'collections') return 'Selected collections';
  return 'Selected products';
}

export default async function PricingTiersPage() {
  const { data: tiers } = await api.getPaged<PricingTierRow[]>('/v1/b2b/pricing-tiers');

  return (
    <Container size="wide">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Pricing tiers"
          badge={
            <Badge color="module">
              {tiers.length} tier{tiers.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Named discount structures applied to B2B accounts. Product-level overrides take precedence over tier discounts."
          actions={<TierCreateButton />}
        />

        {tiers.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No pricing tiers yet"
              description="Create a pricing tier to apply automatic discounts to wholesale or fleet accounts."
              action={<TierCreateButton />}
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card key={tier.id}>
                <CardHeader>
                  <Stack direction="row" align="start" justify="between" gap={2}>
                    <CardTitle>{tier.name}</CardTitle>
                    <Badge color="module" variant="soft">
                      {discountLabel(tier)}
                    </Badge>
                  </Stack>
                  {tier.description && <CardDescription>{tier.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <Stack gap={2}>
                    <Stack direction="row" justify="between">
                      <Text size="sm" variant="muted">
                        Scope
                      </Text>
                      <Text size="sm">{scopeLabel(tier.productScope)}</Text>
                    </Stack>
                    {tier.minOrderCents > 0 && (
                      <Stack direction="row" justify="between">
                        <Text size="sm" variant="muted">
                          Minimum order
                        </Text>
                        <Text size="sm">
                          $
                          {(tier.minOrderCents / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                          })}
                        </Text>
                      </Stack>
                    )}
                    {tier.accountCount !== undefined && (
                      <Stack direction="row" justify="between">
                        <Text size="sm" variant="muted">
                          Accounts
                        </Text>
                        <Text size="sm">{tier.accountCount}</Text>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Stack>
    </Container>
  );
}
