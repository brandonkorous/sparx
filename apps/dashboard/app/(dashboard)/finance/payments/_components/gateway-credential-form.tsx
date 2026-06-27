'use client';

// Credential form for an api-key gateway (docs/111 §3 Slice 7) — generated entirely
// from the catalog descriptor's `credentialFields`, so adding a gateway needs no new UI.
// Secret fields are write-only: blank on load (shown as "•••• on file" when stored),
// and re-entering REPLACES the value. Non-secret fields (public client key, location id,
// hosted URL) round-trip in the clear. Saving encrypts the secrets server-side.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

import {
  saveGatewayCredentials,
  type GatewayDescriptor,
  type MaskedGatewayCredential,
} from '../actions';

export function GatewayCredentialForm({
  descriptor,
  credential,
}: {
  descriptor: GatewayDescriptor;
  credential?: MaskedGatewayCredential;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [environment, setEnvironment] = React.useState<'sandbox' | 'production'>(
    credential?.environment ?? 'production'
  );
  const [fields, setFields] = React.useState<Record<string, string>>(() => {
    // Seed non-secret fields from the masked view; secrets always start blank.
    const seed: Record<string, string> = {};
    for (const f of descriptor.credentialFields) {
      if (!f.secret) seed[f.key] = credential?.publicMeta[f.key] ?? '';
    }
    return seed;
  });

  function set(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSavedAt(null);
  }

  // Required secrets are satisfied either by a fresh entry or by one already on file.
  const canSubmit = descriptor.credentialFields.every((f) => {
    if (f.optional) return true;
    if (f.secret) return (fields[f.key]?.trim().length ?? 0) > 0 || credential?.hasSecrets === true;
    return (fields[f.key]?.trim().length ?? 0) > 0;
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const res = await saveGatewayCredentials({ gatewayId: descriptor.id, environment, fields });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Clear secret inputs after a successful save; the masked status refreshes.
      setFields((prev) => {
        const next = { ...prev };
        for (const f of descriptor.credentialFields) if (f.secret) next[f.key] = '';
        return next;
      });
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={4}>
        <Stack direction="row" align="center" gap={3} wrap className="justify-between">
          <Text size="sm" variant="muted" className="max-w-prose">
            {descriptor.feeNote}
            {descriptor.checkout === 'redirect'
              ? ' Shoppers pay on the gateway’s hosted page, so card data never touches sparx.'
              : ''}
          </Text>
          {credential ? (
            <Badge color={statusTone(credential.status)} variant="soft" size="sm">
              {statusLabel(credential.status)}
            </Badge>
          ) : null}
        </Stack>

        {descriptor.environments ? (
          <Stack gap={2} className="max-w-xs">
            <Label htmlFor={`${descriptor.id}-env`}>Environment</Label>
            <Select
              value={environment}
              onValueChange={(v) => {
                setEnvironment(v as 'sandbox' | 'production');
                setSavedAt(null);
              }}
            >
              <SelectTrigger id={`${descriptor.id}-env`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
              </SelectContent>
            </Select>
          </Stack>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {descriptor.credentialFields.map((f) => {
            const onFile = f.secret && credential?.hasSecrets === true;
            return (
              <Stack key={f.key} gap={2}>
                <Label htmlFor={`${descriptor.id}-${f.key}`}>
                  {f.label}
                  {f.optional ? (
                    <span className="text-[var(--color-text-tertiary)]"> (optional)</span>
                  ) : null}
                </Label>
                <Input
                  id={`${descriptor.id}-${f.key}`}
                  type={f.secret ? 'password' : 'text'}
                  value={fields[f.key] ?? ''}
                  autoComplete="off"
                  placeholder={
                    onFile ? '•••• on file — re-enter to replace' : (f.placeholder ?? '')
                  }
                  onChange={(e) => set(f.key, e.target.value)}
                />
                {f.help ? (
                  <Text size="xs" variant="muted">
                    {f.help}
                  </Text>
                ) : null}
              </Stack>
            );
          })}
        </div>

        <Stack direction="row" align="center" justify="end" gap={3} wrap>
          {descriptor.docsUrl ? (
            <a
              href={descriptor.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mr-auto inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:underline"
            >
              Where do I find these? <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {error ? (
            <Text size="sm" variant="danger" role="alert" aria-live="polite">
              {error}
            </Text>
          ) : null}
          {savedAt !== null ? (
            <Stack
              direction="row"
              align="center"
              gap={1}
              className="text-[var(--color-success-text)]"
            >
              <Check className="h-4 w-4" />
              <Text size="sm" variant="success">
                Saved
              </Text>
            </Stack>
          ) : null}
          <Button type="submit" color="module" disabled={pending || !canSubmit} loading={pending}>
            {credential ? 'Update keys' : 'Connect'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
