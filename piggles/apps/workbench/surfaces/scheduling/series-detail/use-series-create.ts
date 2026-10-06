'use client';

import { shownInPlace } from '@wizeworks/query';
import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../../lib/workbench/dirty';
import { afterPaneChange } from '../../../lib/defer';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import {
  buildRrule,
  humanizeRrule,
  schedulingErrorMessage,
  useCreateSeries,
  useSchedulingServices,
  type CreateSeriesPayload,
  type CustomerLite,
  type RecurrenceDraft,
} from '../bookings-data';
import { useSeriesStart } from './series-create-fields';

const BLANK_RECURRENCE: RecurrenceDraft = {
  freq: 'WEEKLY',
  interval: 1,
  byDay: [],
  ends: 'count',
  count: 12,
  until: '',
};

/** What the owner has typed into the new-series form so far. */
function useSeriesDraft(ctx: SurfaceContext) {
  const [serviceId, setServiceId] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [recurrence, setRecurrence] = useState<RecurrenceDraft>(BLANK_RECURRENCE);

  useEffect(() => {
    ctx.setTitle('New repeating booking');
  }, [ctx]);

  return {
    serviceId,
    setServiceId,
    startLocal,
    setStartLocal,
    customer,
    setCustomer,
    recurrence,
    setRecurrence,
  };
}

/** Sends the new series, then opens it in place and says what it made. */
function submitSeries(
  ctx: SurfaceContext,
  toast: ReturnType<typeof useToast>,
  create: ReturnType<typeof useCreateSeries>,
  payload: CreateSeriesPayload
) {
  create.mutate(payload, {
    onSuccess: (result) => {
      ctx.open('scheduling.series.detail', { id: result.series.id }, { target: 'replace' });
      const madeCount = result.created.length;
      const skippedCount = result.skipped.length;
      afterPaneChange(() => {
        toast.add({
          title: 'Repeating booking set up',
          description:
            skippedCount > 0
              ? `${String(madeCount)} booked, ${String(skippedCount)} skipped where the time was already taken.`
              : `${String(madeCount)} booking${madeCount === 1 ? '' : 's'} created.`,
          type: 'success',
        });
      });
    },
    onError: shownInPlace,
  });
}

export function useSeriesCreate(ctx: SurfaceContext) {
  const toast = useToast();
  const create = useCreateSeries();
  const services = useSchedulingServices('');
  const draft = useSeriesDraft(ctx);
  const { serviceId, startLocal, customer, recurrence } = draft;
  const start = useSeriesStart(services, serviceId, startLocal);
  const { startIso } = start;
  const rrule = buildRrule(recurrence);

  const changed =
    serviceId !== '' || startLocal !== '' || customer !== null || recurrence !== BLANK_RECURRENCE;
  const canSave =
    serviceId !== '' &&
    startIso !== null &&
    rrule !== null &&
    !create.isPending &&
    !create.isSuccess;

  useDirtySource(
    changed && !create.isSuccess,
    'This repeating booking has not been set up yet. Close anyway?'
  );

  const preview = rrule ? humanizeRrule(rrule) : null;

  const saveError = create.isError
    ? schedulingErrorMessage(create.error, 'Nothing was set up. Check the pattern and try again.')
    : null;

  const noServices = services.isSuccess && start.serviceList.length === 0;

  const submit = () => {
    if (!canSave || !startIso || !rrule) return;
    submitSeries(ctx, toast, create, {
      serviceId,
      startAt: startIso,
      rrule,
      ...(customer ? { customerId: customer.id } : {}),
      resourceIds: [],
    });
  };

  return { draft, create, services, start, canSave, preview, saveError, noServices, submit };
}
