'use client';

// State, checks and writes for the record-type editor in object-type-detail.tsx.
// Explicit save, one button, last-write-wins: nothing is written until Save.

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import {
  keyFromLabel,
  useArchiveObjectType,
  useCreateObjectType,
  useObjectType,
  useUpdateObjectType,
  type CrmObjectType,
  type PropertyField,
} from './object-types-data';
import {
  EMPTY_DRAFT,
  draftFromType,
  newUid,
  snapshotOf,
  type Draft,
  type DraftField,
} from './object-type-draft';
import { putAwayOp, saveDraft } from './object-type-save';

function useDraftState(type: CrmObjectType | undefined, isNew: boolean) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Stops the guessed plural from overwriting one they typed themselves.
  const [pluralTouched, setPluralTouched] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** What the draft looked like when it was last in agreement with the server. */
  const [baseline, setBaseline] = useState(() => snapshotOf(EMPTY_DRAFT));

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (!type) return;
    const next = draftFromType(type);
    setDraft(next);
    setBaseline(snapshotOf(next));
    setLoaded(true);
  }, [type, isNew]);

  // Explicit save means the pane can be closed with work in it, so it has to say
  // so — a record type someone spent five minutes describing is exactly the kind
  // of thing the workbench's unsaved-work guard exists for.
  const snapshot = useMemo(() => snapshotOf(draft), [draft]);
  const dirty = loaded && snapshot !== baseline;
  useDirtySource(dirty, 'This thing you track has changes you have not saved. Close it anyway?');
  return {
    draft,
    setDraft,
    pluralTouched,
    setPluralTouched,
    loaded,
    expanded,
    setExpanded,
    setBaseline,
    snapshot,
    dirty,
  };
}

// The tab names the type by its PLURAL, like the list row she clicked. Read off
// the draft, so renaming one renames its tab as she types.
function useTabTitle(ctx: SurfaceContext, isNew: boolean, draft: Draft) {
  useEffect(() => {
    ctx.setTitle(
      isNew
        ? 'New thing to track'
        : draft.labelPlural.trim() || draft.label.trim() || 'Thing you track'
    );
  }, [ctx, isNew, draft.labelPlural, draft.label]);
}

function useDraftChecks(draft: Draft, isNew: boolean) {
  const nameError =
    draft.label.trim() === '' ? 'Give this thing you track a name, like "Project".' : null;
  const keyError =
    isNew && draft.key.trim() !== '' && !/^[a-z][a-z0-9_]*$/.test(draft.key.trim())
      ? 'Use lowercase letters, numbers and underscores, starting with a letter.'
      : null;
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const { field } of draft.fields) {
      if (seen.has(field.key)) dupes.add(field.key);
      seen.add(field.key);
    }
    return dupes;
  }, [draft.fields]);

  const blocked =
    nameError ?? keyError ?? (duplicateKeys.size > 0 ? 'Two details share a name.' : null);
  return { nameError, keyError, duplicateKeys, blocked };
}

function fieldOps(
  draft: Draft,
  setDraft: Dispatch<SetStateAction<Draft>>,
  setExpanded: Dispatch<SetStateAction<string | null>>
) {
  const setField = (index: number, next: PropertyField) => {
    setDraft((d) => ({
      ...d,
      fields: d.fields.map((row, i) => (i === index ? { ...row, field: next } : row)),
    }));
  };

  const addField = () => {
    const label = `Detail ${String(draft.fields.length + 1)}`;
    const row: DraftField = {
      uid: newUid(),
      field: { key: keyFromLabel(label), label, type: 'text' },
    };
    setDraft((d) => ({ ...d, fields: [...d.fields, row] }));
    setExpanded(row.uid);
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.fields.length) return;
    setDraft((d) => {
      const next = [...d.fields];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);
      return { ...d, fields: next };
    });
  };
  return { setField, addField, moveField };
}

function removeFieldOp(
  draft: Draft,
  setDraft: Dispatch<SetStateAction<Draft>>,
  confirm: ReturnType<typeof useConfirm>
) {
  return async (index: number) => {
    const field = draft.fields[index]?.field;
    if (!field) return;
    const ok = await confirm({
      title: `Remove "${field.label}"?`,
      description:
        'It disappears from every one of these records. What was already filled in is kept, so adding it back brings the values with it.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    setDraft((d) => ({ ...d, fields: d.fields.filter((_, i) => i !== index) }));
  };
}

export function useObjectTypeEditor(ctx: SurfaceContext) {
  // Pane params arrive on the context, not as a prop — same as every other
  // detail surface in the app.
  const objectKey = typeof ctx.params.key === 'string' ? ctx.params.key : 'new';
  const isNew = objectKey === 'new';
  const toast = useToast();
  const confirm = useConfirm();

  const query = useObjectType(objectKey);
  const create = useCreateObjectType();
  const update = useUpdateObjectType(objectKey);
  const archive = useArchiveObjectType(objectKey);

  const state = useDraftState(query.data, isNew);
  useTabTitle(ctx, isNew, state.draft);
  const isBuiltin = query.data?.kind === 'builtin';
  const checks = useDraftChecks(state.draft, isNew);
  const saving = create.isPending || update.isPending;
  const ops = fieldOps(state.draft, state.setDraft, state.setExpanded);
  const removeField = removeFieldOp(state.draft, state.setDraft, confirm);
  const putAway = putAwayOp(state.draft, confirm, archive, toast);

  async function save() {
    const { draft, snapshot, setBaseline } = state;
    await saveDraft({ ctx, isNew, draft, snapshot, create, update, setBaseline, toast });
  }

  return {
    isNew,
    query,
    isBuiltin,
    saving,
    save,
    removeField,
    putAway,
    ...state,
    ...checks,
    ...ops,
  };
}

/** Everything the record-type editor's parts read and call. */
export type ObjectTypeEditor = ReturnType<typeof useObjectTypeEditor>;
