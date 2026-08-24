'use client';

// The place form: state, chrome, and the four sections in order.

import { useEffect, useMemo, useState } from 'react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { EditorHeader, EditorToolbar } from './location-editor-chrome';
import { RefreshButton } from '../../components/refresh-button';
import { SiteScopeField } from '../../components/site-scope-field';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useBusinessZone } from '../../lib/business-timezone';
import { timezoneOptions } from '../../lib/timezones';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { BusinessLocation } from './setup-data';
import {
  coordinatesOf,
  draftsEqual,
  toPayload,
  type Coordinates,
  type Draft,
} from './location-draft';
import { useRemoveLocation, useSaveLocation } from './location-writes';
import { LocationNameSection, LocationRetireSection } from './location-form';
import { LocationAddressSection } from './location-address';

const COLUMN = 'mx-auto flex w-full max-w-2xl flex-col gap-4';

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

interface BodyProps {
  draft: Draft;
  set: SetField;
  existing: BusinessLocation | null;
  isNew: boolean;
  coordinates: Coordinates;
  saveError: string | null;
  removing: boolean;
  onRemove: () => void;
}

function EditorBody({
  draft,
  set,
  existing,
  isNew,
  coordinates,
  saveError,
  removing,
  onRemove,
}: BodyProps) {
  const zones = useMemo(() => timezoneOptions(draft.timezone), [draft.timezone]);
  // What this place follows when it has no zone of its own. A cached read shared
  // with Business details, so a change there shows here without a refetch.
  const businessZone = useBusinessZone();

  return (
    <div className={COLUMN}>
      <EditorHeader existing={existing} saveError={saveError} />

      <LocationNameSection
        draft={draft}
        set={set}
        zones={zones}
        businessZone={businessZone}
        isNew={isNew}
      />
      <LocationAddressSection draft={draft} set={set} coordinates={coordinates} />
      <SiteScopeField
        value={draft.propertyIds}
        onChange={(next) => {
          set('propertyIds', next);
        }}
        title="Which of your businesses serve from here"
        description="You run more than one website. A single premises can host both businesses, or belong to just one."
        everyLabel="Serves every site"
      />
      <LocationRetireSection
        draft={draft}
        set={set}
        existing={existing}
        removing={removing}
        onRemove={onRemove}
      />
    </div>
  );
}

/** The draft, what is wrong with it, and the two side effects that follow it:
 *  the pane title and the leave-guard. */
function useLocationDraft(
  ctx: SurfaceContext,
  initial: Draft,
  isNew: boolean,
  saved: boolean
): { draft: Draft; set: SetField; coordinates: Coordinates; changed: boolean; valid: boolean } {
  const [draft, setDraft] = useState<Draft>(initial);
  const set: SetField = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    ctx.setTitle(isNew ? 'New place' : draft.name.trim() || 'Place');
  }, [ctx, isNew, draft.name]);

  const coordinates = coordinatesOf(draft);
  const changed = useMemo(() => !draftsEqual(draft, initial), [draft, initial]);

  useDirtySource(
    changed && !saved,
    isNew
      ? 'This new place has not been saved yet. Close anyway?'
      : `${initial.name || 'This place'} has unsaved changes. Close anyway?`
  );

  return {
    draft,
    set,
    coordinates,
    changed,
    valid: draft.name.trim() !== '' && coordinates.error === null,
  };
}

interface EditorProps {
  ctx: SurfaceContext;
  id: string;
  initial: Draft;
  existing: BusinessLocation | null;
  /** Absent on a brand-new place — there is nothing loaded to re-read. */
  isFetching?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
}

export function LocationEditor({
  ctx,
  id,
  initial,
  existing,
  isFetching = false,
  updatedAt,
  onRefresh,
}: EditorProps) {
  const isNew = id === 'new';
  const save = useSaveLocation(ctx, id, isNew);
  const removal = useRemoveLocation(ctx, id, existing);

  const form = useLocationDraft(ctx, initial, isNew, save.created);
  const { draft, set, coordinates } = form;
  const canSave = form.valid && form.changed && !save.isPending;

  return (
    <div className={PANE_SHELL}>
      <EditorToolbar
        isNew={isNew}
        existing={existing}
        canSave={canSave}
        busy={save.isPending}
        onSave={() => {
          if (canSave) save.run(toPayload(draft, coordinates));
        }}
        refresh={
          onRefresh ? (
            <RefreshButton isFetching={isFetching} updatedAt={updatedAt} onRefresh={onRefresh} />
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EditorBody
          draft={draft}
          set={set}
          existing={existing}
          isNew={isNew}
          coordinates={coordinates}
          saveError={save.error}
          removing={removal.isPending}
          onRemove={removal.run}
        />
      </div>
    </div>
  );
}
