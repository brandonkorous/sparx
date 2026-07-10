import { Truck } from 'lucide-react';

import { Badge } from '@wizeworks/silicaui-react';

import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
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

// Independent pager query keys per section so zones + profiles page separately
// (each pair matches the keys handed to that section's <ListPager> in
// ShippingLists). Kept here so the server fetch window and the client pager stay
// in lockstep.
const ZONE_KEYS = { pageKey: 'zp', perPageKey: 'zpp' };
const PROFILE_KEYS = { pageKey: 'pp', perPageKey: 'ppp' };

export default async function ShippingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const zoneWindow = parsePageParams(params, undefined, ZONE_KEYS);
  const profileWindow = parsePageParams(params, undefined, PROFILE_KEYS);

  const [prefs, zonesPage, profilesPage] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ShippingZoneRow[]>(
      `/v1/commerce/shipping/zones?${new URLSearchParams({
        take: String(zoneWindow.take),
        skip: String(zoneWindow.skip),
      }).toString()}`
    ),
    api.getPaged<ShippingProfileRow[]>(
      `/v1/commerce/shipping/profiles?${new URLSearchParams({
        take: String(profileWindow.take),
        skip: String(profileWindow.skip),
      }).toString()}`
    ),
  ]);

  const zones = zonesPage.data;
  const profiles = profilesPage.data;
  const zoneTotal = (zonesPage.meta?.total as number | undefined) ?? zones.length;
  const profileTotal = (profilesPage.meta?.total as number | undefined) ?? profiles.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  // Special case: two independently-paged sections (zones + profiles), each with
  // its own inline <ListPager> rendered by ShippingLists — so there is no single
  // pager to hand to ListPageShell's `pager` slot. Only the header + shared
  // ListToolbar are pinned; both sections (with their own pagers) scroll
  // together in `children`.
  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Shipping"
          badge={
            <Badge color="module">
              {zoneTotal} zone{zoneTotal === 1 ? '' : 's'} · {profileTotal} profile
              {profileTotal === 1 ? '' : 's'}
            </Badge>
          }
          description="Zones map ship-to addresses (by country, region, postal range) to the rates a merchant offers there. Profiles group products that share carrier eligibility (standard goods, hazmat, freight). Real-time provider rates layer on top once you install a carrier from Commerce → Providers; the manual rates here serve as the fallback."
          className="mb-0"
        />
      }
      toolbar={<ListToolbar enableViewToggle searchable={false} />}
    >
      <ShippingLists
        zones={zones}
        profiles={profiles}
        view={view}
        zoneTotal={zoneTotal}
        profileTotal={profileTotal}
        zonePagerKeys={ZONE_KEYS}
        profilePagerKeys={PROFILE_KEYS}
      />
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
