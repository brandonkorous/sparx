// Enterprise plan card (docs/92 §C5, Phase 8). Manually-provisioned tenants
// (Gillett Diesel) run on a bespoke agreement, so the self-serve plan breakdown +
// module pricing don't apply. We show a "managed" state with a route to the account
// team for changes; the Stripe portal door stays open for invoices + payment method.

import { Building2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';

import { ManageBillingButton } from './manage-billing-button';

const ENTERPRISE_SUPPORT_EMAIL = 'enterprise@sparx.works';

export function EnterprisePlanCard({
  canManage,
  billingActive,
}: {
  canManage: boolean;
  billingActive: boolean;
}) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="text-base-content h-5 w-5" />
            <CardTitle>Enterprise plan</CardTitle>
          </div>
          <Badge color="module" variant="soft">
            Managed
          </Badge>
        </div>
        <p className="text-base-content text-sm">
          Your workspace is on a custom Enterprise agreement — bespoke pricing, managed hosting, and
          a dedicated account team. Plan changes go through your account team rather than the
          self-serve flow.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            color="module"
            variant="solid"
            render={
              <a
                href={`mailto:${ENTERPRISE_SUPPORT_EMAIL}`}
                aria-label="Contact your account team"
              />
            }
          >
            Contact your account team
          </Button>
          {canManage && billingActive ? (
            <ManageBillingButton label="Invoices & payment method" variant="outline" />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
