'use client';

// What the service form KNOWS and DOES: the draft, whether it can be saved, and
// the two writes. Split out of service-detail.tsx (RULE #0.5), which after this
// owns only what the form looks like.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';

import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { moneyProblem } from '../../components/money-input';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { draftsEqual, payloadFrom, type Draft } from './service-draft';
import { useServiceLosses, removalConsequence } from './service-removal';
import {
  schedulingErrorMessage,
  useCreateService,
  useDeleteService,
  useUpdateService,
  type SchedulingService,
} from './setup-data';

const DETAIL_KEY = 'scheduling.services.detail';

export interface ServiceEditorState {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  priceProblem: string | null;
  canSave: boolean;
  busy: boolean;
  removing: boolean;
  saveError: string | null;
  submit: () => void;
  onRemove: () => void;
}

export function useServiceEditor(
  ctx: SurfaceContext,
  id: string,
  initial: Draft,
  existing: SchedulingService | null
): ServiceEditorState {
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = id === 'new';

  const create = useCreateService();
  const update = useUpdateService(id);
  const remove = useDeleteService(id);
  // What removing this would actually cost, counted before it is offered.
  const losses = useServiceLosses(isNew ? null : id);

  const [draft, setDraft] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    ctx.setTitle(isNew ? 'New service' : draft.name.trim() || 'Service');
  }, [ctx, isNew, draft.name]);

  // A price nobody can read must not be saved as free (086) — the field says
  // what is wrong and Save waits until it is.
  const priceProblem = moneyProblem(draft.price);
  const changed = useMemo(() => !draftsEqual(draft, initial), [draft, initial]);
  const busy = create.isPending || update.isPending;

  useDirtySource(
    changed && !create.isSuccess,
    isNew
      ? 'This new service has not been saved yet. Close anyway?'
      : `${initial.name || 'This service'} has unsaved changes. Close anyway?`
  );

  const submit = () => {
    const body = payloadFrom(draft);
    if (isNew) {
      create.mutate(body, {
        onSuccess: (row) => {
          ctx.open(DETAIL_KEY, { id: row.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: `${body.name} added`, type: 'success' });
          });
        },
      });
      return;
    }
    update.mutate(body, {
      onSuccess: () => {
        toast.add({ title: 'Service saved', type: 'success' });
      },
    });
  };

  const onRemove = () => {
    if (!existing) return;
    void confirm({
      title: `Remove ${existing.name}?`,
      description: removalConsequence(losses),
      confirmLabel: 'Remove this service',
      cancelLabel: 'Keep it',
      color: 'danger',
    }).then((ok) => {
      if (ok) doRemove(existing.name);
    });
  };

  const doRemove = (name: string) => {
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({
            title: `${name} removed`,
            description: 'You can put it back from your services list.',
            type: 'success',
          });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not remove this service',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return {
    draft,
    set,
    priceProblem,
    canSave:
      draft.name.trim() !== '' &&
      draft.durationMinutes >= 1 &&
      priceProblem === null &&
      changed &&
      !busy,
    busy,
    removing: remove.isPending,
    saveError:
      create.isError || update.isError
        ? schedulingErrorMessage(
            create.error ?? update.error,
            'Nothing was saved. Try again in a moment.'
          )
        : null,
    submit,
    onRemove,
  };
}
