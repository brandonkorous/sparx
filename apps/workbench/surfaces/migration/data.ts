'use client';

// Migration data — the vendor catalogue, run history, and the mutations that
// start and stop a move.
//
// The interesting part of this module is what is NOT here: reading and checking
// the tenant's file. That happens entirely in the browser through
// `@sparx/migration`, with no network call at all, so a file that cannot be read
// is rejected in the same second it is dropped rather than after an upload and a
// failed job. The API is only asked once the tenant has seen what will happen.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import {
  ENTITY_LABEL,
  readSource,
  type CanonicalEntity,
  type CanonicalRow,
  type ReadResult,
  type ValidationReport,
} from '@sparx/migration';
import type { WorkbenchModule } from '../../components/module-scope';
import { api } from '../../lib/api/client';

// ── Catalogue ────────────────────────────────────────────────────────────────

export interface VendorEntity {
  entity: CanonicalEntity;
  label: string;
  module: string | null;
  /** False when the module that owns this entity is switched off for this tenant. */
  available: boolean;
}

export interface VendorSourceSummary {
  id: string;
  entity: CanonicalEntity;
  yields: CanonicalEntity[];
  label: string;
  file: string;
  where: string;
  format: 'csv' | 'xml' | 'json';
}

export interface VendorCard {
  slug: string;
  name: string;
  kind: 'commerce' | 'site' | 'cms' | 'crm' | 'email';
  entities: VendorEntity[];
  brings: string[];
  sources: VendorSourceSummary[];
  hasConnector: boolean;
  modules: string[];
  /** Present for the three platforms with an API a tenant can authorise themselves. */
  connector: ConnectorInfo | null;
}

// ── Live connections ─────────────────────────────────────────────────────────

export interface ConnectorField {
  key: string;
  label: string;
  help: string;
  placeholder?: string;
  secret: boolean;
  required: boolean;
  /** A regex source string — checked here so a mistyped token is caught before we
   *  make the tenant wait for somebody else's 401. */
  pattern?: string;
  patternHint?: string;
}

export interface ConnectorResourceInfo {
  entity: CanonicalEntity;
  label: string;
  pageSize: number;
  requires?: string;
  note?: string;
}

export interface ConnectorInfo {
  slug: string;
  label: string;
  vendors: string[];
  instructions: string[];
  fields: ConnectorField[];
  resources: ConnectorResourceInfo[];
}

export interface ConnectedResource extends ConnectorResourceInfo {
  module: string | null;
  available: boolean;
}

export interface ConnectResult {
  vendor: string;
  account: { account: string; detail?: string };
  resources: ConnectedResource[];
  /** Reachable only with a credential the tenant has not given us — reported so
   *  "where are my products" has an answer on the screen rather than in support. */
  withheld: { entity: CanonicalEntity; label: string; needs: string }[];
}

export interface PullResult {
  entity: CanonicalEntity;
  rows: CanonicalRow[];
  nextCursor: string | null;
  fetched: number;
}

/**
 * Check the credentials, before the tenant is asked to decide anything.
 *
 * Kept as a mutation rather than a query because it is an action with a side effect
 * on somebody else's system (a login attempt), and because it must never be retried
 * or refetched on focus — a platform that rate-limits failed auth would lock the
 * tenant out of their own migration.
 */
export function useConnectLive() {
  return useMutation({
    mutationFn: (input: { vendor: string; credentials: Record<string, string> }) =>
      api.post<ConnectResult>('/v1/migration/connect', input),
  });
}

/** One page. A plain function rather than a hook, because the caller drives the loop
 *  and needs to stop it — page N+1 depends on what page N returned. */
export function pullPage(input: {
  vendor: string;
  entity: CanonicalEntity;
  cursor: string | null;
  credentials: Record<string, string>;
}): Promise<PullResult> {
  return api.post<PullResult>('/v1/migration/pull', input);
}

/**
 * Where a live pull stops.
 *
 * The row cap matches the API's own limit for one run, so a tenant discovers it here
 * — while their data is still on their old platform and nothing has been half-moved —
 * rather than at the point of import. The page cap is a runaway guard: a vendor that
 * kept handing back the same cursor would otherwise loop until the tab died.
 */
export const MAX_LIVE_ROWS = 200_000;
export const MAX_LIVE_PAGES = 2_000;

export function useMigrationVendors() {
  return useQuery({
    queryKey: ['migration', 'vendors'],
    queryFn: () => api.get<{ vendors: VendorCard[] }>('/v1/migration/vendors'),
    // The catalogue changes when a module is switched on, which happens in a
    // different pane — so it is refetched on focus rather than cached hard.
    staleTime: 30_000,
  });
}

export const KIND_LABEL: Record<VendorCard['kind'], string> = {
  commerce: 'Online stores',
  site: 'Website builders',
  cms: 'Publishing platforms',
  crm: 'CRMs',
  email: 'Email marketing',
};

/**
 * The module hue a vendor's card wears.
 *
 * Keyed on what the tenant is MOVING, not who they are moving from — a Shopify
 * card is commerce-orange because a catalogue is arriving, and a Mailchimp card is
 * email because a mailing list is. Colour here is wayfinding into the module the
 * data lands in, which is where they will go looking for it afterwards.
 */
