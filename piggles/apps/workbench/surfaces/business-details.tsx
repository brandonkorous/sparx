'use client';

// Business details — who the business IS, as a legal entity.
//
// This is the account's own record, and it is deliberately NOT a site: a
// business is "WizeWorks", registered as "WizeWorks LLC", and it may run a site
// called "sparx". Sites have their own names and brands; this is the entity
// behind them, and it is what a customer-facing DOCUMENT is issued by.
//
// Nothing here is required. A business fills it in over time, and an invoice
// renders with whatever is known rather than blocking on a field nobody set —
// so there is no validation gate, only a Save.
//
// This file owns loading and saving that record. The fields themselves are in
// `business-details-columns.tsx`, and what a record is made of in
// `business-details-form.ts`.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import { faExclamationTriangle, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { api } from '../lib/api/client';
import { useDirtySource } from '../lib/workbench/dirty';
import { timezoneOptions } from '../lib/timezones';
import { PaneToolbar, PANE_SHELL } from '../components/pane-toolbar';
import { RefreshButton } from '../components/refresh-button';
import { EditorLayout } from '../components/editor-layout';
import { BusinessMainColumn, BusinessRailColumn } from './business-details-columns';
import {
  EMPTY,
  emailIsMalformed,
  toForm,
  toPayload,
  type BusinessDetails,
  type FormState,
} from './business-details-form';
import type { SurfaceContext } from '../lib/surfaces/registry';

export function BusinessDetailsSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const { data, isError, isPending, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<BusinessDetails>('/v1/tenant/business'),
  });

  useEffect(() => {
    ctx.setTitle('Business details');
  }, [ctx]);

  // Seed once. Re-seeding on every refetch would overwrite what someone is
  // part-way through typing when a background refresh lands.
  useEffect(() => {
    if (data && !loaded) {
      setForm(toForm(data));
      setLoaded(true);
    }
  }, [data, loaded]);

  const emailMalformed = emailIsMalformed(form.supportEmail);
  // Held until blur: validating mid-keystroke marks the field wrong before
  // anyone has finished typing the first character.
  const emailError =
    emailMalformed && emailTouched ? 'Enter an address like hello@yourbusiness.com' : null;

  const dirty =
    loaded && data !== undefined && JSON.stringify(form) !== JSON.stringify(toForm(data));
  useDirtySource(dirty, 'Your business details have unsaved changes. Close anyway?');

  const save = useMutation({
    mutationFn: () => api.patch<BusinessDetails>('/v1/tenant/business', toPayload(form)),
    onSuccess: (result) => {
      queryClient.setQueryData(['tenant', 'business'], result);
      setForm(toForm(result));
      // Invoices and purchase orders print this record — a stale copy in a
      // preview pane beside this one would show the old address.
      void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
      toast.add({ title: 'Business details saved', type: 'success' });
    },
    onError: () => {
      toast.add({
        title: 'Could not save',
        description: 'Nothing was changed. Check the fields and try again.',
        type: 'error',
      });
    },
  });

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ~420 zones, each needing two Intl formatters to describe — so this is keyed
  // on the SAVED zone, not the edited one. Anything the user picks came out of
  // this list already, and rebuilding it on every pick would stall the click
  // that caused it.
  const zones = useMemo(() => timezoneOptions(data?.timezone ?? null), [data?.timezone]);

  // A failed load is shown INSTEAD of the form, never alongside it. The form
  // seeds from `data`, so on a failed load every field renders blank — which
  // reads as "this business has filled nothing in" rather than "we could not
  // reach the server". Someone would retype their whole address into a form
  // whose Save is already dead (`dirty` needs `data`), and lose it.
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Alert color="error" className="max-w-md">
          <Icon glyph={faExclamationTriangle} />
          <AlertContent>
            <AlertTitle>Could not load your business details</AlertTitle>
            <AlertDescription>
              Nothing has been lost — this is a problem reaching the server, not with your saved
              details.
            </AlertDescription>
          </AlertContent>
          <AlertActions>
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
          </AlertActions>
        </Alert>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Business details actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            // A malformed address blocks the save outright: the server rejects it
            // anyway, and a 400 surfaces as a generic toast that never points at
            // the field that caused it.
            disabled={!dirty || emailMalformed || isPending || save.isPending}
            onClick={() => {
              setEmailTouched(true);
              save.mutate();
            }}
          >
            <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorLayout
          main={
            <BusinessMainColumn
              form={form}
              set={set}
              emailError={emailError}
              onEmailBlur={() => {
                setEmailTouched(true);
              }}
            />
          }
          rail={<BusinessRailColumn form={form} set={set} setForm={setForm} zones={zones} />}
        />
      </div>
    </div>
  );
}
