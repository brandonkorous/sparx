// Payments settings (docs/94 ADR §13) — pick the gateway and run Stripe's hosted
// Connect onboarding. sparx Pay is the recommended, branded path (Stripe Connect under
// the hood); merchants can also bring their own Stripe account or take payments
// manually. Module-gated on Commerce (the primary payment consumer); a tenant without
// it sees the activation upsell.

import { Wallet } from 'lucide-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getGatewayCatalog, getGatewayCredentials, getPaymentConfig } from './actions';
import { PaymentsManager } from './_components/payments-manager';

export const dynamic = 'force-dynamic';

export default async function PaymentsSettingsPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

  const [config, catalog, credentials] = await Promise.all([
    getPaymentConfig(),
    getGatewayCatalog(),
    getGatewayCredentials(),
  ]);

  return (
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Wallet className="h-5 w-5" />}
            title="Payments"
            description="How you accept payments at checkout. sparx Pay is the fastest path — or connect a processor you already use."
          />
          <PaymentsManager initialConfig={config} catalog={catalog} credentials={credentials} />
        </div>
      </div>
    </ModuleProvider>
  );
}
