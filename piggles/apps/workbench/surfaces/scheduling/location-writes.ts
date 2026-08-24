'use client';

// Saving a place, and removing one. Both are hooks so the editor holds the form
// and nothing else.

import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  schedulingErrorMessage,
  useCreateLocation,
  useDeleteLocation,
  useUpdateLocation,
  type BusinessLocation,
  type LocationInput,
} from './setup-data';

const DETAIL_KEY = 'scheduling.locations.detail';

export interface SaveLocation {
  run: (body: LocationInput) => void;
  isPending: boolean;
  /** The one sentence to show above the form, or null. */
  error: string | null;
  /** So the leave-guard can stand down once a new place has landed. */
  created: boolean;
}

/** A new place REPLACES the pane with the saved one, so the person is left
 *  looking at the thing they just made rather than at an empty form that has
 *  quietly become a second one. */
export function useSaveLocation(ctx: SurfaceContext, id: string, isNew: boolean): SaveLocation {
  const toast = useToast();
  const create = useCreateLocation();
  const update = useUpdateLocation(id);

  const run = (body: LocationInput) => {
    if (isNew) {
      create.mutate(body, {
        onSuccess: (row) => {
          ctx.open(DETAIL_KEY, { id: row.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${body.name ?? 'Place'} added`, type: 'success' });
          });
        },
      });
      return;
    }
    update.mutate(body, {
      onSuccess: () => {
        toast.add({ title: 'Saved', type: 'success' });
      },
    });
  };

  return {
    run,
    isPending: create.isPending || update.isPending,
    error:
      create.isError || update.isError
        ? schedulingErrorMessage(
            create.error ?? update.error,
            'Nothing was saved. Try again in a moment.'
          )
        : null,
    created: create.isSuccess,
  };
}

/** Removing a place, with the confirmation that has to name what is filed here.
 *  People and services are KEPT when a place goes — they just stop being tied to
 *  one — and a dialog that does not say so reads like it is about to delete
 *  them. */
export function useRemoveLocation(
  ctx: SurfaceContext,
  id: string,
  existing: BusinessLocation | null
): { run: () => void; isPending: boolean } {
  const toast = useToast();
  const confirm = useConfirm();
  const remove = useDeleteLocation(id);
  const filedElsewhere = (existing?.counts.resources ?? 0) + (existing?.counts.services ?? 0);

  const run = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${existing.name}?`,
      description:
        filedElsewhere > 0
          ? `${String(filedElsewhere)} of your people, things and services are filed here. They are kept, but they stop being tied to a place until you re-file them. This cannot be undone.`
          : 'This takes the place off your list. This cannot be undone.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${existing.name} removed`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return {
    run: () => {
      void run();
    },
    isPending: remove.isPending,
  };
}
