import { notFound } from 'next/navigation';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../../_components/detail-header-slot';

import { ProfileDeleteButton } from './_components/profile-delete-button';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
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

export async function ShippingProfileDetailContent({ id }: Props) {
  let profile: ShippingProfileRow;
  try {
    profile = await api.get<ShippingProfileRow>(`/v1/commerce/shipping/profiles/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Delete is a lifecycle action — teleports into the shared detail
          chrome's header (drawer/modal chrome or the full-page shell), parity
          with every other entity's Archive/Delete control. */}
      <DetailHeaderSlot>
        <ProfileDeleteButton profileId={profile.id} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">{profile.name}</h1>
          {profile.description && <p className="text-base-content">{profile.description}</p>}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Carrier eligibility</h3>
            <p className="opacity-70">
              What this profile allows. Edit via direct API for now; visual editor lands in Phase
              5.x.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Field label="Hazmat classes allowed">
              <div className="flex flex-row flex-wrap gap-1">
                {profile.hazmatClassesAllowed.map((c) => (
                  <Badge key={c} color="neutral" variant="soft" size="sm">
                    {c}
                  </Badge>
                ))}
              </div>
            </Field>
            <Field label="Allowed carrier services">
              {profile.allowedCarrierServices.length > 0 ? (
                <div className="flex flex-row flex-wrap gap-1">
                  {profile.allowedCarrierServices.map((s) => (
                    <Badge key={s} color="neutral" variant="soft" size="sm" className="font-mono">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-base-content text-sm">any</p>
              )}
            </Field>
            <div className="flex flex-row gap-4">
              {profile.requiresSignature && (
                <Badge color="neutral" variant="soft" size="sm">
                  Signature required
                </Badge>
              )}
              {profile.requiresFreight && (
                <Badge color="warning" variant="soft" size="sm">
                  Freight only
                </Badge>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Attached</h3>
            <p className="opacity-70">
              Products / variants / collections currently routed through this profile.
            </p>
          </div>
          <div className="flex flex-row gap-6">
            <Counter label="Products" value={profile.productCount} />
            <Counter label="Variants" value={profile.variantCount} />
            <Counter label="Collections" value={profile.collectionCount} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content text-xs">{label}</p>
      {children}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-base-content text-xs">{label}</p>
      <h3 className="text-xl font-semibold">{value}</h3>
    </div>
  );
}
