import { CreditCard } from 'lucide-react';

import { Alert, Badge, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { SurchargesManager, type SurchargeRuleRow } from './_components/surcharges-manager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Surcharges — Commerce' };

// Document-level surcharges (docs/48 §6) — card-fee pass-through + handling/
// small-order fees. Computed at checkout after tax, shown as their own line,
// and reversed proportionally on refund.
export default async function SurchargesPage() {
  const rules = await api.get<SurchargeRuleRow[]>('/v1/surcharge-rules');

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Surcharges"
          badge={
            <Badge color="module">
              {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
            </Badge>
          }
          description="Pass a transaction cost through to the order as its own line — most often a credit-card processing fee. Computed after tax, gated by payment method, and reversed proportionally on refund."
        />
        <Alert color="warning" variant="soft" title="Surcharging is legally constrained">
          Credit-card surcharge rules vary by state and card network, must not exceed your actual
          cost of acceptance, and must be disclosed before payment. Review the requirements for your
          jurisdiction before enabling — you are responsible for compliance.
        </Alert>
        <SurchargesManager initialRules={rules} />
      </Stack>
    </Container>
  );
}
