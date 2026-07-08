'use client';

import * as React from 'react';
import { Input, Select } from 'silicaui-react';

// The declarative config for a `type: 'api'` (Tier B) inventory source — endpoint,
// auth, the dot-paths that map a JSON response onto stock rows, and pagination. The
// worker's generic adapter (docs/100 P5c) reads exactly these keys, so one form
// serves NetSuite, Cin7, a 3PL portal, etc. State is all-strings; `apiConfigToBody`
// converts to the API shape (the secret is omitted when left blank so an edit keeps
// the stored key).

export interface ApiConfigState {
  endpoint: string;
  authScheme: 'none' | 'bearer' | 'header';
  apiKey: string;
  headerName: string;
  itemsPath: string;
  skuField: string;
  quantityField: string;
  locationField: string;
  costField: string;
  costUnit: 'cents' | 'dollars';
  syncedAtField: string;
  paginationMode: 'none' | 'page' | 'cursor';
  pageParam: string;
  cursorPath: string;
  maxPages: string;
}

export const EMPTY_API_CONFIG: ApiConfigState = {
  endpoint: '',
  authScheme: 'none',
  apiKey: '',
  headerName: '',
  itemsPath: '',
  skuField: 'sku',
  quantityField: 'quantity',
  locationField: '',
  costField: '',
  costUnit: 'cents',
  syncedAtField: '',
  paginationMode: 'none',
  pageParam: '',
  cursorPath: '',
  maxPages: '1',
};

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/** Seed the form from a (redacted) source config — apiKey never arrives, so it
 *  stays blank and the field shows a "leave blank to keep" hint via `hasApiKey`. */
export function apiConfigFromSource(config: Record<string, unknown>): ApiConfigState {
  const scheme = str(config.authScheme);
  const paginationMode = config.cursorPath ? 'cursor' : config.pageParam ? 'page' : 'none';
  return {
    ...EMPTY_API_CONFIG,
    endpoint: str(config.endpoint),
    authScheme: scheme === 'bearer' || scheme === 'header' ? scheme : 'none',
    headerName: str(config.headerName),
    itemsPath: str(config.itemsPath),
    skuField: str(config.skuField) || 'sku',
    quantityField: str(config.quantityField) || 'quantity',
    locationField: str(config.locationField),
    costField: str(config.costField),
    costUnit: str(config.costUnit) === 'dollars' ? 'dollars' : 'cents',
    syncedAtField: str(config.syncedAtField),
    paginationMode,
    pageParam: str(config.pageParam),
    cursorPath: str(config.cursorPath),
    maxPages: str(config.maxPages) || '1',
  };
}

/** Convert form state to the API config body (omits the secret when blank). */
export function apiConfigToBody(s: ApiConfigState): Record<string, unknown> {
  return {
    endpoint: s.endpoint.trim(),
    authScheme: s.authScheme,
    ...(s.apiKey ? { apiKey: s.apiKey } : {}),
    ...(s.authScheme === 'header' && s.headerName ? { headerName: s.headerName.trim() } : {}),
    itemsPath: s.itemsPath.trim(),
    skuField: s.skuField.trim(),
    quantityField: s.quantityField.trim(),
    ...(s.locationField ? { locationField: s.locationField.trim() } : {}),
    ...(s.costField ? { costField: s.costField.trim(), costUnit: s.costUnit } : {}),
    ...(s.syncedAtField ? { syncedAtField: s.syncedAtField.trim() } : {}),
    ...(s.paginationMode === 'page' && s.pageParam ? { pageParam: s.pageParam.trim() } : {}),
    ...(s.paginationMode === 'cursor' && s.cursorPath ? { cursorPath: s.cursorPath.trim() } : {}),
    maxPages: Math.max(1, Number.parseInt(s.maxPages, 10) || 1),
  };
}

interface Props {
  value: ApiConfigState;
  onChange: (next: ApiConfigState) => void;
  hasApiKey: boolean;
}

