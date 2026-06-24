'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import type { ProviderEnvironment, ProviderKind } from '@sparx/commerce-schemas';
import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { formString } from '../../../../../../lib/forms';
import { installProviderAction } from '../../../provider-actions';

// Install-provider create surface, on the standard create shell (docs/86 F layout).
// FULL-PAGE ONLY (variant="embedded") and intentionally NOT in the drawer/modal
// overlay create system: it's a catalog deep link needing `?slug=&kind=`, building
// fields from the provider's JSON config schema — a generic "New" drawer has no
// provider context. Unlike the controlled single-step forms (categories), it reads
// its DYNAMIC `config:<key>` fields via FormData on native submit; the frame's floor
// toolbar sits OUTSIDE the <form>, so its primary action calls
// `formRef.current?.requestSubmit()` — native submit + HTML validation, no re-skinned
// bottom Button row.

interface JsonSchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  pattern?: string;
  maxLength?: number;
}

interface JsonSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

const STEPS: SurfaceStepDef[] = [{ key: 'configure', label: 'Configure' }];

export function InstallProviderForm({
  providerSlug,
  kind,
  displayName,
  configSchemaJson,
  sandboxAvailable,
  webhookPathTemplate,
}: {
  providerSlug: string;
  kind: ProviderKind;
  displayName: string;
  configSchemaJson: string;
  sandboxAvailable: boolean;
  webhookPathTemplate: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const schema = React.useMemo<JsonSchema>(() => {
    try {
      return JSON.parse(configSchemaJson) as JsonSchema;
    } catch {
      return {};
    }
  }, [configSchemaJson]);

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const propertyKeys = Object.keys(properties);

  const cancel = React.useCallback(() => {
    router.push('/commerce/providers');
  }, [router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const environment = formString(form, 'environment', 'production') as ProviderEnvironment;
    const label = formString(form, 'label').trim();

    const config: Record<string, unknown> = {};
    for (const key of propertyKeys) {
      const raw = form.get(`config:${key}`);
      const propType = properties[key]?.type;
      if (propType === 'boolean') {
        config[key] = raw === 'on';
      } else if (typeof raw !== 'string') {
        continue;
      } else {
        const str = raw.trim();
        if (str.length === 0) continue;
        config[key] = str;
      }
    }

    startTransition(async () => {
      const result = await installProviderAction({
        providerSlug,
        kind,
        environment,
        config,
        ...(label ? { label } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/commerce/providers/${result.data.installationId}`);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant="embedded"
        title={`Install ${displayName}`}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Configuration',
            supporting:
              'Secret values (API keys, signing secrets) should reference Google Secret Manager paths — never paste the literal secret here.',
          }}
          actions={{
            onNext: () => formRef.current?.requestSubmit(),
            nextLabel: 'Install provider',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <form ref={formRef} onSubmit={onSubmit}>
            <Stack gap={4}>
              <Card variant="module">
                <CardContent className="py-6">
                  <Stack gap={4}>
                    <Text size="sm" className="font-medium">
                      Install
                    </Text>
                    <Stack direction="row" gap={3} wrap>
                      <Stack gap={2} className="min-w-[12rem] flex-1">
                        <Label htmlFor="environment">Environment *</Label>
                        <NativeSelect
                          id="environment"
                          name="environment"
                          defaultValue={sandboxAvailable ? 'sandbox' : 'production'}
                        >
                          {sandboxAvailable && <option value="sandbox">sandbox</option>}
                          <option value="production">production</option>
                        </NativeSelect>
                      </Stack>
                      <Stack gap={2} className="min-w-[14rem] flex-1">
                        <Label htmlFor="label">Label</Label>
                        <Input
                          id="label"
                          name="label"
                          placeholder={`${displayName} — primary`}
                          maxLength={127}
                        />
                        <Text size="xs" variant="muted">
                          Distinguishes multiple installs of the same provider (e.g. US vs EU
                          entity).
                        </Text>
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="module">
                <CardContent className="py-6">
                  <Stack gap={3}>
                    <Text size="sm" className="font-medium">
                      Provider configuration
                    </Text>
                    {propertyKeys.length === 0 ? (
                      <Text size="sm" variant="muted">
                        No configuration fields declared.
                      </Text>
                    ) : (
                      propertyKeys.map((key) => (
                        <ConfigField
                          key={key}
                          fieldKey={key}
                          prop={properties[key]!}
                          required={required.has(key)}
                        />
                      ))
                    )}
                    <Stack gap={1} className="rounded bg-[var(--color-bg-subtle)] p-3">
                      <Text size="xs" className="font-medium">
                        Webhook path
                      </Text>
                      <Text size="xs" className="font-mono text-[var(--color-text-muted)]">
                        {webhookPathTemplate}
                      </Text>
                      <Text size="xs" variant="muted">
                        After install, paste this URL into the provider&apos;s webhook configuration
                        so callbacks land at the right tenant.
                      </Text>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
            </Stack>
          </form>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function ConfigField({
  fieldKey,
  prop,
  required,
}: {
  fieldKey: string;
  prop: JsonSchemaProperty;
  required: boolean;
}) {
  const id = `config:${fieldKey}`;
  return (
    <Stack gap={1}>
      <Label htmlFor={id}>
        {prop.title ?? fieldKey}
        {required && <span className="text-[var(--color-danger)]"> *</span>}
      </Label>
      {prop.type === 'boolean' ? (
        <label className="flex items-center gap-2">
          <input id={id} name={id} type="checkbox" defaultChecked={prop.default === true} />
          <Text size="sm" variant="muted">
            {prop.description ?? 'Enable'}
          </Text>
        </label>
      ) : prop.description && prop.description.length > 80 ? (
        <Textarea
          id={id}
          name={id}
          rows={2}
          required={required}
          defaultValue={typeof prop.default === 'string' ? prop.default : undefined}
          className="font-mono text-xs"
        />
      ) : (
        <Input
          id={id}
          name={id}
          required={required}
          pattern={prop.pattern}
          maxLength={prop.maxLength}
          defaultValue={
            typeof prop.default === 'string' || typeof prop.default === 'number'
              ? String(prop.default)
              : undefined
          }
        />
      )}
      {prop.type !== 'boolean' && prop.description && (
        <Text size="xs" variant="muted">
          {prop.description}
        </Text>
      )}
    </Stack>
  );
}
