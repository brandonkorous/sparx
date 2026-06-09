import { Percent } from 'lucide-react';

import { Badge, Container, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { MarkupRulesManager, type MarkupRuleRow } from './_components/markup-rules-manager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Markup rules — Commerce' };

// Catalog markup rules (docs/48) — turn a variant's cost into a charged price
// by rule, so a vendor price-list import or a cost change re-prices without
// re-typing every SKU.
export default async function MarkupRulesPage() {
  const rules = await api.get<MarkupRuleRow[]>('/v1/markup-rules');

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Percent className="h-5 w-5" />}
          title="Markup rules"
          badge={
            <Badge color="module">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
            </Badge>
          }
          description="Derive a product's price from its cost — cost + 40%, keystone (×2), a target margin, or a flat markup. Bind a rule to variants on the product's Variants tab, or apply one across a scope here."
        />
        <Text size="sm" variant="muted">
          Markup is a cost → list-price step. B2B tiers and discounts apply on top of the list price
          it produces, so margin reporting stays honest.
        </Text>
        <MarkupRulesManager initialRules={rules} />
      </Stack>
    </Container>
  );
}
