import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Warehouse as WarehouseIcon } from 'lucide-react';

import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { statusLabel } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { WarehouseEditForm } from './_components/warehouse-edit-form';
import { WarehouseArchiveButton } from './_components/warehouse-archive-button';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InventoryLevelRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  unitCostCents: number | null;
  updatedAt: string;
}

interface LevelsForWarehouseResponse {
  items: InventoryLevelRow[];
  total: number;
}

export async function WarehouseDetailContent({ id }: Props) {
  let warehouse: WarehouseRow;
  try {
    warehouse = await api.get<WarehouseRow>(`/v1/inventory/locations/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const { items: levels, total: levelCount } = await api.get<LevelsForWarehouseResponse>(
    `/v1/inventory/levels/warehouse/${id}?take=500`
  );
  const onHandTotal = levels.reduce((acc, l) => acc + l.onHand, 0);
  const lowCount = levels.filter(
    (l) => l.reorderPoint !== null && l.available <= l.reorderPoint
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <WarehouseIcon className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{warehouse.name}</h1>
            <Badge color="neutral" variant="soft" size="sm" className="font-mono">
              {warehouse.code}
            </Badge>
            <Badge color="info" variant="soft" size="sm">
              {statusLabel(warehouse.type)}
            </Badge>
            {warehouse.isActive ? (
              <Badge color="success" variant="soft" size="sm">
                active
              </Badge>
            ) : (
              <Badge color="neutral" variant="soft" size="sm">
                inactive
              </Badge>
            )}
          </div>
          <p className="text-base-content/70 text-sm">
            {[warehouse.city, warehouse.region, warehouse.country].filter(Boolean).join(', ')}
          </p>
        </div>
        <WarehouseArchiveButton warehouseId={warehouse.id} isActive={warehouse.isActive} />
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Tracked variants" value={levelCount.toString()} />
        <Stat label="Total on hand" value={onHandTotal.toString()} />
        <Stat
          label="Below reorder point"
          value={lowCount.toString()}
          tone={lowCount > 0 ? 'warn' : 'ok'}
        />
      </div>

      <WarehouseEditForm warehouse={warehouse} />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Stock</h3>
            <p className="opacity-70">
              Full per-variant levels live on the{' '}
              <Link
                href={`/inventory/stock?warehouse=${warehouse.id}`}
                className="hover:text-module underline"
              >
                inventory page
              </Link>{' '}
              — filter by this warehouse from there.
            </p>
          </div>
          <Button
            variant="outline"
            render={<Link href={`/inventory/stock?warehouse=${warehouse.id}`} />}
          >
            Manage stock
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}) {
  return (
    <Card className="min-w-[10rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content/70 text-xs">{label}</p>
          <p className={`text-lg${tone === 'warn' ? 'text-warning' : ''}`}>{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
