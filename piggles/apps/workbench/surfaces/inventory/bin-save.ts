import type { useToast } from '@wizeworks/silicaui-react';
import type { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural, stockErrorMessage } from './data';
import type { useArchiveBin, useBin, useCreateBin, useUpdateBin } from './bins-data';
import { payloadFrom, type Draft } from './bin-draft';

type Toast = ReturnType<typeof useToast>;

interface SaveArgs {
  ctx: SurfaceContext;
  id: string;
  isNew: boolean;
  draft: Draft;
  valid: boolean;
  setLoaded: (loaded: boolean) => void;
  create: ReturnType<typeof useCreateBin>;
  update: ReturnType<typeof useUpdateBin>;
  toast: Toast;
}

export function saveBin({
  ctx,
  id,
  isNew,
  draft,
  valid,
  setLoaded,
  create,
  update,
  toast,
}: SaveArgs) {
  if (!valid) return;
  const payload = payloadFrom(draft);

  const onError = (error: unknown) => {
    toast.add({
      title: 'Could not save that shelf',
      description: stockErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  if (isNew) {
    create.mutate(payload, {
      onSuccess: (saved) => {
        setLoaded(false);
        ctx.open('inventory.bins.detail', { id: saved.id }, { target: 'replace' });
        afterPaneChange(() => {
          toast.add({ title: `${saved.code} added`, type: 'success' });
        });
      },
      onError,
    });
    return;
  }

  update.mutate(
    { id, ...payload },
    {
      onSuccess: () => {
        setLoaded(false);
        toast.add({ title: `${payload.code} saved`, type: 'success' });
      },
      onError,
    }
  );
}

interface ArchiveArgs {
  ctx: SurfaceContext;
  id: string;
  bin: ReturnType<typeof useBin>;
  confirm: ReturnType<typeof useConfirm>;
  archive: ReturnType<typeof useArchiveBin>;
  toast: Toast;
}

export async function archiveBin({ ctx, id, bin, confirm, archive, toast }: ArchiveArgs) {
  const held = bin.data?.unitCount ?? 0;
  const ok = await confirm({
    title: `Remove ${bin.data?.code ?? 'this shelf'}?`,
    description:
      held > 0
        ? held === 1
          ? 'It still holds 1 unit. Move it to another shelf first, otherwise it stays counted in your totals but nobody can find it.'
          : `It still holds ${plural(held, 'unit', 'units')}. Move them to another shelf first, otherwise they stay counted in your totals but nobody can find them.`
        : 'It will stop appearing in shelf pickers. Its history is kept.',
    confirmLabel: 'Remove it',
    cancelLabel: 'Keep it',
    color: 'danger',
  });
  if (!ok) return;
  archive.mutate(id, {
    onSuccess: () => {
      ctx.close();
    },
    onError: (error) => {
      toast.add({
        title: 'Could not remove that shelf',
        description: stockErrorMessage(error, 'Nothing was changed.'),
        type: 'error',
      });
    },
  });
}
