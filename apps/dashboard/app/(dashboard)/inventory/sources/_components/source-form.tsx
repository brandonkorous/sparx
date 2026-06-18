'use client';

import { useState } from 'react';
import {
  Button,
  Stack,
  Text,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { createSource, updateSource } from '../_lib/actions';
import {
  SourceApiFields,
  EMPTY_API_CONFIG,
  apiConfigFromSource,
  apiConfigToBody,
  type ApiConfigState,
} from './source-api-fields';

interface Source {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  syncIntervalSec: number;
  notes: string | null;
}

interface Props {
  source?: Source;
  onSuccess: () => void;
  onCancel: () => void;
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

export function SourceForm({ source, onSuccess, onCancel }: Props) {
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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

    setSubmitting(true);
    setError(null);
    try {
      const config: Record<string, unknown> =
        type === 'csv'
          ? { csvUrl: csvUrl.trim() }
          : type === 'api'
            ? apiConfigToBody(apiConfig)
            : {}; // agent: no pull config — it pushes; pair it after creating

      const body = {
        name: name.trim(),
        ...(source ? {} : { type }),
        config,
        syncIntervalSec: parseInt(interval, 10),
        notes: notes.trim() || null,
      };

      if (source) {
        const { error: err } = await updateSource(source.id, body);
        if (err) throw new Error(err);
      } else {
        const { error: err } = await createSource(body);
        if (err) throw new Error(err);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Name <span className="text-[var(--color-danger)]">*</span>
          </Text>
          <Input
            placeholder="e.g. Main Warehouse CSV"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Stack>

        {!source && (
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              Source type
            </Text>
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
          <Stack gap={2}>
            <Text size="sm" className="font-medium">
              CSV feed URL <span className="text-[var(--color-danger)]">*</span>
            </Text>
            <Input
              type="url"
              placeholder="https://your-wms.example.com/inventory.csv"
              value={csvUrl}
              onChange={(e) => setCsvUrl(e.target.value)}
            />
            <Text size="xs" className="text-[var(--color-muted-foreground)]">
              Required columns: <span className="font-mono">sku</span>,{' '}
              <span className="font-mono">quantity</span>. Optional:{' '}
              <span className="font-mono">location</span>.
            </Text>
          </Stack>
        )}

        {type === 'api' && (
          <SourceApiFields value={apiConfig} onChange={setApiConfig} hasApiKey={hasApiKey} />
        )}

        {type === 'agent' && (
          <Stack
            gap={2}
            className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] px-3 py-3"
          >
            <Text size="sm" className="font-medium">
              On-prem bridge agent
            </Text>
            <Text size="xs" className="text-[var(--color-muted-foreground)]">
              For an ERP whose API only lives on your local network (e.g. Fishbowl). After creating
              this source, open it and choose <span className="font-medium">Pair agent</span> to
              mint a key, then install the sparx Inventory Bridge on a machine on your network.
            </Text>
          </Stack>
        )}

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Sync interval
          </Text>
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

        <Stack gap={2}>
          <Text size="sm" className="font-medium">
            Internal notes
          </Text>
          <Textarea
            placeholder="Optional notes about this source"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Stack>

        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}

        <Stack direction="row" gap={2} className="justify-end">
          <Button type="button" color="neutral" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={submitting}>
            {submitting ? 'Saving…' : source ? 'Save changes' : 'Connect source'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
