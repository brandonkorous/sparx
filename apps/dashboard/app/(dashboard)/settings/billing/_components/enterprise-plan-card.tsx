// Enterprise plan card (docs/92 §C5, Phase 8). Manually-provisioned tenants
// (Gillett Diesel) run on a bespoke agreement, so the self-serve plan breakdown +
// module pricing don't apply. We show a "managed" state with a route to the account
// team for changes; the Stripe portal door stays open for invoices + payment method.

import { Building2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Stack, Text } from '@sparx/ui';

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
      <CardHeader>
        <Stack direction="row" align="center" gap={3} className="justify-between">
          <Stack direction="row" align="center" gap={2}>
            <Building2 className="h-5 w-5 text-[var(--color-text-muted)]" />
            <CardTitle>Enterprise plan</CardTitle>
          </Stack>
          <Badge color="module" variant="soft">
            Managed
          </Badge>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={5}>
          <Text size="sm" variant="muted">
            Your workspace is on a custom Enterprise agreement — bespoke pricing, managed hosting,
            and a dedicated account team. Plan changes go through your account team rather than the
            self-serve flow.
          </Text>
          <Stack direction="row" gap={3} className="flex-wrap">
            <Button asChild color="module" variant="solid">
              <a href={`mailto:${ENTERPRISE_SUPPORT_EMAIL}`}>Contact your account team</a>
            </Button>
            {canManage && billingActive ? (
              <ManageBillingButton label="Invoices & payment method" variant="outline" />
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
