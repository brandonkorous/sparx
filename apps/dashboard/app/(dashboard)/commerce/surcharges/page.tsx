import { CreditCard } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Alert, AlertContent, AlertDescription, AlertTitle, Badge } from 'silicaui-react';

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
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
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
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>Surcharging is legally constrained</AlertTitle>
            <AlertDescription>
              Credit-card surcharge rules vary by state and card network, must not exceed your
              actual cost of acceptance, and must be disclosed before payment. Review the
              requirements for your jurisdiction before enabling — you are responsible for
              compliance.
            </AlertDescription>
          </AlertContent>
        </Alert>
        <SurchargesManager initialRules={rules} />
      </div>
    </div>
  );
}
