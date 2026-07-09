import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database } from 'lucide-react';

import { Badge, Button } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { SyncHealthPanel } from './_components/sync-health-panel';
import { UnmappedQueue } from './_components/unmapped-queue';
import { MappingsPanel } from './_components/mappings-panel';
import { AgentPanel } from './_components/agent-panel';
import { SourceDetailActions } from './_components/source-detail-actions';
import {
  SOURCE_TYPE_LABEL,
  sourceStatusColor,
  type SourceLinkRow,
  type SourceSummary,
  type SyncHealth,
  type UnmappedSkuRow,
  type WarehouseOption,
} from './_components/types';

// Connection detail (docs/100 P5 Tier C) — one inventory source: its sync health
// (recent runs + counts), the unmapped-SKU review queue, and the SKU mappings that
// bind external SKUs to (variant, warehouse) pairs. The hub for keeping an external
// feed honest.

export async function SourceDetailContent({ id }: { id: string }) {
  let source: SourceSummary;
  try {
    source = await api.get<SourceSummary>(`/v1/inventory/sources/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [health, unmapped, links, warehouses] = await Promise.all([
    api.get<SyncHealth>(`/v1/inventory/sources/${id}/health`),
    api.getPaged<UnmappedSkuRow[]>(`/v1/inventory/sources/${id}/unmapped?status=pending&take=200`),
    api.getPaged<SourceLinkRow[]>(`/v1/inventory/sources/${id}/links?take=500`),
    api.getPaged<WarehouseOption[]>(`/v1/inventory/locations?take=250`),
  ]);

  const endpoint =
    typeof source.config?.csvUrl === 'string'
      ? source.config.csvUrl
      : typeof source.config?.endpoint === 'string'
        ? source.config.endpoint
        : null;

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/inventory/sources" />}
        className="self-start"
      >
        <ArrowLeft className="mr-1 size-4" /> Sources
      </Button>

      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Database className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{source.name}</h1>
            <Badge color={sourceStatusColor(source.status)} variant="soft">
              {source.status}
            </Badge>
          </div>
          <p className="text-base-content/70 text-sm">
            {SOURCE_TYPE_LABEL[source.type] ?? source.type}
            {endpoint ? (
              <>
                {' · '}
                <span className="font-mono">{endpoint}</span>
              </>
            ) : null}
          </p>
        </div>
        <SourceDetailActions source={source} />
      </div>

      {source.type === 'agent' ? <AgentPanel sourceId={id} health={health} /> : null}
      <SyncHealthPanel health={health} />
      <UnmappedQueue sourceId={id} rows={unmapped.data} warehouses={warehouses.data} />
      <MappingsPanel sourceId={id} links={links.data} warehouses={warehouses.data} />
    </div>
  );
}
