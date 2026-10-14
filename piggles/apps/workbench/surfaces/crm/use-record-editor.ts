'use client';

// The draft, Save and Remove for one record of a tenant-invented type. Moved out
// of record-detail.tsx (sparx persona issue 240) unchanged.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';

import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useDirtySource } from '../../lib/workbench/dirty';
import { recordErrorMessage, useRecord, useRecordMutations } from './records-data';

type Values = Record<string, unknown>;

function sameBag(a: Values, b: Values): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The values being edited, filled once from the saved record. */
function useRecordDraft(id: string, label: string) {
  const isNew = id === 'new';
  const record = useRecord(id);
  const saved = useMemo<Values>(() => record.data?.values ?? {}, [record.data]);
  const [draft, setDraft] = useState<Values>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (record.data && !loaded) {
      setDraft(saved);
      setLoaded(true);
    }
  }, [isNew, record.data, saved, loaded]);

  const dirty = isNew ? Object.keys(draft).length > 0 : !sameBag(draft, saved);
  useDirtySource(
    dirty,
    isNew
      ? `This ${label.toLowerCase()} has not been created yet. Close anyway?`
      : `This ${label.toLowerCase()} has unsaved changes. Close anyway?`
  );
  return { record, draft, setDraft, dirty, isNew };
}

function useRecordSave(ctx: SurfaceContext, objectKey: string, id: string, label: string) {
  const { create, update } = useRecordMutations(objectKey);
  const toast = useToast();
  const failed = (title: string) => (error: unknown) => {
    toast.add({
      title,
      description: recordErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };
  const submit = (draft: Values): void => {
    if (id === 'new') {
      create.mutate(draft, {
        onSuccess: (created) => {
          toast.add({ title: `${label} added`, type: 'success' });
          // Become the record we just made, rather than opening a second pane
          // for it — the person is already looking at this one.
          ctx.open('crm.record.detail', { id: created.id, objectKey }, { target: 'replace' });
        },
        onError: failed(`Could not add this ${label.toLowerCase()}`),
      });
      return;
    }
    update.mutate(
      { id, values: draft },
      {
        onSuccess: () => {
          toast.add({ title: 'Saved', type: 'success' });
        },
        onError: failed('Could not save'),
      }
    );
  };
  return { submit, saving: create.isPending || update.isPending };
}

function useRecordRemove(ctx: SurfaceContext, objectKey: string, id: string, label: string) {
  const { remove } = useRecordMutations(objectKey);
  const toast = useToast();
  const confirm = useConfirm();
  return async (title: string): Promise<void> => {
    const ok = await confirm({
      title: `Remove ${title || `this ${label.toLowerCase()}`}?`,
      description:
        'It comes out of your lists. Anything linked to it keeps its own history, and you can add it again later.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${label} removed`, type: 'success' });
        });
      },
    });
  };
}

export function useRecordEditor(ctx: SurfaceContext, objectKey: string, id: string, label: string) {
  const draft = useRecordDraft(id, label);
  const save = useRecordSave(ctx, objectKey, id, label);
  const onDelete = useRecordRemove(ctx, objectKey, id, label);
  return { ...draft, ...save, onDelete };
}
