import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Badge, Card, CardBody, EmptyState, Table } from 'silicaui-react';

import { statusLabel } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { NewRateForm } from './_components/new-rate-form';
import { RateDeleteButton } from './_components/rate-delete-button';
import { ZoneDeleteButton } from './_components/zone-delete-button';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

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

interface ShippingRateRow {
  id: string;
  zoneId: string;
  profileId: string;
  name: string;
  type: string;
  amountCents: number | null;
  freeAboveCents: number | null;
  bands: { min: number; max?: number; amountCents: number }[] | null;
  currency: string;
  carrier: string | null;
  estimatedDeliveryDays: number | null;
}

export async function ShippingZoneDetailContent({ id }: Props) {
  let zone: ShippingZoneRow;
  try {
    zone = await api.get<ShippingZoneRow>(`/v1/commerce/shipping/zones/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  const [profiles, rates] = await Promise.all([
    api.get<ShippingProfileRow[]>('/v1/commerce/shipping/profiles'),
    api.get<ShippingRateRow[]>(`/v1/commerce/shipping/zones/${id}/rates`),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">{zone.name}</h1>
          <div className="flex flex-row items-center gap-2">
            <Badge color="neutral" variant="soft" size="sm">
              priority {zone.priority}
            </Badge>
            <p className="text-base-content/70 text-sm">
              {zone.targeting.countries.length === 0
                ? 'any country'
                : `${zone.targeting.countries.length} countries`}
            </p>
          </div>
        </div>
        <ZoneDeleteButton zoneId={zone.id} />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Targeting</h3>
            <p className="opacity-70">
              The address matcher checks countries first, then regions, then postal-code ranges.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Countries">
              {zone.targeting.countries.length > 0 ? (
                <div className="flex flex-row flex-wrap gap-1">
                  {zone.targeting.countries.map((c) => (
                    <Badge key={c} color="neutral" variant="soft" size="sm">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">any</p>
              )}
            </Field>
            <Field label="Regions">
              {zone.targeting.regions.length > 0 ? (
                <div className="flex flex-row flex-wrap gap-1">
                  {zone.targeting.regions.map((r) => (
                    <Badge key={r} color="neutral" variant="soft" size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">none</p>
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              <Plus className="h-4 w-4" />
              <h3 className="text-xl font-semibold">Manual rates</h3>
            </div>
            <p className="opacity-70">
              Storefront uses these when no carrier provider is installed, or as a fallback if
              provider rates time out.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {rates.length === 0 ? (
              <EmptyState
                icon={<Plus className="h-5 w-5" />}
                title="No rates yet"
                description="Add a flat, by-weight, by-price, by-item-count, or free-above-threshold rate."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Profile</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Carrier</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>
                        <p className="text-base-content/70 text-xs">
                          {profileById.get(r.profileId)?.name ?? r.profileId.slice(0, 8)}
                        </p>
                      </td>
                      <td>
                        <Badge color="info" variant="soft" size="sm">
                          {statusLabel(r.type)}
                        </Badge>
                      </td>
                      <td>
                        {r.amountCents != null
                          ? `${(r.amountCents / 100).toFixed(2)} ${r.currency}`
                          : r.bands && r.bands.length > 0
                            ? `${r.bands.length} bands`
                            : '—'}
                      </td>
                      <td>{r.carrier ?? '—'}</td>
                      <td>
                        <RateDeleteButton rateId={r.id} zoneId={zone.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <h4 className="text-lg font-semibold">Add a rate</h4>
            <NewRateForm zoneId={zone.id} profiles={profiles} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content/70 text-xs">{label}</p>
      {children}
    </div>
  );
}
