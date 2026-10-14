// Saving and deleting a counting schedule, with the toasts that report each.

import type { useToast } from '@wizeworks/silicaui-react';
import type { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { stockErrorMessage } from './data';
import type { useDeleteCountSchedule, useSaveCountSchedule } from './planning-data';
import { toSavePayload, type Draft } from './count-schedule-draft';
import type { CountScheduleDraftState } from './use-count-schedule-draft';

interface SaveArgs {
  ctx: SurfaceContext;
  isNew: boolean;
  draft: Draft;
  save: ReturnType<typeof useSaveCountSchedule>;
  toast: ReturnType<typeof useToast>;
  initialRef: CountScheduleDraftState['initialRef'];
  seededFor: CountScheduleDraftState['seededFor'];
}

export function saveSchedule({ ctx, isNew, draft, save, toast, initialRef, seededFor }: SaveArgs) {
  save.mutate(toSavePayload(draft, isNew), {
    onSuccess: (saved) => {
      // Nothing to protect any more, and the re-seed below will set the
      // baseline properly from what the server actually stored.
      initialRef.current = JSON.stringify(draft);
      // Let the refetch re-seed the form: the one moment server data SHOULD
      // win, since there are no unsaved edits left to protect.
      seededFor.current = null;
      toast.add({
        title: isNew ? 'Schedule set up' : 'Schedule saved',
        description: `${saved.name}: next count ${new Date(saved.nextRunAt).toLocaleDateString()}.`,
        type: 'success',
      });
      if (isNew)
        ctx.open('inventory.count-schedules.detail', { id: saved.id }, { target: 'replace' });
    },
    onError: (error) => {
      toast.add({
        title: 'Could not save that schedule',
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    },
  });
}

interface DeleteArgs {
  ctx: SurfaceContext;
  id: string;
  draft: Draft;
  remove: ReturnType<typeof useDeleteCountSchedule>;
  confirm: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
}

export async function deleteSchedule({ ctx, id, draft, remove, confirm, toast }: DeleteArgs) {
  const ok = await confirm({
    title: `Delete “${draft.name}”?`,
    description:
      'The counts it has already created are kept. They are the record that counting happened. What stops is the counting itself: nothing will create the next one.',
    confirmLabel: 'Delete the schedule',
    cancelLabel: 'Keep it',
    color: 'danger',
  });
  if (!ok) return;
  remove.mutate(id, {
    onSuccess: () => {
      // No baseline update needed: a surface closing ITSELF goes through
      // controller.close, which drops the guards before closing.
      toast.add({ title: 'Schedule deleted', type: 'success' });
      ctx.close();
    },
    onError: (error) => {
      toast.add({
        title: 'Could not delete that schedule',
        description: stockErrorMessage(error, 'Nothing was changed. Please try again.'),
        type: 'error',
      });
    },
  });
}
