'use client';

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../../lib/confirm';
import { schedulingErrorMessage, useCancelSeries } from '../bookings-data';

/** Stopping a live pattern: confirm, cancel the chosen scope, then say what happened. */
export function useStopSeries(seriesId: string) {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const cancel = useCancelSeries(seriesId);

  const onStop = async (scope: 'future' | 'all') => {
    const ok = await confirmDialog({
      title:
        scope === 'all' ? 'Stop and cancel every upcoming one?' : 'Stop this repeating booking?',
      description:
        scope === 'all'
          ? 'This stops the pattern and cancels every occurrence still to come, including ones already in progress. Past and completed ones are kept. Customers are told. Any card hold or deposit on them is settled by your booking rules, the same as canceling each one on its own, late-cancellation fees included. This cannot be undone.'
          : 'This stops the pattern from creating any more, and cancels the ones not yet started. Anything already under way or completed is kept. Any card hold or deposit on them is settled by your booking rules, the same as canceling each one on its own, late-cancellation fees included. This cannot be undone.',
      confirmLabel: scope === 'all' ? 'Stop and cancel all' : 'Stop it',
      cancelLabel: 'Keep it running',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(
      { scope },
      {
        onSuccess: (result) => {
          toast.add({
            title: 'Repeating booking stopped',
            description:
              result.cancelled > 0
                ? `${String(result.cancelled)} upcoming booking${result.cancelled === 1 ? '' : 's'} canceled.`
                : undefined,
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not stop it',
            description: schedulingErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return { cancel, onStop };
}
