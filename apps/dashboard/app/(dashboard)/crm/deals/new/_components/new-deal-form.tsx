'use client';

// New-deal form, on the standard create surface (docs/86 F layout, WS2). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form (a one-step wizard): the frame supplies the title + window
// controls + the pinned floor toolbar (ghost Cancel + module primary) and hides
// MiniProgress; fields sit in a module-tinted Card. The stage select depends on
// the chosen pipeline. The server action does the real validation — we surface its
// field errors back into the form. On success the overlay swaps the token to the
// new deal's detail view (create flows into view); the page pushes to the record.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createDealAction } from '../../../deal-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { CREATE_SENTINEL } from '../../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../../_components/detail-panel';

// Optional non-negative number: blank is allowed (defaults to 0), otherwise must
// be a finite number ≥ 0. `@sparx/forms` has no numeric-range builder yet.
const optionalNonNegative =
  (message: string) =>
  (value: unknown): string | null => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? null : message;
  };

// Optional number constrained to a [min, max] range; blank is allowed.
const optionalRange =
  (min: number, max: number, message: string) =>
  (value: unknown): string | null => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= min && n <= max ? null : message;
  };

interface StageOpt {
  id: string;
  name: string;
  probability: number;
  stageType: string;
}
interface PipelineOpt {
  id: string;
  name: string;
  stages: StageOpt[];
}
interface CustomerOpt {
  id: string;
  label: string;
}

