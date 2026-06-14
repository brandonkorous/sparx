'use client';

import Link from 'next/link';
import { Globe2, Layers, Plus } from 'lucide-react';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  EmptyState,
  Heading,
  Stack,
  Text,
} from '@sparx/ui';

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
        <CardHeader>
          <Stack direction="row" align="end" justify="between" wrap gap={2}>
            <Stack gap={1}>
              <Stack direction="row" align="center" gap={2}>
                <Globe2 className="h-4 w-4" />
                <Heading level={3}>Zones</Heading>
              </Stack>
              <CardDescription>
                At least one zone covering your sell-to countries is required before checkout can
                quote shipping.
              </CardDescription>
            </Stack>
            <Button color="module" asChild>
              <Link href="/commerce/shipping/zones/new">
                <Plus className="h-4 w-4" />
                Add zone
              </Link>
            </Button>
          </Stack>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <EmptyState
              icon={<Globe2 className="h-5 w-5" />}
              title="No shipping zones yet"
              description="Add at least one zone covering the countries you sell to."
              action={
                <Button color="module" asChild>
                  <Link href="/commerce/shipping/zones/new">Create zone</Link>
                </Button>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Stack direction="row" align="end" justify="between" wrap gap={2}>
            <Stack gap={1}>
              <Stack direction="row" align="center" gap={2}>
                <Layers className="h-4 w-4" />
                <Heading level={3}>Profiles</Heading>
              </Stack>
              <CardDescription>
                Group products that share carrier eligibility. Hazmat-flagged items + freight needs
                land in their own profile.
              </CardDescription>
            </Stack>
            <Button color="module" asChild>
              <Link href="/commerce/shipping/profiles/new">
                <Plus className="h-4 w-4" />
                Add profile
              </Link>
            </Button>
          </Stack>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No shipping profiles yet"
              description="Create one profile per shipping pattern (standard, hazmat, freight)."
              action={
                <Button color="module" asChild>
                  <Link href="/commerce/shipping/profiles/new">Create profile</Link>
                </Button>
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
        </CardContent>
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
    <Stack direction="row" gap={1} wrap>
      {z.targeting.countries.slice(0, 6).map((c) => (
        <Badge key={c} variant="outline" className="text-xs">
          {c}
        </Badge>
      ))}
      {z.targeting.countries.length > 6 && (
        <Badge variant="outline" className="text-xs">
          +{z.targeting.countries.length - 6}
        </Badge>
      )}
    </Stack>
  ) : (
    <Text size="xs" variant="muted">
      any
    </Text>
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
    <Stack gap={2}>
      {zoneCountries(z)}
      <Stack direction="row" gap={4} wrap>
        <Text size="xs" variant="muted">
          Priority: {z.priority}
        </Text>
        <Text size="xs" variant="muted">
          Rates: {z.rateCount}
        </Text>
      </Stack>
    </Stack>
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
  <Stack direction="row" gap={1} wrap>
    {p.hazmatClassesAllowed.slice(0, 3).map((h) => (
      <Badge key={h} variant="outline" className="text-xs">
        {h}
      </Badge>
    ))}
  </Stack>
);

const profileFreight = (p: ShippingProfileRow) =>
  p.requiresFreight ? <Badge color="warning">freight</Badge> : '—';

const profileSignature = (p: ShippingProfileRow) =>
  p.requiresSignature ? <Badge variant="outline">required</Badge> : '—';

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
    <Stack gap={2}>
      {p.hazmatClassesAllowed.length > 0 ? profileHazmat(p) : null}
      <Stack direction="row" align="center" gap={2} wrap>
        <Text size="xs" variant="muted">
          Freight:
        </Text>
        {profileFreight(p)}
        <Text size="xs" variant="muted">
          Signature:
        </Text>
        {profileSignature(p)}
      </Stack>
      <Text size="xs" variant="muted">
        Products: {p.productCount}
      </Text>
    </Stack>
  ),
};
