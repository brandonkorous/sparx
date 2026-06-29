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
  CardContent,
  CardHeader,
  CardTitle,
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

import { createDealAction } from '../../../deal-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

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
    setFieldErrors({});
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
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
        const fe: Record<string, string> = {};
        for (const d of result.error.details) fe[d.field] = d.message;
        setFieldErrors(fe);
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="crm" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New deal"
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
          <Card variant="default">
            <CardHeader>
              <CardTitle>Deal details</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="deal-title">Title</Label>
                  <Input
                    id="deal-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Q3 fleet renewal"
                  />
                  <FieldError msg={fieldErrors.title} />
                </Stack>

                <Stack direction="row" gap={4} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="deal-pipeline">Pipeline</Label>
                    <NativeSelect
                      id="deal-pipeline"
                      value={pipelineId}
                      onChange={(e) => onPipelineChange(e.target.value)}
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="deal-stage">Stage</Label>
                    <NativeSelect
                      id="deal-stage"
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                    >
                      {pipeline?.stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.probability}%)
                        </option>
                      ))}
                    </NativeSelect>
                    <FieldError msg={fieldErrors.stageId} />
                  </Stack>
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="deal-customer">Customer</Label>
                  <NativeSelect
                    id="deal-customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">(none)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Stack>

                <Stack direction="row" gap={4} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="deal-value">Value</Label>
                    <Input
                      id="deal-value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0.00"
                    />
                    <FieldError msg={fieldErrors.value} />
                  </Stack>
                  <Stack gap={2} className="w-32">
                    <Label htmlFor="deal-currency">Currency</Label>
                    <Input
                      id="deal-currency"
                      value={currency}
                      maxLength={3}
                      className="uppercase"
                      onChange={(e) => setCurrency(e.target.value)}
                    />
                  </Stack>
                  <Stack gap={2} className="w-32">
                    <Label htmlFor="deal-probability">Probability</Label>
                    <Input
                      id="deal-probability"
                      type="number"
                      min="0"
                      max="100"
                      value={probability}
                      onChange={(e) => setProbability(e.target.value)}
                      placeholder="0"
                    />
                  </Stack>
                </Stack>

                <Stack direction="row" gap={4} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="deal-close">Expected close</Label>
                    <Input
                      id="deal-close"
                      type="date"
                      value={expectedCloseDate}
                      onChange={(e) => setExpectedCloseDate(e.target.value)}
                    />
                    <FieldError msg={fieldErrors.expectedCloseDate} />
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="deal-source">Source</Label>
                    <Input
                      id="deal-source"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="trade show, referral, …"
                    />
                  </Stack>
                </Stack>

                <Stack gap={2}>
                  <Label htmlFor="deal-tags">Tags</Label>
                  <Textarea
                    id="deal-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    rows={2}
                    placeholder="fleet, q3, gillett (comma-separated)"
                  />
                </Stack>

                {error && (
                  <Text size="sm" variant="danger" role="alert" aria-live="polite">
                    {error}
                  </Text>
                )}
              </Stack>
            </CardContent>
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

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <Text size="xs" variant="danger">
      {msg}
    </Text>
  );
}
