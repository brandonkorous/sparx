// The record-type editor's writes: save the draft (create or edit) and put a type away.

import type { useToast } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { useConfirm } from '../../lib/confirm';
import {
  keyFromLabel,
  objectTypeErrorMessage,
  type useArchiveObjectType,
  type useCreateObjectType,
  type useUpdateObjectType,
} from './object-types-data';
import type { Draft } from './object-type-draft';

export interface SaveDeps {
  ctx: SurfaceContext;
  isNew: boolean;
  draft: Draft;
  snapshot: string;
  create: ReturnType<typeof useCreateObjectType>;
  update: ReturnType<typeof useUpdateObjectType>;
  setBaseline: (snapshot: string) => void;
  toast: ReturnType<typeof useToast>;
}

export async function saveDraft({
  ctx,
  isNew,
  draft,
  snapshot,
  create,
  update,
  setBaseline,
  toast,
}: SaveDeps) {
  const payload = {
    label: draft.label.trim(),
    labelPlural: (draft.labelPlural.trim() || draft.label.trim()) + '',
    description: draft.description.trim() || null,
    propertySchema: { fields: draft.fields.map((row) => row.field) },
    primaryFieldKey: draft.primaryFieldKey.trim() || null,
  };

  try {
    if (isNew) {
      const created = await create.mutateAsync({
        ...payload,
        key: draft.key.trim() || keyFromLabel(draft.label).toLowerCase(),
      });
      // Cleared BEFORE the pane swap, or the guard fires on the way out of a
      // draft that has just been written.
      setBaseline(snapshot);
      toast.add({ title: `${created.labelPlural} added`, type: 'success' });
      ctx.open('crm.object-type.detail', { key: created.key }, { target: 'replace' });
    } else {
      await update.mutateAsync(payload);
      setBaseline(snapshot);
      toast.add({ title: 'Saved', type: 'success' });
    }
  } catch (error) {
    toast.add({
      title: 'Could not save that',
      description: objectTypeErrorMessage(
        error,
        'Something went wrong reaching the server. Nothing has been changed.'
      ),
      type: 'error',
    });
  }
}

/** Asks first, then archives the type: it leaves the sidebar but keeps its records. */
export function putAwayOp(
  draft: Draft,
  confirm: ReturnType<typeof useConfirm>,
  archive: ReturnType<typeof useArchiveObjectType>,
  toast: ReturnType<typeof useToast>
) {
  return async () => {
    const ok = await confirm({
      title: `Put away ${draft.labelPlural || draft.label}?`,
      description:
        'It stops appearing in your sidebar and search. Everything already recorded is kept and comes back if you restore it.',
      confirmLabel: 'Put it away',
      cancelLabel: 'Keep it',
      color: 'warning',
    });
    if (!ok) return;
    await archive.mutateAsync();
    toast.add({ title: 'Put away', type: 'success' });
  };
}
