'use client';

// The state behind one supplier's pane: the record, the form as typed, whether
// it differs from what is saved, and the save and retire actions.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { supplierInputFrom, type SupplierFormFields } from './supplier-input';
import { CODE_PATTERN, EMPTY_FORM, formFrom, type SetSupplierField } from './supplier-detail-model';
import { createSupplier, retireSupplier, updateSupplier } from './supplier-detail-save';
import {
  useArchiveSupplier,
  useCreateSupplier,
  useSupplier,
  useUpdateSupplier,
  type SupplierDetail,
} from './suppliers-data';

function useSupplierForm(isNew: boolean, data: SupplierDetail | undefined) {
  const [form, setForm] = useState<SupplierFormFields>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<SupplierFormFields>(EMPTY_FORM);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once the record lands, and keep that snapshot as the baseline
  // so "dirty" means "different from what is saved", not "non-empty".
  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (data && !loaded) {
      const next = formFrom(data);
      setForm(next);
      setBaseline(next);
      setLoaded(true);
    }
  }, [isNew, data, loaded]);

  // Whether she has typed anything yet: an error under an untouched field reads
  // as a telling-off before the first keystroke.
  const [touched, setTouched] = useState(false);

  const set: SetSupplierField = (key, value) => {
    setTouched(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  return { form, setBaseline, loaded, touched, set, dirty };
}

interface SaveArgs {
  ctx: SurfaceContext;
  id: string;
  isNew: boolean;
  form: SupplierFormFields;
  canSave: boolean;
  setBaseline: (form: SupplierFormFields) => void;
}

function useSupplierSave({ ctx, id, isNew, form, canSave, setBaseline }: SaveArgs) {
  const toast = useToast();
  const create = useCreateSupplier();
  const update = useUpdateSupplier(id);

  const save = () => {
    if (!canSave) return;
    const deps = {
      ctx,
      toast,
      input: supplierInputFrom(form),
      rebase: () => {
        setBaseline(form);
      },
    };
    if (isNew) createSupplier(create, deps);
    else updateSupplier(update, deps);
  };
  return { save, saving: create.isPending || update.isPending };
}

function useSupplierRetire(ctx: SurfaceContext, id: string, data: SupplierDetail | undefined) {
  const toast = useToast();
  const confirm = useConfirm();
  const archive = useArchiveSupplier(id);
  const onArchive = () => retireSupplier(data, { ctx, toast, confirm, archive });
  return { onArchive, archiving: archive.isPending };
}

export function useSupplierDetail(ctx: SurfaceContext) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const supplier = useSupplier(id);
  const editor = useSupplierForm(isNew, supplier.data);

  useEffect(() => {
    ctx.setTitle(isNew ? 'New supplier' : (supplier.data?.name ?? 'Supplier'));
  }, [ctx, isNew, supplier.data?.name]);

  const { form, dirty, loaded } = editor;
  const nameOk = form.name.trim() !== '';
  const codeOk = form.code.trim() !== '' && CODE_PATTERN.test(form.code.trim());
  const canSave = nameOk && codeOk && (isNew || dirty);

  useDirtySource(
    dirty && loaded,
    isNew
      ? 'This supplier has not been saved yet. Close anyway?'
      : `Changes to ${form.name || 'this supplier'} have not been saved. Close anyway?`
  );

  const writes = useSupplierSave({
    ctx,
    id,
    isNew,
    form,
    canSave,
    setBaseline: editor.setBaseline,
  });
  const retire = useSupplierRetire(ctx, id, supplier.data);
  return { id, isNew, supplier, ...editor, codeOk, canSave, ...writes, ...retire };
}

export type SupplierDetailState = ReturnType<typeof useSupplierDetail>;
