import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { StockLocation } from './data';
import type { CountSchedule } from './planning-data';
import { NEW_DRAFT, draftFromServer, type Draft } from './count-schedule-draft';
import { suggestedScheduleName } from './count-schedule-name';

/** The schedule form's state: seeded once per record, dirty against a baseline. */
export function useCountScheduleDraft(
  id: string,
  isNew: boolean,
  server: CountSchedule | undefined,
  activeLocations: StockLocation[]
) {
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  // What was last SEEDED or SAVED, serialized. Comparing against it lets an
  // undone edit undo the unsaved-work warning too (issue 507).
  const initialRef = useRef<string>(JSON.stringify(NEW_DRAFT));
  // Seed ONCE per record: a refetch mid-edit must not overwrite what they typed,
  // and a guard that cannot loop beats a dependency array. `save` resets it.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (server) {
      if (seededFor.current === id) return;
      seededFor.current = id;
      const seeded: Draft = draftFromServer(server);
      setDraft(seeded);
      initialRef.current = JSON.stringify(seeded);
      return;
    }
    if (isNew && activeLocations.length > 0) {
      // A single-location business never answers a one-answer question. Returning
      // `current` unchanged lets React bail out, so this cannot feed itself.
      setDraft((current) => {
        if (current.warehouseId !== '') return current;
        const withLocation = { ...current, warehouseId: activeLocations[0]?.id ?? '' };
        // The baseline moves with it: a choice they never made is not unsaved work.
        initialRef.current = JSON.stringify(withLocation);
        return withLocation;
      });
    }
  }, [server, id, isNew, activeLocations]);

  const dirty = JSON.stringify(draft) !== initialRef.current;
  useDirtySource(dirty, 'This counting schedule has unsaved changes. Close it anyway?');

  const patch = useSchedulePatch(isNew, setDraft);

  return { draft, patch, initialRef, seededFor };
}

/** Applies a change. A new schedule's name follows its choices until one is
 *  typed, or it is saved under words that no longer fit (sparx issue 253). */
function useSchedulePatch(isNew: boolean, setDraft: Dispatch<SetStateAction<Draft>>) {
  const [nameTyped, setNameTyped] = useState(false);
  return (next: Partial<Draft>) => {
    if (next.name !== undefined) setNameTyped(true);
    setDraft((current) => {
      const merged: Draft = { ...current, ...next };
      return isNew && !nameTyped && next.name === undefined
        ? { ...merged, name: suggestedScheduleName(merged) }
        : merged;
    });
  };
}

export type CountScheduleDraftState = ReturnType<typeof useCountScheduleDraft>;
