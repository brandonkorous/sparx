import { useEffect, useMemo } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { physicalLocations, useStockLocations } from './data';
import {
  useCountSchedule,
  useCountScheduleCoverage,
  useDeleteCountSchedule,
  useSaveCountSchedule,
} from './planning-data';
import { useCountScheduleDraft } from './use-count-schedule-draft';
import { deleteSchedule, saveSchedule } from './count-schedule-save';

// The tab's name, once the record is here, so tabs do not all read the same.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
function useScheduleTitle(ctx: SurfaceContext, scheduleName: string | undefined) {
  useEffect(() => {
    if (scheduleName) ctx.setTitle(scheduleName);
  }, [scheduleName, ctx]);
}

/** Everything the counting-schedule detail surface reads and does. */
export function useCountScheduleDetail(ctx: SurfaceContext) {
  const id = ctx.params.id ?? 'new';
  const isNew = id === 'new';

  const locations = useStockLocations();
  // MEMOIZED: it is a dependency of the seeding effect, and a fresh array every
  // render looped that effect into "Maximum update depth exceeded". Somewhere a
  // person can walk with a scanner. Nobody counts "In transit".
  const activeLocations = useMemo(
    () => physicalLocations(locations.data?.items ?? []),
    [locations.data]
  );

  const existing = useCountSchedule(id);
  useScheduleTitle(ctx, existing.data?.name);
  const save = useSaveCountSchedule(id);
  const remove = useDeleteCountSchedule();
  const confirm = useConfirm();
  const toast = useToast();

  const { draft, patch, initialRef, seededFor } = useCountScheduleDraft(
    id,
    isNew,
    existing.data,
    activeLocations
  );

  // Asked as the setup is typed, so "this covers nothing" arrives before Set it
  // up rather than after.
  const coverage = useCountScheduleCoverage(draft.warehouseId, draft.abcClass, draft.zoneName);

  return {
    isNew,
    existing,
    activeLocations,
    draft,
    patch,
    coverage,
    saving: save.isPending,
    deleting: remove.isPending,
    onSave: () => saveSchedule({ ctx, isNew, draft, save, toast, initialRef, seededFor }),
    onDelete: () => {
      void deleteSchedule({ ctx, id, draft, remove, confirm, toast });
    },
  };
}
