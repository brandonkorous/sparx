'use client';

import { Globe2, Layers, Plus } from 'lucide-react';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import { EntityCreateButton } from '../../../_components/entity-create-button';
import { EntityRowLink } from '../../../_components/entity-row-link';
import { ListPager } from '../../../_components/list-pager';

// Client wrapper for the Shipping overview. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands the two sections' rows + a shared `view` here and this builds both
// lists. Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open
// the zone / profile detail via EntityRowLink. The single `view` from the
// page-level ListToolbar flips BOTH sections together. The per-section "Add"
// CTAs stay in their card headers.

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

interface PagerKeys {
  pageKey: string;
  perPageKey: string;
}

interface ShippingListsProps {
  zones: ShippingZoneRow[];
  profiles: ShippingProfileRow[];
  view: 'table' | 'card';
  zoneTotal: number;
  profileTotal: number;
  zonePagerKeys: PagerKeys;
  profilePagerKeys: PagerKeys;
}

export function ShippingLists({
  zones,
  profiles,
  view,
  zoneTotal,
  profileTotal,
  zonePagerKeys,
  profilePagerKeys,
}: ShippingListsProps) {
  return (
    <>
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <Globe2 className="h-4 w-4" />
                <h3 className="text-xl font-semibold">Zones</h3>
              </div>
              <p className="opacity-70">
                At least one zone covering your sell-to countries is required before checkout can
                quote shipping.
              </p>
            </div>
            <EntityCreateButton
              entityType="shipping-zone"
              newHref="/commerce/shipping/zones/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New zone
            </EntityCreateButton>
          </div>
          {zones.length === 0 ? (
            <EmptyState
              icon={<Globe2 className="h-5 w-5" />}
              title="No shipping zones yet"
              description="Add at least one zone covering the countries you sell to."
              actions={
                <EntityCreateButton
                  entityType="shipping-zone"
                  newHref="/commerce/shipping/zones/new"
                  color="module"
                >
                  New zone
                </EntityCreateButton>
              }
            />
          ) : (
            <SelectionList
              items={zones}
              view={view}
              getId={(z) => z.id}
              selectable={false}
              entityLabelPlural="zones"
              getRowLabel={(z) => z.name}
              columns={zoneColumns}
              card={zoneCard}
            />
          )}
          <ListPager
            total={zoneTotal}
            pageKey={zonePagerKeys.pageKey}
            perPageKey={zonePagerKeys.perPageKey}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <Layers className="h-4 w-4" />
                <h3 className="text-xl font-semibold">Profiles</h3>
              </div>
              <p className="opacity-70">
                Group products that share carrier eligibility. Hazmat-flagged items + freight needs
                land in their own profile.
              </p>
            </div>
            <EntityCreateButton
              entityType="shipping-profile"
              newHref="/commerce/shipping/profiles/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New profile
            </EntityCreateButton>
          </div>
          {profiles.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No shipping profiles yet"
              description="Create one profile per shipping pattern (standard, hazmat, freight)."
              actions={
                <EntityCreateButton
                  entityType="shipping-profile"
                  newHref="/commerce/shipping/profiles/new"
                  color="module"
                >
                  New profile
                </EntityCreateButton>
              }
            />
          ) : (
            <SelectionList
              items={profiles}
              view={view}
              getId={(p) => p.id}
              selectable={false}
              entityLabelPlural="profiles"
              getRowLabel={(p) => p.name}
              columns={profileColumns}
              card={profileCard}
            />
          )}
          <ListPager
            total={profileTotal}
            pageKey={profilePagerKeys.pageKey}
            perPageKey={profilePagerKeys.perPageKey}
          />
        </CardBody>
      </Card>
    </>
  );
}

const zoneName = (z: ShippingZoneRow) => (
  <EntityRowLink
    href={`/commerce/shipping/zones/${z.id}`}
    entityType="shipping-zone"
    entityId={z.id}
    className="font-medium hover:text-[var(--module-active)]"
  >
    {z.name}
  </EntityRowLink>
);

const zoneCountries = (z: ShippingZoneRow) =>
  z.targeting.countries.length > 0 ? (
    <div className="flex flex-row flex-wrap gap-1">
      {z.targeting.countries.slice(0, 6).map((c) => (
        <Badge key={c} color="neutral" variant="soft" size="sm">
          {c}
        </Badge>
      ))}
      {z.targeting.countries.length > 6 && (
        <Badge color="neutral" variant="soft" size="sm">
          +{z.targeting.countries.length - 6}
        </Badge>
      )}
    </div>
  ) : (
    <p className="text-base-content/70 text-xs">any</p>
  );

const zoneColumns: SelectionColumn<ShippingZoneRow>[] = [
  { header: 'Name', cell: zoneName },
  { header: 'Countries', cell: zoneCountries },
  { header: 'Priority', cell: (z) => z.priority },
  { header: 'Rates', cell: (z) => z.rateCount },
];

const zoneCard: SelectionCard<ShippingZoneRow> = {
  title: zoneName,
  body: (z) => (
    <div className="flex flex-col gap-2">
      {zoneCountries(z)}
      <div className="flex flex-row flex-wrap gap-4">
        <p className="text-base-content/70 text-xs">Priority: {z.priority}</p>
        <p className="text-base-content/70 text-xs">Rates: {z.rateCount}</p>
      </div>
    </div>
  ),
};

const profileName = (p: ShippingProfileRow) => (
  <EntityRowLink
    href={`/commerce/shipping/profiles/${p.id}`}
    entityType="shipping-profile"
    entityId={p.id}
    className="font-medium hover:text-[var(--module-active)]"
  >
    {p.name}
  </EntityRowLink>
);

const profileHazmat = (p: ShippingProfileRow) => (
  <div className="flex flex-row flex-wrap gap-1">
    {p.hazmatClassesAllowed.slice(0, 3).map((h) => (
      <Badge key={h} color="neutral" variant="soft" size="sm">
        {h}
      </Badge>
    ))}
  </div>
);

const profileFreight = (p: ShippingProfileRow) =>
  p.requiresFreight ? (
    <Badge color="warning" variant="soft" size="sm">
      freight
    </Badge>
  ) : (
    '—'
  );

const profileSignature = (p: ShippingProfileRow) =>
  p.requiresSignature ? (
    <Badge color="neutral" variant="soft" size="sm">
      required
    </Badge>
  ) : (
    '—'
  );

const profileColumns: SelectionColumn<ShippingProfileRow>[] = [
  { header: 'Name', cell: profileName },
  { header: 'Hazmat allowed', cell: profileHazmat },
  { header: 'Freight', cell: profileFreight },
  { header: 'Signature', cell: profileSignature },
  { header: 'Products', cell: (p) => p.productCount },
];

const profileCard: SelectionCard<ShippingProfileRow> = {
  title: profileName,
  body: (p) => (
    <div className="flex flex-col gap-2">
      {p.hazmatClassesAllowed.length > 0 ? profileHazmat(p) : null}
      <div className="flex flex-row flex-wrap items-center gap-2">
        <p className="text-base-content/70 text-xs">Freight:</p>
        {profileFreight(p)}
        <p className="text-base-content/70 text-xs">Signature:</p>
        {profileSignature(p)}
      </div>
      <p className="text-base-content/70 text-xs">Products: {p.productCount}</p>
    </div>
  ),
};
