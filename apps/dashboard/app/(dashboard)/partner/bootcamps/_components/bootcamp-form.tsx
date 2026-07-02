'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  RadioGroup,
  RadioGroupItem,
  RichTextEditor,
  Stack,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  Switch,
  Text,
  statusLabel,
  statusTone,
  type SurfaceStepDef,
} from '@sparx/ui';
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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
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
      setFieldErrors(fe);
    }
    setError(result.error ?? 'Something went wrong.');
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    if (!title.trim()) {
      setFieldErrors({ title: 'A title is required.' });
      return;
    }
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
                <Text size="xs" variant="success">
                  Saved {savedAt}
                </Text>
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
            <Card variant="default">
              <CardContent className="py-6">
                <Stack gap={5}>
                  <Stack gap={2}>
                    <Label htmlFor="bc-title">Title</Label>
                    <Input
                      id="bc-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      variant={fieldErrors.title ? 'error' : 'default'}
                      maxLength={255}
                      placeholder="Launch your store on Sparx in a weekend"
                    />
                    {fieldErrors.title && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.title}
                      </Text>
                    )}
                  </Stack>

                  <Stack gap={2}>
                    <Label>Description</Label>
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      ariaLabel="Bootcamp description"
                      placeholder="What attendees will learn and walk away with…"
                    />
                  </Stack>

                  <Stack direction="row" gap={3} wrap>
                    <Stack gap={2} className="min-w-[12rem] flex-1">
                      <Label htmlFor="bc-format">Format</Label>
                      <NativeSelect
                        id="bc-format"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as Bootcamp['format'])}
                      >
                        {FORMATS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Stack>
                    <Stack gap={2} className="min-w-[8rem] flex-1">
                      <Label htmlFor="bc-price">Price (USD)</Label>
                      <Input
                        id="bc-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                    </Stack>
                  </Stack>
                  <Text size="xs" variant="muted">
                    Collecting payment for a bootcamp is your responsibility — Sparx lists it and
                    drives registrations, but does not process the ticket price.
                  </Text>

                  <Stack direction="row" gap={3} wrap>
                    <Stack gap={2} className="min-w-[12rem] flex-1">
                      <Label htmlFor="bc-starts">Starts</Label>
                      <Input
                        id="bc-starts"
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                      />
                    </Stack>
                    <Stack gap={2} className="min-w-[12rem] flex-1">
                      <Label htmlFor="bc-ends">Ends</Label>
                      <Input
                        id="bc-ends"
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                      />
                    </Stack>
                  </Stack>

                  <Stack direction="row" gap={3} wrap>
                    <Stack gap={2} className="min-w-[10rem] flex-1">
                      <Label htmlFor="bc-city">City</Label>
                      <Input id="bc-city" value={city} onChange={(e) => setCity(e.target.value)} />
                    </Stack>
                    <Stack gap={2} className="min-w-[10rem] flex-1">
                      <Label htmlFor="bc-region">State / region</Label>
                      <Input
                        id="bc-region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      />
                    </Stack>
                    <Stack gap={2} className="w-24">
                      <Label htmlFor="bc-country">Country</Label>
                      <Input
                        id="bc-country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value.toUpperCase())}
                        maxLength={2}
                        className="uppercase"
                      />
                    </Stack>
                  </Stack>

                  <Stack direction="row" align="center" justify="between" gap={3}>
                    <Stack gap={1} className="min-w-0">
                      <Label htmlFor="bc-limited">Limit seats</Label>
                      <Text size="xs" variant="muted">
                        Off means unlimited seats; on caps registrations and waitlists the rest.
                      </Text>
                    </Stack>
                    <Switch
                      id="bc-limited"
                      color="module"
                      checked={limited}
                      onCheckedChange={setLimited}
                    />
                  </Stack>
                  {limited && (
                    <Stack gap={2} className="max-w-[12rem]">
                      <Label htmlFor="bc-seats">Total seats</Label>
                      <Input
                        id="bc-seats"
                        type="number"
                        min={1}
                        step={1}
                        value={seats}
                        onChange={(e) => setSeats(e.target.value)}
                      />
                    </Stack>
                  )}

                  <Stack gap={2}>
                    <Label>Registration</Label>
                    <RadioGroup
                      value={regMode}
                      onValueChange={(v) => setRegMode(v as Bootcamp['registrationMode'])}
                    >
                      <RegOption
                        value="internal"
                        title="On Sparx"
                        hint="Attendees RSVP here and land as leads in your CRM."
                      />
                      <RegOption
                        value="external"
                        title="External link"
                        hint="Send registrations to Eventbrite, Luma, a form, or your own page."
                      />
                    </RadioGroup>
                  </Stack>
                  {regMode === 'external' && (
                    <Stack gap={2}>
                      <Label htmlFor="bc-regurl">Registration URL</Label>
                      <Input
                        id="bc-regurl"
                        value={regUrl}
                        onChange={(e) => setRegUrl(e.target.value)}
                        placeholder="https://…"
                        variant={fieldErrors.registrationUrl ? 'error' : 'default'}
                      />
                      {fieldErrors.registrationUrl && (
                        <Text size="xs" variant="danger">
                          {fieldErrors.registrationUrl}
                        </Text>
                      )}
                    </Stack>
                  )}

                  {partnerTier !== 'certified' && (
                    <Text size="xs" variant="muted">
                      You can build and save this as a draft now. Publishing it to the public
                      directory unlocks at the Certified tier.
                    </Text>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </form>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function RegOption({ value, title, hint }: { value: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border-default)] p-3">
      <RadioGroupItem id={`reg-${value}`} value={value} color="module" className="mt-1" />
      <Stack gap={0} className="min-w-0">
        <Label htmlFor={`reg-${value}`}>{title}</Label>
        <Text size="xs" variant="muted">
          {hint}
        </Text>
      </Stack>
    </div>
  );
}

function NewBootcampSummary() {
  return (
    <SurfaceSummary title="New bootcamp">
      <Text size="sm" variant="muted">
        Save it as a draft first, then publish when you’re ready. On-platform RSVPs become leads in
        your CRM automatically.
      </Text>
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