export function vendorHue(kind: VendorCard['kind']): WorkbenchModule {
  switch (kind) {
    case 'commerce':
      return 'commerce';
    case 'site':
      return 'builder';
    case 'cms':
      return 'cms';
    case 'crm':
      return 'crm';
    case 'email':
      return 'email';
  }
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export interface RunSummary {
  runId: string;
  vendor: string | null;
  fileName: string | null;
  dryRun: boolean;
  startedAt: string;
  status: string;
  rowCount: number;
  importedCount: number;
  updatedCount: number;
  errorCount: number;
  entities: string[];
}

export interface RunEntityRollup {
  entity: CanonicalEntity;
  rowCount: number;
  imported: number;
  updated: number;
  errors: number;
  done: boolean;
}

export interface RunProblem {
  entity: string;
  rowIndex: number;
  status: string;
  naturalKey: string | null;
  message: string | null;
}

export interface RunDetail {
  run: {
    runId: string;
    vendor: string | null;
    dryRun: boolean;
    propertyId: string | null;
    fileName: string | null;
    startedAt: string | null;
    status: 'running' | 'completed' | 'failed';
    entities: RunEntityRollup[];
  };
  jobs: {
    id: string;
    entityType: string;
    status: string;
    rowCount: number;
    importedCount: number;
    updatedCount: number;
    errorCount: number;
    completedAt: string | null;
  }[];
  problems: RunProblem[];
}

export function useMigrationRuns() {
  return useQuery({
    queryKey: ['migration', 'runs'],
    queryFn: () => api.get<{ runs: RunSummary[] }>('/v1/migration/runs'),
  });
}

export function useMigrationRun(runId: string | null) {
  return useQuery({
    queryKey: ['migration', 'run', runId],
    queryFn: () => api.get<RunDetail>(`/v1/migration/runs/${runId!}`),
    enabled: runId !== null,
    // Poll only while something is still moving. A finished run polled forever is
    // a request every two seconds for as long as the pane stays open.
    refetchInterval: (query) => (query.state.data?.run.status === 'running' ? 2_000 : false),
  });
}

export interface StartRunInput {
  vendor?: string;
  fileName?: string;
  propertyId?: string | null;
  upsert?: boolean;
  dryRun?: boolean;
  entities: { entity: CanonicalEntity; rows: CanonicalRow[] }[];
}

export interface StartRunResult {
  runId: string;
  vendor: string | null;
  dryRun: boolean;
  jobs: { id: string; entityType: string }[];
  skipped: { entity: CanonicalEntity; module: string; rows: number }[];
  reports: Record<string, ValidationReport>;
}

export function useStartMigration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartRunInput) => api.post<StartRunResult>('/v1/migration/runs', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['migration', 'runs'] });
    },
  });
}

export function useCancelMigration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.post<{ runId: string; cancelled: number; note: string }>(
        `/v1/migration/runs/${runId}/cancel`
      ),
    onSuccess: (_result, runId) => {
      void queryClient.invalidateQueries({ queryKey: ['migration', 'run', runId] });
      void queryClient.invalidateQueries({ queryKey: ['migration', 'runs'] });
    },
  });
}

// ── Reading a dropped file ───────────────────────────────────────────────────

export interface LoadedFile {
  name: string;
  sizeBytes: number;
  result: ReadResult;
}

/**
 * Read a file the tenant dropped, entirely locally.
 *
 * `File.text()` is used rather than a FileReader because it is a promise and the
 * whole flow is async anyway. Files past a sane size are rejected here rather
 * than after a long freeze: a 200 MB WordPress export will lock the tab up while
 * it parses, and the tenant deserves to be told that instead of watching a
 * spinner that never ends.
 */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;

export async function loadFile(file: File): Promise<LoadedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `That file is ${Math.round(file.size / 1024 / 1024)} MB, and we can read up to ${MAX_FILE_BYTES / 1024 / 1024} MB in one go. Export it in smaller pieces, or ask us to move it for you.`
    );
  }
  const text = await file.text();
  return {
    name: file.name,
    sizeBytes: file.size,
    result: readSource({ text, fileName: file.name }),
  };
}

/** `products` → `Products`. Everywhere a person sees an entity. */
export function entityLabel(entity: CanonicalEntity, count?: number): string {
  const label = ENTITY_LABEL[entity];
  if (count === undefined) return label.many;
  return `${count.toLocaleString()} ${(count === 1 ? label.one : label.many).toLowerCase()}`;
}

/** Status → the semantic colour it should wear. State is its own colour axis. */
export function runTone(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'info';
  return 'warning';
}

// ── Taking the problems away with you ────────────────────────────────────────

/**
 * The skipped rows, as a CSV the tenant can open in the same spreadsheet the file
 * came from.
 *
 * Reading 300 problems in a scrolling panel is not how anyone fixes 300 problems.
 * They fix them in Excel, next to the data, which means the list has to leave this
 * screen — with the ROW NUMBER as it appears in their file (1-based, plus the header
 * row) so each line points at somewhere they can actually click.
 */
export function problemsCsv(problems: RunProblem[]): string {
  const escape = (value: string): string =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const header = ['Row in your file', 'What it was', 'Which record', 'What happened'];
  const lines = [header.join(',')];

  for (const problem of problems) {
    lines.push(
      [
        String(problem.rowIndex + 2),
        escape(ENTITY_LABEL[problem.entity as CanonicalEntity]?.one ?? problem.entity),
        escape(problem.naturalKey ?? ''),
        escape(problem.message ?? ''),
      ].join(',')
    );
  }

  // A trailing newline, and a BOM — without it Excel opens a UTF-8 CSV as Latin-1
  // and turns every accented product name into mojibake, which would be a poor
  // showing on a file whose whole job is to help someone fix their data.
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

/** Hand a generated file to the browser. No server round-trip — the data is already
 *  here, and asking the API to render a CSV it already sent us would be silly. */
export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next tick rather than immediately: Safari has not always
  // finished reading the blob by the time click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
