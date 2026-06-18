import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database } from 'lucide-react';

import { Badge, Button, Heading, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { SyncHealthPanel } from './_components/sync-health-panel';
import { UnmappedQueue } from './_components/unmapped-queue';
import { MappingsPanel } from './_components/mappings-panel';
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

  const csvUrl = typeof source.config?.csvUrl === 'string' ? source.config.csvUrl : null;

  return (
    <Stack gap={6}>
      <Button variant="ghost" size="sm" asChild className="self-start">
        <Link href="/inventory/sources">
          <ArrowLeft className="mr-1 size-4" /> Sources
        </Link>
      </Button>

      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <Database className="h-5 w-5" />
            <Heading level={1}>{source.name}</Heading>
            <Badge color={sourceStatusColor(source.status)} variant="soft">
              {source.status}
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {SOURCE_TYPE_LABEL[source.type] ?? source.type}
            {csvUrl ? (
              <>
                {' · '}
                <span className="font-mono">{csvUrl}</span>
              </>
            ) : null}
          </Text>
        </Stack>
        <SourceDetailActions source={source} />
      </Stack>

      <SyncHealthPanel health={health} />
      <UnmappedQueue sourceId={id} rows={unmapped.data} warehouses={warehouses.data} />
      <MappingsPanel sourceId={id} links={links.data} warehouses={warehouses.data} />
    </Stack>
  );
}
