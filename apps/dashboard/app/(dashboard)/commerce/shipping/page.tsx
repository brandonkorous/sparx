import { Truck } from 'lucide-react';

import { Badge, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { ShippingLists } from './_components/shipping-lists';

// Shipping — zones + profiles. A standard Collection/List surface (docs/34 §7):
// one ListToolbar view toggle flips both sections together; the per-section
// "Add" CTAs stay in their card headers.

export const dynamic = 'force-dynamic';

interface ZoneTargeting {
  countries: string[];
  regions: string[];
  postalCodeRanges: { country: string; from: string; to: string }[];
}

interface ShippingZoneRow {
  id: string;
  name: string;
  priority: number;
  targeting: ZoneTargeting;
  rateCount: number;
  updatedAt: string;
}

interface ShippingProfileRow {
  id: string;
  name: string;
  description: string | null;
  allowedCarrierServices: string[];
  hazmatClassesAllowed: string[];
  requiresSignature: boolean;
  requiresFreight: boolean;
  productCount: number;
  variantCount: number;
  collectionCount: number;
  updatedAt: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShippingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, zones, profiles] = await Promise.all([
    getUserPreferences(),
    api.get<ShippingZoneRow[]>('/v1/commerce/shipping/zones'),
    api.get<ShippingProfileRow[]>('/v1/commerce/shipping/profiles'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Shipping"
          badge={
            <Badge color="module">
              {zones.length} zone{zones.length === 1 ? '' : 's'} · {profiles.length} profile
              {profiles.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Zones map ship-to addresses (by country, region, postal range) to the rates a merchant offers there. Profiles group products that share carrier eligibility (standard goods, hazmat, freight). Real-time provider rates layer on top once you install a carrier from Commerce → Providers; the manual rates here serve as the fallback."
        />

        <ListToolbar enableViewToggle searchable={false} />

        <ShippingLists zones={zones} profiles={profiles} view={view} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
