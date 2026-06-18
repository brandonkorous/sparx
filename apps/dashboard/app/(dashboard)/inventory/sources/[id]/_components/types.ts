// Shared client types + formatters for the source/connection detail surface
// (docs/100 P5 Tier C). Plain TS (no 'use server' / no React), safe to import from
// both the server page and the client panels. Shapes mirror the @sparx/inventory
// serializers exposed by /v1/inventory/sources/:id/{health,runs,unmapped,links}.

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'module';

export interface SourceSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  lastSyncAt: string | null;
  syncIntervalSec: number;
  notes: string | null;
  createdAt: string;
}

export interface SyncRunRow {
  id: string;
  trigger: string;
  status: string;
  rowsTotal: number;
  rowsMatched: number;
  rowsChanged: number;
  rowsUnchanged: number;
  rowsUnmatched: number;
  rowsSkipped: number;
  rowsStale: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SyncHealth {
  sourceId: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  latestRun: SyncRunRow | null;
  recentRuns: SyncRunRow[];
  pendingUnmappedCount: number;
  activeLinkCount: number;
  staleLinkCount: number;
  // Tier A bridge agent (docs/100 P5d) — populated for `agent` sources.
  agentEnrolled: boolean;
  apiKeyPrefix: string | null;
  enrolledAt: string | null;
  agentLastSeenAt: string | null;
  agentVersion: string | null;
  agentOnline: boolean;
}

export interface UnmappedSkuRow {
  id: string;
  externalSku: string;
  externalLocation: string | null;
  lastQuantity: number;
  seenCount: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  suggestedVariantId: string | null;
  suggestedVariantSku: string | null;
  suggestedProductTitle: string | null;
}

export interface SourceLinkRow {
  id: string;
  externalSku: string;
  externalLocation: string | null;
  status: string;
  externalUom: string | null;
  unitsPerExternal: number;
  safetyBuffer: number;
  isStale: boolean;
  lastSeenAt: string | null;
  variant: { id: string; sku: string; title: string | null } | null;
  warehouse: { id: string; name: string; code: string } | null;
}

/** Controls a mapping carries — UoM conversion + the oversell safety buffer. */
export interface MappingControls {
  externalUom?: string | null;
  unitsPerExternal?: number;
  safetyBuffer?: number;
}

export interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

// ─── Labels + colors ───────────────────────────────────────────────────────────

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  csv: 'CSV feed',
  api: 'API',
  agent: 'On-prem bridge agent',
};

export function sourceStatusColor(status: string): BadgeColor {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}

export function runStatusColor(status: string): BadgeColor {
  if (status === 'success') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}

export const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  push: 'Push',
  api: 'API',
};

export function triggerLabel(trigger: string): string {
  return TRIGGER_LABEL[trigger] ?? trigger;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function externalRef(sku: string, location: string | null): string {
  return location ? `${sku} @ ${location}` : sku;
}
