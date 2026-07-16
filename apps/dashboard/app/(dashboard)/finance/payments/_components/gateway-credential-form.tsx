'use client';

// Credential form for an api-key gateway (docs/111 §3 Slice 7) — generated entirely
// from the catalog descriptor's `credentialFields`, so adding a gateway needs no new UI.
// Secret fields are write-only: blank on load (shown as "•••• on file" when stored),
// and re-entering REPLACES the value. Non-secret fields (public client key, location id,
// hosted URL) round-trip in the clear. Saving encrypts the secrets server-side. Rendered
// inside the gateway drawer; `onSaved` lets the parent activate the gateway + close.

import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  PasswordInput,
  Select,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation, type FieldRules } from '@sparx/forms';

import {
  saveGatewayCredentials,
  type GatewayDescriptor,
  type MaskedGatewayCredential,
} from '../actions';

export function GatewayCredentialForm({
  descriptor,
  credential,
  onSaved,
}: {
  descriptor: GatewayDescriptor;
  credential?: MaskedGatewayCredential;
  /** Called after a successful save so the parent can activate + close the drawer. */
  onSaved?: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
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
  }

  // Required secrets are satisfied either by a fresh entry or by one already on file.
  const canSubmit = descriptor.credentialFields.every((f) => {
    if (f.optional) return true;
    if (f.secret) return (fields[f.key]?.trim().length ?? 0) > 0 || credential?.hasSecrets === true;
    return (fields[f.key]?.trim().length ?? 0) > 0;
  });

  // A required field needs a value — except a secret already on file, which stays
  // valid blank (re-entering it REPLACES the stored secret).
  const fieldRules = React.useMemo<FieldRules<Record<string, string>>>(() => {
    const r: FieldRules<Record<string, string>> = {};
    for (const f of descriptor.credentialFields) {
      if (f.optional) continue;
      if (f.secret && credential?.hasSecrets === true) continue;
      r[f.key] = rule.required(`${f.label} is required.`);
    }
    return r;
  }, [descriptor, credential]);
  const v = useFieldValidation(fields, fieldRules);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;
    setError(null);
    startTransition(async () => {
      const res = await saveGatewayCredentials({ gatewayId: descriptor.id, environment, fields });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved?.();
    });
  }

  return (
    <form id={`gateway-form-${descriptor.id}`} onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-5">
        {descriptor.environments ? (
          <Field>
            <FieldLabel>Environment</FieldLabel>
            <Select
              value={environment}
              onValueChange={(val) => setEnvironment(val as 'sandbox' | 'production')}
              items={{ production: 'Production', sandbox: 'Sandbox (testing)' }}
            />
          </Field>
        ) : null}

        {descriptor.credentialFields.map((f) => {
          const onFile = f.secret && credential?.hasSecrets === true;
          return (
            <Field key={f.key} {...v.field(f.key)}>
              <FieldLabel required={!f.optional}>
                {f.label}
                {f.optional ? <span className="text-base-content"> (optional)</span> : null}
              </FieldLabel>
              <FieldControl
                name={`${descriptor.id}-${f.key}`}
                value={fields[f.key] ?? ''}
                autoComplete="off"
                placeholder={onFile ? '•••• on file — re-enter to replace' : (f.placeholder ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
                {...v.control(f.key)}
                {...(f.secret ? { render: <PasswordInput /> } : { type: 'text' })}
              />
              {f.help ? <FieldDescription>{f.help}</FieldDescription> : null}
            </Field>
          );
        })}

        {descriptor.docsUrl ? (
          <a
            href={descriptor.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-base-content inline-flex items-center gap-1 text-sm hover:underline"
          >
            Where do I find these? <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}

        {error ? (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        ) : null}

        <Button
          type="submit"
          color="module"
          className="w-full"
          disabled={pending || !canSubmit}
          loading={pending}
        >
          {credential ? 'Save changes' : 'Connect & use'}
        </Button>
      </div>
    </form>
  );
}
