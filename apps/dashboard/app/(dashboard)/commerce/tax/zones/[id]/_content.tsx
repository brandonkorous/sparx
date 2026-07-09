import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';

import { Badge, Card, CardBody, EmptyState, Table } from '@wizeworks/silicaui-react';

import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { NewTaxRateForm } from './_components/new-tax-rate-form';
import { TaxRateDeleteButton } from './_components/tax-rate-delete-button';
import { TaxZoneDeleteButton } from './_components/tax-zone-delete-button';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

interface TaxZoneRow {
  id: string;
  country: string;
  region: string | null;
  nexusType: string;
  registrationNumber: string | null;
  registeredAt: string | null;
  isActive: boolean;
  rateCount: number;
}

interface TaxRateRow {
  id: string;
  zoneId: string;
  name: string;
  rateBasisPoints: number;
  appliesToShipping: boolean;
  productTaxClass: string | null;
}

export async function TaxZoneDetailContent({ id }: Props) {
  let zone: TaxZoneRow;
  try {
    zone = await api.get<TaxZoneRow>(`/v1/commerce/tax/zones/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  const rates = await api.get<TaxRateRow[]>(`/v1/commerce/tax/zones/${id}/rates`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">
            {zone.country}
            {zone.region ? ` — ${zone.region}` : ''}
          </h1>
          <div className="flex flex-row items-center gap-2">
            <Badge
              color={statusTone(zone.isActive ? 'active' : 'inactive')}
              variant="soft"
              size="sm"
            >
              {statusLabel(zone.isActive ? 'active' : 'inactive')}
            </Badge>
            <Badge color="neutral" variant="soft" size="sm">
              {statusLabel(zone.nexusType)}
            </Badge>
            {zone.registrationNumber && (
              <p className="text-base-content/70 font-mono text-xs">{zone.registrationNumber}</p>
            )}
          </div>
        </div>
        <TaxZoneDeleteButton zoneId={zone.id} />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              <Plus className="h-4 w-4" />
              <h3 className="text-xl font-semibold">Manual rates</h3>
            </div>
            <p className="opacity-70">
              Used when no TaxProvider is installed. Each rate&apos;s basis points (e.g. 825 =
              8.25%) stack additively per matching line.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {rates.length === 0 ? (
              <EmptyState
                icon={<Plus className="h-5 w-5" />}
                title="No rates yet"
                description="Add the sales-tax / VAT rate for this jurisdiction."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rate</th>
                    <th>Applies to shipping</th>
                    <th>Product class</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>
                        <p className="font-mono">{(r.rateBasisPoints / 100).toFixed(2)}%</p>
                      </td>
                      <td>{r.appliesToShipping ? 'yes' : 'no'}</td>
                      <td>
                        {r.productTaxClass ?? <p className="text-base-content/70 text-xs">all</p>}
                      </td>
                      <td>
                        <TaxRateDeleteButton rateId={r.id} zoneId={zone.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            <h4 className="text-lg font-semibold">Add a rate</h4>
            <NewTaxRateForm zoneId={zone.id} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
