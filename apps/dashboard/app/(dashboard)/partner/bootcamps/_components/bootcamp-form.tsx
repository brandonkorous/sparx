'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  NativeSelect,
  Radio,
  Switch,
} from '@wizeworks/silicaui-react';
import {
  ModuleProvider,
  RichTextEditor,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  statusLabel,
  statusTone,
  type SurfaceStepDef,
} from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';
import type { PartnerTier } from '@sparx/partner-schemas';

import { fmtMoneyCents } from '../../../_components/overview-bits';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import type { Bootcamp } from '../../_lib/types';
import { createBootcampAction, updateBootcampAction } from '../actions';
import { BootcampDeleteButton } from './bootcamp-delete-button';
import { BootcampStatusActions } from './bootcamp-status-actions';

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

const FORMATS: { value: Bootcamp['format']; label: string }[] = [
  { value: 'virtual', label: 'Virtual' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'async', label: 'Self-paced' },
];

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface BootcampFormProps {
  mode: 'create' | 'edit';
  bootcamp?: Bootcamp;
  partnerTier: PartnerTier;
}

export function BootcampForm({ mode, bootcamp, partnerTier }: BootcampFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState(bootcamp?.title ?? '');
  const [description, setDescription] = React.useState(bootcamp?.description ?? '');
  const [format, setFormat] = React.useState<Bootcamp['format']>(bootcamp?.format ?? 'virtual');
  const [city, setCity] = React.useState(bootcamp?.locationCity ?? '');
  const [region, setRegion] = React.useState(bootcamp?.locationState ?? '');
  const [country, setCountry] = React.useState(bootcamp?.locationCountry ?? 'US');
  const [startsAt, setStartsAt] = React.useState(toLocalInput(bootcamp?.startsAt));
  const [endsAt, setEndsAt] = React.useState(toLocalInput(bootcamp?.endsAt));
  const [limited, setLimited] = React.useState((bootcamp?.seatsTotal ?? null) !== null);
  const [seats, setSeats] = React.useState(
    bootcamp?.seatsTotal != null ? String(bootcamp.seatsTotal) : '25'
  );
  const [price, setPrice] = React.useState(bootcamp ? (bootcamp.priceCents / 100).toString() : '0');
  const [regMode, setRegMode] = React.useState<Bootcamp['registrationMode']>(
    bootcamp?.registrationMode ?? 'internal'
  );
  const [regUrl, setRegUrl] = React.useState(bootcamp?.registrationUrl ?? '');

  // Client rule: a title is required. The server may additionally reject the
  // external registration URL, which maps back onto that field.
  const v = useFieldValidation(
    { title, registrationUrl: regUrl },
    { title: rule.required('A title is required.') }
  );

  const snapshot = JSON.stringify({
    title,
    description,
    format,
    city,
    region,
    country,
    startsAt,
    endsAt,
    limited,
    seats: limited ? seats : '',
    price,
    regMode,
    regUrl: regMode === 'external' ? regUrl : '',
  });
  const [initial] = React.useState(snapshot);
  const dirty = snapshot !== initial;

  React.useEffect(() => {
    if (dirty) setSavedAt(null);
  }, [dirty]);

  const guardLeave = useUnsavedGuard(
    dirty,
    mode === 'create' ? { kind: 'create', noun: 'bootcamp' } : { kind: 'edit', noun: 'bootcamp' }
  );
  const cancel = React.useCallback(async () => {
    if (!(await guardLeave())) return;
    router.push('/partner/bootcamps');
  }, [guardLeave, router]);

  function buildPayload() {
    return {
      title: title.trim(),
      description,
      format,
      locationCity: city.trim() || null,
      locationState: region.trim() || null,
      locationCountry: country.trim() ? country.trim().toUpperCase() : 'US',
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      seatsTotal: limited ? Number.parseInt(seats, 10) : null,
      priceCents: Math.round(Number.parseFloat(price || '0') * 100),
      currency: 'USD',
      registrationMode: regMode,
      registrationUrl: regMode === 'external' ? regUrl.trim() || null : null,
    };
  }

  function applyErrors(result: {
    error?: string;
    fieldErrors?: { field: string; message: string }[];
  }) {
    if (result.fieldErrors?.length) {
      const fe: Record<string, string> = {};
      for (const f of result.fieldErrors) fe[f.field] = f.message;
      v.setServerErrors(fe);
    }
    setError(result.error ?? 'Something went wrong.');
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    if (!startsAt || !endsAt) {
      setError('Set both a start and end date/time.');
      return;
    }
    const payload = buildPayload();
    startTransition(async () => {
      if (mode === 'create') {
        const result = await createBootcampAction(payload);
        if (!result.ok || !result.bootcamp) return applyErrors(result);
        router.push(`/partner/bootcamps/${result.bootcamp.id}`);
        router.refresh();
        return;
      }
      const result = await updateBootcampAction(bootcamp!.id, payload);
      if (!result.ok) return applyErrors(result);
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="partner" className="h-full">
      <SurfaceFrame
        variant="embedded"
        title={mode === 'create' ? 'New bootcamp' : (bootcamp?.title ?? 'Bootcamp')}
        backLabel="Bootcamps"
        headerActions={
          mode === 'edit' && bootcamp ? (
            <BootcampStatusActions id={bootcamp.id} status={bootcamp.status} slug={bootcamp.slug} />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
        summary={bootcamp ? <BootcampSummary bootcamp={bootcamp} /> : <NewBootcampSummary />}
      >
        <SurfaceStep
          header={{
            title: mode === 'create' ? 'Bootcamp details' : 'Edit bootcamp',
            supporting:
              'Set the essentials now — you can keep editing as a draft. Publishing to the public directory requires the Certified tier.',
          }}
          actions={{
            nextForm: 'bootcamp-form',
            nextLabel: mode === 'create' ? 'Create bootcamp' : 'Save changes',
            nextLoading: pending,
            nextDisabled: pending || (mode === 'edit' && !dirty),
            destructive:
              mode === 'edit' && bootcamp?.status === 'draft' ? (
                <BootcampDeleteButton id={bootcamp.id} title={bootcamp.title} />
              ) : undefined,
            extra:
              savedAt && !error ? (
                <p className="text-success text-xs">Saved {savedAt}</p>
              ) : undefined,
          }}
        >
          <form
            id="bootcamp-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pending) submit();
            }}
          >
            <Card>
              <CardBody>
                <div className="flex flex-col gap-5">
                  <Field {...v.field('title')}>
                    <FieldLabel required>Title</FieldLabel>
                    <FieldControl
                      id="bc-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={255}
                      placeholder="Launch your store on Sparx in a weekend"
                      {...v.control('title')}
                    />
                  </Field>

                  <div className="flex flex-col gap-2">
                    <Label>Description</Label>
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      ariaLabel="Bootcamp description"
                      placeholder="What attendees will learn and walk away with…"
                    />
                  </div>

                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="min-w-[12rem] flex-1">
                      <FieldLabel>Format</FieldLabel>
                      <FieldControl
                        id="bc-format"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as Bootcamp['format'])}
                        render={
                          <NativeSelect>
                            {FORMATS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </NativeSelect>
                        }
                      />
                    </Field>
                    <Field className="min-w-[8rem] flex-1">
                      <FieldLabel>Price (USD)</FieldLabel>
                      <FieldControl
                        id="bc-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="text-base-content text-xs">
                    Collecting payment for a bootcamp is your responsibility — Sparx lists it and
                    drives registrations, but does not process the ticket price.
                  </p>

                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="min-w-[12rem] flex-1">
                      <FieldLabel>Starts</FieldLabel>
                      <FieldControl
                        id="bc-starts"
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                      />
                    </Field>
                    <Field className="min-w-[12rem] flex-1">
                      <FieldLabel>Ends</FieldLabel>
                      <FieldControl
                        id="bc-ends"
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="min-w-[10rem] flex-1">
                      <FieldLabel>City</FieldLabel>
                      <FieldControl
                        id="bc-city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </Field>
                    <Field className="min-w-[10rem] flex-1">
                      <FieldLabel>State / region</FieldLabel>
                      <FieldControl
                        id="bc-region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      />
                    </Field>
                    <Field className="w-24">
                      <FieldLabel>Country</FieldLabel>
                      <FieldControl
                        id="bc-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value.toUpperCase())}
                        maxLength={2}
                        className="uppercase"
                      />
                    </Field>
                  </div>

                  <div className="flex flex-row items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Label htmlFor="bc-limited">Limit seats</Label>
                      <p className="text-base-content text-xs">
                        Off means unlimited seats; on caps registrations and waitlists the rest.
                      </p>
                    </div>
                    <Switch
                      id="bc-limited"
                      color="module"
                      checked={limited}
                      onCheckedChange={setLimited}
                    />
                  </div>
                  {limited && (
                    <Field className="max-w-[12rem]">
                      <FieldLabel>Total seats</FieldLabel>
                      <FieldControl
                        id="bc-seats"
                        type="number"
                        min={1}
                        step={1}
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                      />
                    </Field>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label>Registration</Label>
                    <div className="grid gap-2">
                      <RegOption
                        value="internal"
                        title="On Sparx"
                        hint="Attendees RSVP here and land as leads in your CRM."
                        checked={regMode === 'internal'}
                        onSelect={() => setRegMode('internal')}
                      />
                      <RegOption
                        value="external"
                        title="External link"
                        hint="Send registrations to Eventbrite, Luma, a form, or your own page."
                        checked={regMode === 'external'}
                        onSelect={() => setRegMode('external')}
                      />
                    </div>
                  </div>
                  {regMode === 'external' && (
                    <Field {...v.field('registrationUrl')}>
                      <FieldLabel>Registration URL</FieldLabel>
                      <FieldControl
                        id="bc-regurl"
                        value={regUrl}
                        onChange={(e) => setRegUrl(e.target.value)}
                        placeholder="https://…"
                        {...v.control('registrationUrl')}
                      />
                    </Field>
                  )}

                  {partnerTier !== 'certified' && (
                    <p className="text-base-content text-xs">
                      You can build and save this as a draft now. Publishing it to the public
                      directory unlocks at the Certified tier.
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          </form>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function RegOption({
  value,
  title,
  hint,
  checked,
  onSelect,
}: {
  value: string;
  title: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="border-base-300 flex items-start gap-3 rounded-lg border p-3">
      <Radio
        name="bc-regmode"
        id={`reg-${value}`}
        value={value}
        checked={checked}
        onChange={onSelect}
        color="module"
        className="mt-1"
      />
      <div className="flex min-w-0 flex-col gap-0">
        <Label htmlFor={`reg-${value}`}>{title}</Label>
        <p className="text-base-content text-xs">{hint}</p>
      </div>
    </div>
  );
}

function NewBootcampSummary() {
  return (
    <SurfaceSummary title="New bootcamp">
      <p className="text-base-content text-sm">
        Save it as a draft first, then publish when you’re ready. On-platform RSVPs become leads in
        your CRM automatically.
      </p>
    </SurfaceSummary>
  );
}

function BootcampSummary({ bootcamp }: { bootcamp: Bootcamp }) {
  const seats =
    bootcamp.seatsTotal == null
      ? 'Unlimited'
      : `${bootcamp.seatsFilled} / ${bootcamp.seatsTotal} filled`;
  return (
    <SurfaceSummary
      title="Bootcamp"
      footer={
        <Badge color={statusTone(bootcamp.status)} variant="soft">
          {statusLabel(bootcamp.status)}
        </Badge>
      }
    >
      <SurfaceSummaryRow label="Slug" value={bootcamp.slug} />
      <SurfaceSummaryRow label="Seats" value={seats} />
      <SurfaceSummaryRow
        label="Price"
        value={
          bootcamp.priceCents > 0 ? fmtMoneyCents(bootcamp.priceCents, bootcamp.currency) : 'Free'
        }
      />
      <SurfaceSummaryDivider />
      <SurfaceSummaryRow
        label="Public page"
        value={bootcamp.status === 'published' ? `/bootcamp/${bootcamp.slug}` : 'When published'}
      />
    </SurfaceSummary>
  );
}
