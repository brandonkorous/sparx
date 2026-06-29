import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Truck } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

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
    <Stack gap={6}>
      <Stack direction="row" align="end" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <Truck className="h-5 w-5" />
            <Heading level={1}>{supplier.name}</Heading>
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
          </Stack>
          <Text size="sm" variant="muted">
            {[supplier.contactName, supplier.email, supplier.phone].filter(Boolean).join(' · ') ||
              'No contact on file'}
          </Text>
        </Stack>
        <SupplierArchiveButton supplierId={supplier.id} isActive={supplier.isActive} />
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stat label="Linked variants" value={variants.length.toString()} />
        <Stat label="Preferred source for" value={preferredCount.toString()} />
        <Stat
          label="Lead time"
          value={supplier.leadTimeDays !== null ? `${supplier.leadTimeDays}d` : '—'}
        />
        <Stat label="Terms" value={supplier.paymentTerms ?? '—'} />
      </Stack>

      <SupplierEditForm supplier={supplier} />

      <SupplierVariantsPanel supplierId={supplier.id} links={variants} />

      <Text size="xs" variant="muted">
        Purchase orders for this supplier land in{' '}
        <Link href="/inventory/suppliers" className="underline hover:text-[var(--module-active)]">
          a later step
        </Link>{' '}
        (docs/100 P3b).
      </Text>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardContent>
        <Stack gap={1} className="py-2">
          <Text size="xs" variant="muted">
            {label}
          </Text>
          <Text size="lg">{value}</Text>
        </Stack>
      </CardContent>
    </Card>
  );
}
