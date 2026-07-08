import { Settings2 } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';

import { CommerceSiteSettingsForm } from './_components/site-settings-form';

export const dynamic = 'force-dynamic';

interface CommerceSiteSettings {
  defaultCurrency: string;
  defaultLocale: string;
  defaultWarehouseId: string | null;
  channelsEnabled: string[];
  cartAbandonmentMinutes: number;
  showStockBelow: number;
  hidePricesWhenSignedOut: boolean;
  requireAuthForCheckout: boolean;
}

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default async function CommerceSiteSettingsPage() {
  const [settings, warehouses] = await Promise.all([
    api.get<CommerceSiteSettings>('/v1/commerce/site/settings'),
    api.get<WarehouseRow[]>('/v1/inventory/locations'),
  ]);

  const initialForForm = {
    ...settings,
    channelsEnabled: settings.channelsEnabled as (
      | 'storefront'
      | 'b2b_portal'
      | 'admin'
      | 'subscription'
      | 'mcp'
      | 'import'
    )[],
  };

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Settings2 className="h-5 w-5" />}
          title="Storefront settings"
          badge={<Badge color="module">commerce defaults</Badge>}
          description="Tenant-wide commerce defaults. Sitebuilder owns layout — settings here govern currency, channel toggles, abandonment thresholds, and per-checkout guardrails. The storefront and B2B portal read these values at request time."
        />

        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Defaults</h3>
              <p className="opacity-70">
                Currency + locale + default warehouse get picked up by new carts, new orders, and
                checkout sessions. Existing rows keep their frozen values.
              </p>
            </div>
            <CommerceSiteSettingsForm
              initial={initialForForm}
              warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