interface NewDealFormProps {
  surface: 'page' | 'overlay';
  pipelines: PipelineOpt[];
  customers: CustomerOpt[];
  initialPipelineId: string | null;
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

function firstOpenStageId(pipeline: PipelineOpt | null): string {
  return (
    pipeline?.stages.find((s) => s.stageType !== 'lost' && s.stageType !== 'won')?.id ??
    pipeline?.stages[0]?.id ??
    ''
  );
}

export function NewDealForm({
  surface,
  pipelines,
  customers,
  initialPipelineId,
}: NewDealFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const startPipelineId = initialPipelineId ?? pipelines[0]?.id ?? '';
  const [pipelineId, setPipelineId] = React.useState(startPipelineId);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? null;
  const [stageId, setStageId] = React.useState(() => firstOpenStageId(pipeline));

  const [title, setTitle] = React.useState('');
  const [customerId, setCustomerId] = React.useState('');
  const [value, setValue] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [probability, setProbability] = React.useState('');
  const [expectedCloseDate, setExpectedCloseDate] = React.useState('');
  const [source, setSource] = React.useState('');
  const [tags, setTags] = React.useState('');

  const values = { title, value, probability, stageId, expectedCloseDate };
  const v = useFieldValidation(values, {
    title: rule.required('Title is required.'),
    value: optionalNonNegative('Enter a value of 0 or more.'),
    probability: optionalRange(0, 100, 'Enter a probability between 0 and 100.'),
  });

  function onPipelineChange(id: string) {
    setPipelineId(id);
    setStageId(firstOpenStageId(pipelines.find((p) => p.id === id) ?? null));
  }

  // Unsaved-changes guard. A create form starts blank, so "dirty" is "the user
  // entered anything" (the pipeline/stage default to the first, so they don't
  // count). Guards a Cancel / Close / backdrop so typed work isn't dropped.
  const dirty =
    title.trim() !== '' ||
    customerId !== '' ||
    (value.trim() !== '' && Number(value) !== 0) ||
    (probability.trim() !== '' && Number(probability) !== 0) ||
    expectedCloseDate.trim() !== '' ||
    source.trim() !== '' ||
    tags.trim() !== '';
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'deal' });

  // Leave WITHOUT the guard (the success path + the guarded Cancel both route here).
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/deals');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new deal's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `deal:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/crm/deals/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    const input = {
      pipelineId,
      stageId,
      customerId: customerId || undefined,
      title: title.trim(),
      value: numOrZero(value),
      probability: numOrZero(probability),
      currency: (currency.trim() || 'USD').toUpperCase(),
      expectedCloseDate: expectedCloseDate.trim() || undefined,
      source: source.trim() || undefined,
      tags: tags.trim()
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
    };
    startTransition(async () => {
      const result = await createDealAction(input);
      if (result.ok) {
        onCreated(result.data.id);
        return;
      }
      if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
        const fe: Partial<Record<keyof typeof values, string>> = {};
        for (const d of result.error.details) {
          fe[d.field as keyof typeof values] = d.message;
        }
        v.setServerErrors(fe);
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="crm" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New deal"
        backLabel="Deals"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="deal" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Deal details',
            supporting:
              'Track an opportunity through the pipeline. Stage probability feeds the forecast; stage moves emit crm.deal.stage_changed for the email automation engine.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create deal',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody>
              <CardTitle>Deal details</CardTitle>
              <div className="flex flex-col gap-4">
                <Field {...v.field('title')}>
                  <FieldLabel required>Title</FieldLabel>
                  <FieldControl
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    {...v.control('title')}
                    placeholder="Q3 fleet renewal"
                  />
                </Field>

                <div className="flex flex-row flex-wrap gap-4">
                  <Field className="flex-1">
                    <FieldLabel>Pipeline</FieldLabel>
                    <NativeSelect
                      value={pipelineId}
                      onChange={(e) => onPipelineChange(e.target.value)}
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field {...v.field('stageId')} className="flex-1">
                    <FieldLabel>Stage</FieldLabel>
                    <NativeSelect
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                      onBlur={() => v.touch('stageId')}
                    >
                      {pipeline?.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.probability}%)
                        </option>
                      ))}
                    </NativeSelect>
                    {v.visibleError('stageId') && (
                      <FieldStatus status="error" attached={false}>
                        {v.visibleError('stageId')}
                      </FieldStatus>
                    )}
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Customer</FieldLabel>
                  <NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">(none)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <div className="flex flex-row flex-wrap gap-4">
                  <Field {...v.field('value')} className="flex-1">
                    <FieldLabel>Value</FieldLabel>
                    <FieldControl
                      name="value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      {...v.control('value')}
                      placeholder="0.00"
                    />
                  </Field>
                  <Field className="w-32">
                    <FieldLabel>Currency</FieldLabel>
                    <FieldControl
                      name="currency"
                      value={currency}
                      maxLength={3}
                      className="uppercase"
                      onChange={(e) => setCurrency(e.target.value)}
                    />
                  </Field>
                  <Field {...v.field('probability')} className="w-32">
                    <FieldLabel>Probability</FieldLabel>
                    <FieldControl
                      name="probability"
                      type="number"
                      min="0"
                      max="100"
                      value={probability}
                      onChange={(e) => setProbability(e.target.value)}
                      {...v.control('probability')}
                      placeholder="0"
                    />
                  </Field>
                </div>

                <div className="flex flex-row flex-wrap gap-4">
                  <Field {...v.field('expectedCloseDate')} className="flex-1">
                    <FieldLabel>Expected close</FieldLabel>
                    <FieldControl
                      name="expectedCloseDate"
                      type="date"
                      value={expectedCloseDate}
                      onChange={(e) => setExpectedCloseDate(e.target.value)}
                      {...v.control('expectedCloseDate')}
                    />
                  </Field>
                  <Field className="flex-1">
                    <FieldLabel>Source</FieldLabel>
                    <FieldControl
                      name="source"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="trade show, referral, …"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Tags</FieldLabel>
                  <FieldControl
                    name="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    render={
                      <Textarea rows={2} placeholder="fleet, q3, gillett (comma-separated)" />
                    }
                  />
                </Field>

                {error && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {error}
                  </FieldStatus>
                )}
              </div>
            </CardBody>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function numOrZero(value: string): number {
  const s = value.trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
