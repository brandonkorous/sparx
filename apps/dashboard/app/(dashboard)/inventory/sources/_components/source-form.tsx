'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ModuleProvider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  SurfaceFrame,
  SurfaceStep,
  Text,
  Textarea,
  toast,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createSource, updateSource } from '../_lib/actions';
import {
  SourceApiFields,
  EMPTY_API_CONFIG,
  apiConfigFromSource,
  apiConfigToBody,
  type ApiConfigState,
} from './source-api-fields';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Inventory-source connect/edit on the standard form surface (docs/86 F layout).
// ONE component drives page / overlay / modal — see scheduling/service-form.tsx
// for the shape. Create rides the @detail overlay; editing (from the list row or
// the connection detail page) rides a self-owned modal.

interface Source {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  syncIntervalSec: number;
  notes: string | null;
}

type Presentation = 'page' | 'overlay' | 'modal';

interface SourceFormProps {
  presentation: Presentation;
  source?: Source;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPE_OPTIONS = [
  { value: 'csv', label: 'CSV Feed' },
  { value: 'api', label: 'API (generic HTTP)' },
  { value: 'agent', label: 'On-prem bridge agent (Tier A)' },
];

const INTERVAL_OPTIONS = [
  { value: '0', label: 'Manual only' },
  { value: '900', label: 'Every 15 minutes' },
  { value: '1800', label: 'Every 30 minutes' },
  { value: '3600', label: 'Every hour' },
  { value: '21600', label: 'Every 6 hours' },
  { value: '86400', label: 'Once a day' },
];

const STEPS: SurfaceStepDef[] = [{ key: 'connection', label: 'Connection' }];

export function SourceForm({ presentation, source, open, onOpenChange }: SourceFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [name, setName] = useState(source?.name ?? '');
  const [type, setType] = useState(source?.type ?? 'csv');
  const [csvUrl, setCsvUrl] = useState(
    typeof source?.config?.csvUrl === 'string' ? source.config.csvUrl : ''
  );
  const [apiConfig, setApiConfig] = useState<ApiConfigState>(
    source?.type === 'api' ? apiConfigFromSource(source.config) : EMPTY_API_CONFIG
  );
  const hasApiKey = source?.config?.hasApiKey === true;
  const [interval, setInterval] = useState(String(source?.syncIntervalSec ?? 0));
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = () => JSON.stringify({ name, type, csvUrl, apiConfig, interval, notes });
  const [initial] = useState(snapshot);
  const dirty = snapshot() !== initial;

  const guardLeave = useUnsavedGuard(
    dirty,
    source ? { kind: 'edit', noun: 'source' } : { kind: 'create', noun: 'source' }
  );

  const close = useCallback(() => {
    if (presentation === 'modal') {
      onOpenChange?.(false);
      return;
    }
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
      return;
    }
    router.push('/inventory/sources');
  }, [presentation, onOpenChange, pathname, searchParams, router]);

  const cancel = useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function onRequestClose(): boolean {
    if (saving) return false;
    if (!dirty) return true;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
    return false;
  }
  function onCancelClick() {
    if (saving) return;
    void Promise.resolve(guardLeave()).then((ok) => ok && close());
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (type === 'csv' && !csvUrl.trim()) {
      setError('CSV feed URL is required.');
      return;
    }
    if (type === 'api') {
      if (!apiConfig.endpoint.trim()) {
        setError('API endpoint is required.');
        return;
      }
      if (!apiConfig.skuField.trim() || !apiConfig.quantityField.trim()) {
        setError('SKU field and Quantity field are required.');
        return;
      }
    }

    setSaving(true);
    const config: Record<string, unknown> =
      type === 'csv' ? { csvUrl: csvUrl.trim() } : type === 'api' ? apiConfigToBody(apiConfig) : {}; // agent: no pull config — it pushes; pair it after creating

    const body = {
      name: name.trim(),
      ...(source ? {} : { type }),
      config,
      syncIntervalSec: parseInt(interval, 10),
      notes: notes.trim() || null,
    };

    const { error: err } = source ? await updateSource(source.id, body) : await createSource(body);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(source ? 'Source updated' : 'Source connected');
    close();
    router.refresh();
  }

  const heading = source ? 'Edit source' : 'Connect inventory source';

  const body = (
    <SurfaceStep
      header={{
        title: heading,
        supporting: 'Configure a CSV feed, API connection, or on-prem bridge for stock-level sync.',
      }}
      actions={{
        onNext: () => void submit(),
        nextLabel: source ? 'Save changes' : 'Connect source',
        nextLoading: saving,
        nextDisabled: saving,
      }}
    >
      <Card variant="default">
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <Stack gap={5}>
            <div>
              <Label htmlFor="src-name">
                Name <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="src-name"
                placeholder="e.g. Main Warehouse CSV"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {!source && (
              <Stack gap={1}>
                <Label>Source type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>
            )}

            {type === 'csv' && (
              <div>
                <Label htmlFor="src-csv">
                  CSV feed URL <span className="text-[var(--color-danger)]">*</span>
                </Label>
                <Input
                  id="src-csv"
                  type="url"
                  placeholder="https://your-wms.example.com/inventory.csv"
                  value={csvUrl}
                  onChange={(e) => setCsvUrl(e.target.value)}
                />
                <Text size="xs" variant="muted" className="mt-1">
                  Required columns: <span className="font-mono">sku</span>,{' '}
                  <span className="font-mono">quantity</span>. Optional:{' '}
                  <span className="font-mono">location</span>.
                </Text>
              </div>
            )}

            {type === 'api' && (
              <SourceApiFields value={apiConfig} onChange={setApiConfig} hasApiKey={hasApiKey} />
            )}

            {type === 'agent' && (
              <Stack
                gap={2}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-3"
              >
                <Text size="sm" weight="medium">
                  On-prem bridge agent
                </Text>
                <Text size="xs" variant="muted">
                  For an ERP whose API only lives on your local network (e.g. Fishbowl). After
                  creating this source, open it and choose{' '}
                  <span className="font-medium">Pair agent</span> to mint a key, then install the
                  sparx Inventory Bridge on a machine on your network.
                </Text>
              </Stack>
            )}

            <Stack gap={1}>
              <Label>Sync interval</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Stack>

            <div>
              <Label htmlFor="src-notes">Internal notes</Label>
              <Textarea
                id="src-notes"
                placeholder="Optional notes about this source"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}
          </Stack>
        </CardContent>
      </Card>
    </SurfaceStep>
  );

  if (presentation === 'modal') {
    return (
      <ModuleProvider module="inventory">
        <SurfaceFrame
          variant="modal"
          title={heading}
          steps={STEPS}
          current={0}
          open={open}
          onOpenChange={(next) => {
            if (!next) close();
          }}
          onRequestClose={onRequestClose}
          footer={
            <Button variant="ghost" color="neutral" size="sm" onClick={onCancelClick}>
              Cancel
            </Button>
          }
        >
          {body}
        </SurfaceFrame>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="inventory" className="h-full">
      <SurfaceFrame
        variant={presentation === 'overlay' ? 'inline' : 'embedded'}
        title={heading}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        {body}
      </SurfaceFrame>
    </ModuleProvider>
  );
}
