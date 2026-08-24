'use client';

// Saving a person, marking them as having left, and the delete that is only
// ever for a record made by mistake.

import { useToast } from '@wizeworks/silicaui-react';

import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  staffErrorMessage,
  useArchiveMember,
  useDeleteMember,
  useSaveMember,
  type StaffMember,
} from './data';
import { toDraft, type FormState } from './person-form';

export function usePersonWrites({
  ctx,
  id,
  isNew,
  person,
  onSaved,
}: {
  ctx: SurfaceContext;
  id: string;
  isNew: boolean;
  person: StaffMember | undefined;
  /** Rebase the dirty baseline. Called BEFORE the pane swap, and on both paths:
   *  `target: 'replace'` changes this pane's params in place rather than
   *  remounting it, so the load effect never re-runs and a baseline left at
   *  EMPTY would keep the pane dirty forever — a saved person carrying an
   *  unsaved dot and a leave-guard on the way out. */
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const save = useSaveMember(id);
  const archive = useArchiveMember();
  const remove = useDeleteMember();

  const onSave = (form: FormState) => {
    save.mutate(toDraft(form), {
      onSuccess: (result) => {
        onSaved();
        if (isNew) {
          ctx.open('staff.person', { id: result.id }, { target: 'replace' });
        }
        afterPaneChange(() => {
          toast.add({ title: isNew ? 'Added to your team' : 'Saved', type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: isNew ? 'Could not add them' : 'Could not save',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onArchive = async (archived: boolean) => {
    if (!person) return;
    if (archived) {
      const ok = await confirm({
        title: `Mark ${person.name} as having left?`,
        description:
          'They come off the roster and out of the schedule. Every hour they have worked stays exactly where it is — last year’s profit figure still adds up, and you can bring them back at any time.',
        confirmLabel: 'They have left',
        cancelLabel: 'Cancel',
        color: 'warning',
      });
      if (!ok) return;
    }
    archive.mutate(
      { id: person.id, archived },
      {
        onError: (error) => {
          toast.add({
            title: 'Could not change that',
            description: staffErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDelete = async () => {
    if (!person) return;
    const ok = await confirm({
      title: `Delete ${person.name} completely?`,
      description:
        'This is for a record created by mistake. It removes their timesheet, shifts, qualifications and paperwork. Wage costs already filed against your spending are NOT removed — deleting spend is a decision you make on the spending screen. This cannot be undone.',
      confirmLabel: 'Delete the record',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(person.id, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: 'Record deleted', type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete that record',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return { save, archive, remove, onSave, onArchive, onDelete };
}
