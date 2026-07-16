import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Truck } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { SupplierEditForm, type SupplierDetail } from './_components/supplier-edit-form';
import { SupplierArchiveButton } from './_components/supplier-archive-button';
import {
  SupplierVariantsPanel,
  type SupplierVariantRow,
} from './_components/supplier-variants-panel';

export const dynamic = 'force-dynamic';

interface SupplierDetailResponse extends SupplierDetail {
  variants: SupplierVariantRow[];
}

export async function SupplierDetailContent({ id }: { id: string }) {
  let supplier: SupplierDetailResponse;
  try {
    supplier = await api.get<SupplierDetailResponse>(`/v1/inventory/suppliers/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const variants = supplier.variants ?? [];
  const preferredCount = variants.filter((v) => v.isPreferred).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Truck className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{supplier.name}</h1>
            <Badge color="neutral" variant="soft" size="sm" className="font-mono">
              {supplier.code}
            </Badge>
            {supplier.isActive ? (
              <Badge color="success" variant="soft" size="sm">
                active
              </Badge>
            ) : (
              <Badge color="neutral" variant="soft" size="sm">
                inactive
              </Badge>
            )}
          </div>
          <p className="text-base-content text-sm">
            {[supplier.contactName, supplier.email, supplier.phone].filter(Boolean).join(' · ') ||
              'No contact on file'}
          </p>
        </div>
        <SupplierArchiveButton supplierId={supplier.id} isActive={supplier.isActive} />
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Linked variants" value={variants.length.toString()} />
        <Stat label="Preferred source for" value={preferredCount.toString()} />
        <Stat
          label="Lead time"
          value={supplier.leadTimeDays !== null ? `${supplier.leadTimeDays}d` : '—'}
        />
        <Stat label="Terms" value={supplier.paymentTerms ?? '—'} />
      </div>

      <SupplierEditForm supplier={supplier} />

      <SupplierVariantsPanel supplierId={supplier.id} links={variants} />

      <p className="text-base-content text-xs">
        Purchase orders for this supplier land in{' '}
        <Link href="/inventory/suppliers" className="hover:text-module underline">
          a later step
        </Link>{' '}
        (docs/100 P3b).
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
