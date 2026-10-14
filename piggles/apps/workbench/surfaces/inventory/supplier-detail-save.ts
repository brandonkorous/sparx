// Writing a supplier: adding a new one, saving changes to one, and retiring one.
// Each says what happened in a toast once the pane has settled.

import type { useToast } from '@wizeworks/silicaui-react';
import { afterPaneChange } from '../../lib/defer';
import type { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  buyingErrorMessage,
  type SupplierDetail,
  type SupplierInput,
  type useArchiveSupplier,
  type useCreateSupplier,
  type useUpdateSupplier,
} from './suppliers-data';

type Toast = ReturnType<typeof useToast>;

interface SaveDeps {
  ctx: SurfaceContext;
  toast: Toast;
  input: SupplierInput;
  rebase: () => void;
}

export function createSupplier(create: ReturnType<typeof useCreateSupplier>, deps: SaveDeps) {
  const { ctx, toast, input, rebase } = deps;
  create.mutate(input, {
    onSuccess: (result) => {
      // Rebased BEFORE the pane swap: `target: 'replace'` keeps this pane mounted,
      // so a baseline left at EMPTY would keep a safely written record dirty forever.
      rebase();
      ctx.open('inventory.suppliers.detail', { id: result.id }, { target: 'replace' });
      afterPaneChange(() => {
        toast.add({
          title: `${input.name} added`,
          description: 'You can now record what you buy from them and raise orders.',
          type: 'success',
        });
      });
    },
    onError: (error) => {
      toast.add({
        title: 'Could not add that supplier',
        description: buyingErrorMessage(error, 'Nothing was saved.'),
        type: 'error',
      });
    },
  });
}

export function updateSupplier(update: ReturnType<typeof useUpdateSupplier>, deps: SaveDeps) {
  const { toast, input, rebase } = deps;
  update.mutate(input, {
    onSuccess: () => {
      rebase();
      afterPaneChange(() => {
        toast.add({ title: `${input.name} saved`, type: 'success' });
      });
    },
    onError: (error) => {
      toast.add({
        title: 'Could not save that supplier',
        description: buyingErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}

interface RetireDeps {
  ctx: SurfaceContext;
  toast: Toast;
  confirm: ReturnType<typeof useConfirm>;
  archive: ReturnType<typeof useArchiveSupplier>;
}

export async function retireSupplier(supplier: SupplierDetail | undefined, deps: RetireDeps) {
  const { ctx, toast, confirm, archive } = deps;
  if (!supplier) return;
  const ok = await confirm({
    title: `Retire ${supplier.name}?`,
    description:
      'They stop showing in your active suppliers and you can no longer raise new orders to them. Past orders and everything you have received stay exactly as they are. You can still find them by including archived suppliers.',
    confirmLabel: 'Retire this supplier',
    cancelLabel: 'Keep them active',
    color: 'danger',
  });
  if (!ok) return;
  archive.mutate(undefined, {
    onSuccess: () => {
      ctx.close();
      afterPaneChange(() => {
        toast.add({ title: `${supplier.name} retired`, type: 'success' });
      });
    },
    onError: (error) => {
      // The server refuses while an open PO references them, and its sentence
      // names the exact order, so it is shown verbatim.
      toast.add({
        title: 'Could not retire that supplier',
        description: buyingErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}
