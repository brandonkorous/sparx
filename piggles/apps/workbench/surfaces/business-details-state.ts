// Loading and saving the business record. The surface renders; this owns the query,
// the seeded form, the dirty guard and the save.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { useToast } from '@wizeworks/silicaui-react';
import { api } from '../lib/api/client';
import { useDirtySource } from '../lib/workbench/dirty';
import { timezoneOptions } from '../lib/timezones';
import { apiErrorMessage } from '../lib/api-error';
import {
  EMPTY,
  emailIsMalformed,
  toForm,
  toPayload,
  type BusinessDetails,
  type FormState,
} from './business-details-form';

function useBusinessSave(form: FormState, setForm: (next: FormState) => void) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch<BusinessDetails>('/v1/tenant/business', toPayload(form)),
    onSuccess: (result) => {
      queryClient.setQueryData(['tenant', 'business'], result);
      setForm(toForm(result));
      // Invoices and purchase orders print this record: a preview pane beside
      // this one would otherwise show the old address.
      void queryClient.invalidateQueries({ queryKey: ['invoicing'] });
      toast.add({ title: 'Business details saved', type: 'success' });
    },
    onError: (error) => {
      // The server's own sentence: "check the fields" was the advice given to a
      // bookkeeper who was simply not allowed (sparx persona issue 168).
      toast.add({
        title: 'Could not save',
        description: apiErrorMessage(error, 'Nothing was changed. Try again in a moment.'),
        type: 'error',
      });
    },
  });
}

export function useBusinessDetails() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const query = useQuery({
    queryKey: ['tenant', 'business'],
    queryFn: () => api.get<BusinessDetails>('/v1/tenant/business'),
  });
  const { data } = query;

  // Seed once: re-seeding on every refetch would overwrite what someone is typing.
  useEffect(() => {
    if (data && !loaded) {
      setForm(toForm(data));
      setLoaded(true);
    }
  }, [data, loaded]);

  const emailMalformed = emailIsMalformed(form.supportEmail);
  // Held until blur: mid-keystroke validation marks the field wrong too early.
  const emailError =
    emailMalformed && emailTouched ? 'Enter an address like hello@yourbusiness.com' : null;

  const dirty =
    loaded && data !== undefined && JSON.stringify(form) !== JSON.stringify(toForm(data));
  useDirtySource(dirty, 'Your business details have unsaved changes. Close anyway?');

  const save = useBusinessSave(form, setForm);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ~420 zones, each needing two Intl formatters, so keyed on the SAVED zone:
  // rebuilding it on every pick would stall the click that caused it.
  const zones = useMemo(() => timezoneOptions(data?.timezone ?? null), [data?.timezone]);

  return {
    ...{ query, form, setForm, set, zones, save, dirty },
    ...{ emailMalformed, emailError, setEmailTouched },
  };
}

export type BusinessDetailsState = ReturnType<typeof useBusinessDetails>;
