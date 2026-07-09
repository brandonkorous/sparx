'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import type { ProviderEnvironment, ProviderKind } from '@sparx/commerce-schemas';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';

import { formString } from '../../../../../../lib/forms';
import { installProviderAction } from '../../../provider-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

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

// Stable serialization of a native form's current values, for the unsaved-changes
// compare (docs/105). Sorted so field order can't make an unchanged form look dirty;
// unchecked checkboxes drop out of FormData, so toggling one changes the string.
function serializeForm(form: HTMLFormElement): string {
  return Array.from(new FormData(form).entries())
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : ''}`)
    .sort()
    .join('&');
}

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

  // Unsaved-changes guard (docs/105). The fields are an uncontrolled native form
  // (read via FormData on submit) that starts pre-filled with provider defaults, so
  // dirtiness is a compare against the initial serialized form (captured once on
  // mount) rather than "any field non-empty" — leaving with only the defaults must
  // not prompt. Recomputed on every input; the success path navigates directly (not
  // via `cancel`), so a completed install never self-prompts.
  const initialFormRef = React.useRef<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form || initialFormRef.current === null) return;
    setDirty(serializeForm(form) !== initialFormRef.current);
  }, []);
  React.useEffect(() => {
    const form = formRef.current;
    if (form && initialFormRef.current === null) initialFormRef.current = serializeForm(form);
  }, []);
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'provider installation' });

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) router.push('/commerce/providers');
  }, [guardLeave, router]);

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
          <form
            ref={formRef}
            onSubmit={onSubmit}
            onInput={recomputeDirty}
            onChange={recomputeDirty}
          >
            <div className="flex flex-col gap-4">
              <Card>
                <CardBody className="py-6">
                  <div className="flex flex-col gap-4">
                    <p className="text-sm font-medium">Install</p>
                    <div className="flex flex-row flex-wrap gap-3">
                      <Field className="min-w-[12rem] flex-1">
                        <FieldLabel required>Environment</FieldLabel>
                        <NativeSelect
                          id="environment"
                          name="environment"
                          defaultValue={sandboxAvailable ? 'sandbox' : 'production'}
                        >
                          {sandboxAvailable && <option value="sandbox">sandbox</option>}
                          <option value="production">production</option>
                        </NativeSelect>
                      </Field>
                      <Field className="min-w-[14rem] flex-1">
                        <FieldLabel>Label</FieldLabel>
                        <FieldControl
                          name="label"
                          placeholder={`${displayName} — primary`}
                          maxLength={127}
                        />
                        <FieldDescription>
                          Distinguishes multiple installs of the same provider (e.g. US vs EU
                          entity).
                        </FieldDescription>
                      </Field>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="py-6">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium">Provider configuration</p>
                    {propertyKeys.length === 0 ? (
                      <p className="text-base-content/70 text-sm">
                        No configuration fields declared.
                      </p>
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
                    <div className="bg-base-200 flex flex-col gap-1 rounded p-3">
                      <p className="text-xs font-medium">Webhook path</p>
                      <p className="text-base-content/60 font-mono text-xs">
                        {webhookPathTemplate}
                      </p>
                      <p className="text-base-content/70 text-xs">
                        After install, paste this URL into the provider&apos;s webhook configuration
                        so callbacks land at the right tenant.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}
            </div>
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
  const label = prop.title ?? fieldKey;

  if (prop.type === 'boolean') {
    return (
      <Field>
        <FieldLabel required={required}>{label}</FieldLabel>
        <label className="flex items-center gap-2">
          <Checkbox color="module" name={id} defaultChecked={prop.default === true} />
          <p className="text-base-content/70 text-sm">{prop.description ?? 'Enable'}</p>
        </label>
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel required={required}>{label}</FieldLabel>
      {prop.description && prop.description.length > 80 ? (
        <FieldControl
          render={<Textarea rows={2} className="font-mono text-xs" />}
          name={id}
          required={required}
          defaultValue={typeof prop.default === 'string' ? prop.default : undefined}
        />
      ) : (
        <FieldControl
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
      {prop.description && <FieldDescription>{prop.description}</FieldDescription>}
    </Field>
  );
}
