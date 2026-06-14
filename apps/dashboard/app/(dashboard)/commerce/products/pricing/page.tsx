import { DollarSign } from 'lucide-react';

import { Badge, Container, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import {
  BulkPricingTool,
  type BulkRule,
  type CollectionOption,
} from './_components/bulk-pricing-tool';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Bulk pricing — Commerce' };

// Bulk pricing tool (docs/48 §4) — apply a markup rule across a scope you pick
// (a collection, a product type, a hand-picked set), preview every before/after
// price, then commit. The math is the same pure engine the variant editor uses;
// this surface is the catalog-wide repricing entry point.
export default async function BulkPricingPage() {
  const [rules, collectionList] = await Promise.all([
    api.get<BulkRule[]>('/v1/markup-rules'),
    api.getPaged<CollectionOption[]>('/v1/commerce/collections?take=100'),
  ]);

  // Only catalog-applicable rules can reprice the catalog; document-only rules
  // run on invoices/quotes, not here.
  const catalogRules = rules.filter((r) => r.appliesTo !== 'document');

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Bulk pricing"
          badge={
            <Badge color="module">
              {catalogRules.length} {catalogRules.length === 1 ? 'rule' : 'rules'}
            </Badge>
          }
          description="Apply a markup rule across a scope you choose — preview every before/after price, then commit. Variants without a cost are skipped."
        />
        <Text size="sm" variant="muted">
          Applying binds each priced variant to the rule and stamps a snapshot, so a later cost
          change can re-derive the price. Bind individual variants on a product’s Variants tab;
          author the rules themselves under{' '}
          <a className="underline" href="/commerce/markup-rules">
            Markup rules
          </a>
          .
        </Text>
        <BulkPricingTool rules={catalogRules} collections={collectionList.data} />
      </Stack>
    </Container>
  );
}
