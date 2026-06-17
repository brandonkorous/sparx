import Link from 'next/link';
import { ClipboardList, Plus, Truck } from 'lucide-react';

import { Button, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { PurchaseOrderCreateForm } from './_components/purchase-order-create-form';

// New purchase order (docs/100 P3b). Needs at least one supplier + one warehouse;
// the server fetches both option lists and hands them to the client form.

export const dynamic = 'force-dynamic';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewPurchaseOrderPage() {
  const [{ data: suppliers }, { data: warehouses }] = await Promise.all([
    api.getPaged<PartyOption[]>('/v1/inventory/suppliers?take=250'),
    api.getPaged<PartyOption[]>('/v1/inventory/locations?take=250'),
  ]);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ClipboardList className="h-5 w-5" />}
          title="New purchase order"
          description="Order stock from a supplier into a warehouse. Saved as a draft you can edit, then submit when ready."
        />

        {suppliers.length === 0 || warehouses.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Truck className="h-5 w-5" />}
              title={suppliers.length === 0 ? 'Add a supplier first' : 'Add a warehouse first'}
              description={
                suppliers.length === 0
                  ? 'A purchase order needs a supplier to buy from. Create one, then come back.'
                  : 'A purchase order needs a destination warehouse to receive into. Create one, then come back.'
              }
              action={
                <Button color="module" asChild leftIcon={<Plus className="h-4 w-4" />}>
                  <Link
                    href={
                      suppliers.length === 0
                        ? '/inventory/suppliers/new'
                        : '/inventory/warehouses/new'
                    }
                  >
                    {suppliers.length === 0 ? 'New supplier' : 'New warehouse'}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <PurchaseOrderCreateForm suppliers={suppliers} warehouses={warehouses} />
        )}
      </Stack>
    </Container>
  );
}
