// Payments settings (docs/94 ADR §13) — pick the gateway and run Stripe's hosted
// Connect onboarding. sparx Pay is the recommended, branded path (Stripe Connect under
// the hood); merchants can also bring their own Stripe account or take payments
// manually. Module-gated on Commerce (the primary payment consumer); a tenant without
// it sees the activation upsell.

import { Wallet } from 'lucide-react';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getPaymentConfig } from './actions';
import { PaymentsManager } from './_components/payments-manager';

export const dynamic = 'force-dynamic';

export default async function PaymentsSettingsPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

  const config = await getPaymentConfig();

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Wallet className="h-5 w-5" />}
          title="Payments"
          description="Choose how you accept payments. sparx Pay sets you up in minutes — sparx handles disputes, settlement, and PCI, and takes a flat 0.5% per transaction. Or connect your own processor and keep sparx out of the money flow."
        />
        <PaymentsManager initialConfig={config} />
      </Stack>
    </Container>
  );
}
