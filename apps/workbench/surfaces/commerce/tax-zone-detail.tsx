'use client';

// One place you collect tax — create it, then manage its rate(s).
//
// WHERE the place is (its country, and optionally one state or province) is
// chosen once when you create it and fixed after, exactly like a collection's
// kind: moving a zone somewhere else is really a different zone, and the tax
// engine keys refunds off the original. To move it, delete and make a new one.
// Everything else — why you collect here, your registration number, whether it
// is switched on, and the rate itself — stays editable.
//
// A place with no rate, or one switched off, charges nothing: the calculator
// only ever matches an ACTIVE place with a rate. So an off/rate-less place is
// safe, and the surface says as much rather than implying tax is being charged.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  Select,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { Plus, Trash2 } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { useDirtySource } from '../../lib/workbench/dirty';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { countryName, countryOptions, hasRegions, regionName, regionOptions } from './geo';
import {
  formatBasisPoints,
  nexusLabel,
  percentToBasisPoints,
  taxErrorMessage,
  useCreateTaxRate,
  useCreateTaxZone,
  useDeleteTaxRate,
  useDeleteTaxZone,
  useTaxZone,
  useUpdateTaxZone,
  useZoneTaxRates,
  type NexusType,
  type TaxRate,
  type TaxZone,
} from './tax-data';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

const NEXUS_OPTIONS: { value: NexusType; label: string }[] = [
  { value: 'physical', label: 'You have a shop, office, or staff here' },
  { value: 'economic', label: 'You sell enough here to owe tax' },
  { value: 'voluntary', label: 'You chose to collect here' },
];

interface Draft {
  country: string;
  region: string; // '' = the whole country
  nexusType: NexusType;
  registrationNumber: string;
  isActive: boolean;
}

function toDraft(zone: TaxZone): Draft {
  return {
    country: zone.country,
    region: zone.region ?? '',
    nexusType: (zone.nexusType as NexusType) ?? 'physical',
    registrationNumber: zone.registrationNumber ?? '',
    isActive: zone.isActive,
  };
}

function emptyDraft(): Draft {
  return {
    country: 'US',
    region: '',
    nexusType: 'physical',
    registrationNumber: '',
    isActive: true,
  };
}

export function TaxZoneDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <ZoneEditor ctx={ctx} id="new" /> : <ZoneLoader ctx={ctx} id={id} />;
}

function ZoneLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: zone, isPending, isError, refetch } = useTaxZone(id);

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Alert color="error" variant="soft" className="max-w-md">
          <AlertContent>
            <AlertTitle>Could not load this tax place</AlertTitle>
            <AlertDescription>
              This is a problem reaching the server. Nothing has been lost.
            </AlertDescription>
          </AlertContent>
          <Button
            size="sm"
            color="error"
            variant="soft"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  if (isPending || !zone) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  return <ZoneEditor ctx={ctx} id={id} zone={zone} />;
}

