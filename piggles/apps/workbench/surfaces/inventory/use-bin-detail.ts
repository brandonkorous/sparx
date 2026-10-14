import { useEffect, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { physicalLocations, useStockLocations } from './data';
import { useArchiveBin, useBin, useBinContents, useCreateBin, useUpdateBin } from './bins-data';
import { draftFrom, EMPTY, type Draft } from './bin-draft';
import { archiveBin, saveBin } from './bin-save';

export type BinDetailState = ReturnType<typeof useBinDetail>;

interface DraftArgs {
  ctx: SurfaceContext;
  isNew: boolean;
  bin: ReturnType<typeof useBin>;
  activeLocations: ReturnType<typeof physicalLocations>;
}

function useBinDraft({ ctx, isNew, bin, activeLocations }: DraftArgs) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isNew) {
      // Pre-select when there is only one place it could be. A required picker
      // with one option is a question with one answer.
      if (!loaded && activeLocations.length === 1) {
        setDraft((d) => ({ ...d, warehouseId: activeLocations[0]?.id ?? '' }));
        setLoaded(true);
      }
      return;
    }
    if (bin.data && !loaded) {
      setDraft(draftFrom(bin.data));
      setLoaded(true);
      ctx.setTitle(bin.data.code);
    }
  }, [bin.data, isNew, loaded, activeLocations, ctx]);

  const original = bin.data ? draftFrom(bin.data) : EMPTY;
  const changed = JSON.stringify(draft) !== JSON.stringify(isNew ? EMPTY : original);
  const valid = draft.code.trim() !== '' && draft.warehouseId !== '';
  const isSystem = bin.data?.isSystem ?? false;

  useDirtySource(
    changed && valid,
    `The shelf ${draft.code || 'you are adding'} has unsaved changes. Close anyway?`
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return { draft, setLoaded, changed, valid, isSystem, set };
}

export function useBinDetail(ctx: SurfaceContext) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';

  const toast = useToast();
  const confirm = useConfirm();
  const bin = useBin(isNew ? undefined : id);
  const contents = useBinContents(isNew ? undefined : id);
  const locations = useStockLocations();
  const create = useCreateBin();
  const update = useUpdateBin();
  const archive = useArchiveBin();

  // A shelf is screwed to a wall somewhere. A virtual location has no walls.
  const activeLocations = physicalLocations(locations.data?.items ?? []);
  const form = useBinDraft({ ctx, isNew, bin, activeLocations });
  const { draft, valid, setLoaded } = form;

  const submit = () => {
    saveBin({ ctx, id, isNew, draft, valid, setLoaded, create, update, toast });
  };
  const onArchive = () => archiveBin({ ctx, id, bin, confirm, archive, toast });

  const saving = create.isPending || update.isPending;
  return { id, isNew, bin, contents, activeLocations, ...form, saving, submit, onArchive };
}