export function SourceApiFields({ value, onChange, hasApiKey }: Props) {
  const set = <K extends keyof ApiConfigState>(key: K, v: ApiConfigState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-5">
      <Field label="API endpoint" required hint="The URL the worker fetches stock from.">
        <Input
          type="url"
          placeholder="https://api.example.com/v1/inventory"
          value={value.endpoint}
          onChange={(e) => set('endpoint', e.target.value)}
        />
      </Field>

      <Field label="Authentication">
        <Select
          value={value.authScheme}
          onValueChange={(v) => set('authScheme', v as never)}
          items={{ none: 'None', bearer: 'Bearer token', header: 'Custom header' }}
        />
      </Field>

      {value.authScheme !== 'none' && (
        <div className="flex flex-row flex-wrap gap-3">
          {value.authScheme === 'header' && (
            <Field label="Header name" className="min-w-[12rem] flex-1">
              <Input
                placeholder="X-API-Key"
                value={value.headerName}
                onChange={(e) => set('headerName', e.target.value)}
              />
            </Field>
          )}
          <Field
            label="API key / token"
            className="min-w-[16rem] flex-1"
            hint={hasApiKey ? 'A key is stored — leave blank to keep it.' : undefined}
          >
            <Input
              type="password"
              autoComplete="off"
              placeholder={hasApiKey ? '•••••••• (unchanged)' : 'Paste the secret'}
              value={value.apiKey}
              onChange={(e) => set('apiKey', e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Response mapping</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Dot-paths into the JSON response. Leave “Items path” blank if the response{' '}
          <span className="font-mono">is</span> the array of rows.
        </p>
      </div>
      <div className="flex flex-row flex-wrap gap-3">
        <Field label="Items path" className="min-w-[12rem] flex-1">
          <Input
            placeholder="data.items"
            value={value.itemsPath}
            onChange={(e) => set('itemsPath', e.target.value)}
          />
        </Field>
        <Field label="SKU field" required className="min-w-[10rem] flex-1">
          <Input
            placeholder="sku"
            value={value.skuField}
            onChange={(e) => set('skuField', e.target.value)}
          />
        </Field>
        <Field label="Quantity field" required className="min-w-[10rem] flex-1">
          <Input
            placeholder="available"
            value={value.quantityField}
            onChange={(e) => set('quantityField', e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-row flex-wrap gap-3">
        <Field label="Location field" className="min-w-[10rem] flex-1">
          <Input
            placeholder="warehouse"
            value={value.locationField}
            onChange={(e) => set('locationField', e.target.value)}
          />
        </Field>
        <Field label="Cost field" className="min-w-[10rem] flex-1">
          <Input
            placeholder="unitCost"
            value={value.costField}
            onChange={(e) => set('costField', e.target.value)}
          />
        </Field>
        <Field label="Cost unit" className="min-w-[8rem]">
          <Select
            value={value.costUnit}
            onValueChange={(v) => set('costUnit', v as never)}
            items={{ cents: 'Cents', dollars: 'Dollars' }}
          />
        </Field>
        <Field
          label="Updated-at field"
          className="min-w-[10rem] flex-1"
          hint="Source timestamp → last-writer ordering."
        >
          <Input
            placeholder="updatedAt"
            value={value.syncedAtField}
            onChange={(e) => set('syncedAtField', e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-row flex-wrap items-start gap-3">
        <Field label="Pagination" className="min-w-[10rem]">
          <Select
            value={value.paginationMode}
            onValueChange={(v) => set('paginationMode', v as never)}
            items={{ none: 'Single page', page: 'Page number', cursor: 'Cursor' }}
          />
        </Field>
        {value.paginationMode === 'page' && (
          <Field label="Page param" className="min-w-[10rem] flex-1">
            <Input
              placeholder="page"
              value={value.pageParam}
              onChange={(e) => set('pageParam', e.target.value)}
            />
          </Field>
        )}
        {value.paginationMode === 'cursor' && (
          <Field label="Cursor path" className="min-w-[10rem] flex-1">
            <Input
              placeholder="meta.next"
              value={value.cursorPath}
              onChange={(e) => set('cursorPath', e.target.value)}
            />
          </Field>
        )}
        {value.paginationMode !== 'none' && (
          <Field label="Max pages" className="min-w-[8rem]">
            <Input
              type="number"
              min={1}
              max={100}
              value={value.maxPages}
              onChange={(e) => set('maxPages', e.target.value)}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-2${className ? ` ${className}` : ''}`}>
      <p className="text-sm font-medium">
        {label} {required ? <span className="text-[var(--color-danger)]">*</span> : null}
      </p>
      {children}
      {hint ? <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p> : null}
    </div>
  );
}