function ZoneEditor({ ctx, id, zone }: { ctx: SurfaceContext; id: string; zone?: TaxZone }) {
  const isNew = id === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const create = useCreateTaxZone();
  const update = useUpdateTaxZone(id);
  const remove = useDeleteTaxZone(id);

  const saved = useMemo(() => (zone ? toDraft(zone) : emptyDraft()), [zone]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const placeTitle = draft.region ? regionName(draft.region) : countryName(draft.country);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New tax place' : placeTitle || 'Tax place');
  }, [ctx, isNew, placeTitle]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const dirty = isNew
    ? true
    : draft.nexusType !== saved.nexusType ||
      draft.registrationNumber !== saved.registrationNumber ||
      draft.isActive !== saved.isActive;

  const saving = create.isPending || update.isPending;

  useDirtySource(
    dirty && !create.isSuccess && (isNew || touched),
    isNew
      ? 'This tax place has not been created yet. Close anyway?'
      : 'This tax place has unsaved changes. Close anyway?'
  );

  const failure =
    create.isError || update.isError
      ? taxErrorMessage(
          create.error ?? update.error,
          'Could not save this place. Nothing was changed.'
        )
      : null;

  const submit = () => {
    const input = {
      country: draft.country,
      ...(draft.region ? { region: draft.region } : {}),
      nexusType: draft.nexusType,
      registrationNumber: draft.registrationNumber.trim(),
      isActive: draft.isActive,
    };
    if (isNew) {
      create.mutate(input, {
        onSuccess: (created) => {
          ctx.open('commerce.tax.zone.detail', { id: created.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${placeTitle} added`, type: 'success' });
          });
        },
      });
      return;
    }
    update.mutate(input, {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: 'Tax place saved', type: 'success' });
      },
    });
  };

  const onDelete = async () => {
    if (!zone) return;
    const ok = await confirm({
      title: `Delete ${placeTitle}?`,
      description:
        'This place and its rate are removed, and you will stop collecting tax here at checkout. This cannot be undone.',
      confirmLabel: 'Delete this place',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${placeTitle} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this place',
          description: taxErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  const showRegions = hasRegions(draft.country);
  const regionItems = [{ value: '', label: 'The whole country' }, ...regionOptions(draft.country)];

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Tax place actions">
        {!isNew && zone ? (
          <Badge color={zone.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
            {zone.isActive ? 'Collecting' : 'Off'}
          </Badge>
        ) : null}
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          loading={saving}
          disabled={!isNew && !dirty}
          onClick={submit}
        >
          {isNew ? 'Add this place' : 'Save'}
        </Button>
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isNew ? (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                Add a tax place
              </Heading>
              <Text>
                Set up somewhere you have to collect tax. Choose the country (and a state or
                province if the tax is set there), then add the rate. Nothing is charged until you
                switch the place on.
              </Text>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Heading level={1} className="text-2xl font-semibold">
                {placeTitle}
              </Heading>
              <Text className="text-sm">
                {draft.region ? `${countryName(draft.country)} · ` : ''}
                {nexusLabel(draft.nexusType)}
              </Text>
            </div>
          )}

          {failure ? (
            <Alert color="error" variant="soft">
              <AlertContent>
                <AlertTitle>Could not save this place</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {isNew ? (
            <FormSection
              title="Where"
              description="This is fixed once the place is created — to move it later, delete it and add a new one."
            >
              <Field>
                <FieldLabel>Country</FieldLabel>
                <FieldControl
                  render={
                    <Select
                      color="module"
                      aria-label="Country"
                      value={draft.country}
                      items={countryOptions()}
                      onValueChange={(next) => {
                        const country = (next as string) ?? 'US';
                        setTouched(true);
                        setDraft((current) => ({ ...current, country, region: '' }));
                      }}
                    />
                  }
                />
              </Field>

              {showRegions ? (
                <Field>
                  <FieldLabel>State or province</FieldLabel>
                  <FieldControl
                    render={
                      <Select
                        color="module"
                        aria-label="State or province"
                        value={draft.region}
                        items={regionItems}
                        onValueChange={(next) => {
                          set('region', (next as string) ?? '');
                        }}
                      />
                    }
                  />
                  <FieldDescription>
                    Choose a state or province if the tax is set there. Leave as the whole country
                    for a nationwide tax.
                  </FieldDescription>
                </Field>
              ) : null}
            </FormSection>
          ) : null}

          <FormSection title="About this place">
            <Field>
              <FieldLabel>Why you collect tax here</FieldLabel>
              <FieldControl
                render={
                  <Select
                    color="module"
                    aria-label="Why you collect tax here"
                    value={draft.nexusType}
                    items={NEXUS_OPTIONS}
                    onValueChange={(next) => {
                      set('nexusType', (next as NexusType) ?? 'physical');
                    }}
                  />
                }
              />
              <FieldDescription>
                For your own records. It doesn&apos;t change what a shopper is charged.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Registration or permit number (optional)</FieldLabel>
              <FieldControl
                render={
                  <Input
                    color="module"
                    value={draft.registrationNumber}
                    placeholder="e.g. your sales-tax permit or VAT number"
                    onChange={(event) => {
                      set('registrationNumber', event.target.value);
                    }}
                  />
                }
              />
            </Field>

            <Field>
              <FieldLabel>Collect tax here</FieldLabel>
              <FieldControl
                render={
                  <Switch
                    color="module"
                    checked={draft.isActive}
                    onCheckedChange={(next: boolean) => {
                      set('isActive', next);
                    }}
                  />
                }
              />
              <FieldDescription>
                While this is off, no tax is charged here — even if a rate is set below.
              </FieldDescription>
            </Field>
          </FormSection>

          <FormSection
            title="The rate"
            description="What percentage is added. You can add more than one (a state and a county tax, say) and they add together."
          >
            {isNew ? (
              <Text className="text-sm">
                Add this place first (use Add above), then set its rate here.
              </Text>
            ) : (
              <ZoneTaxRatesEditor zoneId={id} />
            )}
          </FormSection>

          {!isNew && zone ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Text className="text-sm">Deleting stops you collecting tax here.</Text>
              <Button
                size="sm"
                variant="outline"
                color="danger"
                loading={remove.isPending}
                onClick={() => {
                  void onDelete();
                }}
              >
                <Trash2 className="size-4" aria-hidden />
                Delete this place
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Rates ──────────────────────────────────────────────────────────────── */

function ZoneTaxRatesEditor({ zoneId }: { zoneId: string }) {
  const rates = useZoneTaxRates(zoneId);
  const create = useCreateTaxRate();
  const remove = useDeleteTaxRate();
  const confirm = useConfirm();
  const toast = useToast();

  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [appliesToShipping, setAppliesToShipping] = useState(false);

  const rows = rates.data ?? [];
  const percentValue = Number(percent);
  const percentValid =
    percent.trim() !== '' &&
    Number.isFinite(percentValue) &&
    percentValue >= 0 &&
    percentValue <= 100;
  const canAdd = name.trim() !== '' && percentValid;

  const failure = create.isError
    ? taxErrorMessage(create.error, 'Could not add this rate. Nothing was changed.')
    : null;

  const add = () => {
    if (!canAdd) return;
    create.mutate(
      {
        zoneId,
        name: name.trim(),
        rateBasisPoints: percentToBasisPoints(percentValue),
        appliesToShipping,
      },
      {
        onSuccess: () => {
          setName('');
          setPercent('');
          setAppliesToShipping(false);
          toast.add({ title: 'Rate added', type: 'success' });
        },
      }
    );
  };

  const onDelete = (rate: TaxRate) => {
    void (async () => {
      const ok = await confirm({
        title: `Remove ${rate.name}?`,
        description: `The ${formatBasisPoints(rate.rateBasisPoints)} rate is removed from this place. This cannot be undone.`,
        confirmLabel: 'Remove it',
        cancelLabel: 'Keep it',
        color: 'danger',
      });
      if (!ok) return;
      remove.mutate(rate.id, {
        onSuccess: () => {
          toast.add({ title: `${rate.name} removed`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not remove that rate',
            description: taxErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
    })();
  };

  return (
    <div className="flex flex-col gap-4">
      {rates.isError ? (
        <Alert color="error" variant="soft">
          <AlertContent>
            <AlertTitle>Could not load the rate</AlertTitle>
            <AlertDescription>
              {taxErrorMessage(rates.error, 'This is a problem reaching the server.')}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : rates.isPending ? (
        <Text className="text-sm" role="status">
          Loading…
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">
          No rate set yet — nothing is charged here until you add one below.
        </Text>
      ) : (
        <div className="flex flex-col">
          {rows.map((rate) => (
            <div
              key={rate.id}
              className="border-base-300 flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{rate.name}</span>
                {rate.appliesToShipping ? (
                  <Text as="span" className="text-sm">
                    Also charged on delivery
                  </Text>
                ) : null}
              </span>
              <Badge color="neutral" variant="soft" size="sm">
                {formatBasisPoints(rate.rateBasisPoints)}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                color="danger"
                shape="square"
                aria-label={`Remove ${rate.name}`}
                loading={remove.isPending && remove.variables === rate.id}
                onClick={() => {
                  onDelete(rate);
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}

      {failure ? (
        <Alert color="error" variant="soft">
          <AlertContent>
            <AlertTitle>Could not add this rate</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="border-base-300 bg-base-200 flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-[12rem] flex-1">
            <FieldLabel>Rate name</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  value={name}
                  placeholder="e.g. California Sales Tax"
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                />
              }
            />
          </Field>
          <Field className="min-w-[8rem]">
            <FieldLabel>Percentage</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  className="max-w-[7rem] text-right tabular-nums"
                  inputMode="decimal"
                  value={percent}
                  placeholder="8.25"
                  onChange={(event) => {
                    setPercent(event.target.value.replace(/[^0-9.]/g, ''));
                  }}
                />
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Also charge this tax on delivery</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={appliesToShipping}
                onCheckedChange={(next: boolean) => {
                  setAppliesToShipping(next);
                }}
              />
            }
          />
          <FieldDescription>
            Some places tax the delivery charge too. Leave off if unsure.
          </FieldDescription>
        </Field>

        <div className="flex justify-end">
          <Button
            size="sm"
            color="module"
            loading={create.isPending}
            disabled={!canAdd}
            onClick={add}
          >
            <Plus className="size-4" aria-hidden />
            Add this rate
          </Button>
        </div>
      </div>
    </div>
  );
}
