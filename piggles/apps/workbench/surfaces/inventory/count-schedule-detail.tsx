'use client';

// ONE COUNTING SCHEDULE: set it up, or change it. `{id:'new'}` renders exactly
// what `{id}` renders, so the form exists once; a create modal was never an
// option here. The defaults it opens with are the advice (count-schedule-draft).

import { PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { scheduleState } from './planning-data';
import { coverageWords } from './count-schedule-draft';
import { useCountScheduleDetail } from './use-count-schedule-detail';
import { CountScheduleCoverageCard, CountScheduleNameCard } from './count-schedule-setup-cards';
import { CountScheduleCadenceCard } from './count-schedule-cadence';
import {
  CountScheduleFooter,
  CountScheduleHeader,
  CountScheduleHistory,
  CountScheduleUnavailable,
  OpenCountAlert,
} from './count-schedule-status';

export function CountScheduleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const view = useCountScheduleDetail(ctx);
  const { isNew, existing, draft, patch } = view;

  if (!isNew && (existing.isLoading || !existing.data)) {
    return <CountScheduleUnavailable existing={existing} />;
  }

  const { narrowedBy, widenSentence } = coverageWords(draft);
  const canSave = draft.name.trim().length > 0 && draft.warehouseId !== '';
  const state = existing.data ? scheduleState(existing.data) : null;

  return (
    <div className={PANE_SHELL_SCROLL}>
      <CountScheduleHeader isNew={isNew} state={state} />
      {existing.data?.lastCountOpen ? (
        <OpenCountAlert countNumber={existing.data.lastCountNumber} />
      ) : null}
      <CountScheduleNameCard
        draft={draft}
        patch={patch}
        isNew={isNew}
        activeLocations={view.activeLocations}
      />
      <CountScheduleCoverageCard
        draft={draft}
        patch={patch}
        coverage={view.coverage.data}
        narrowedBy={narrowedBy}
        widenSentence={widenSentence}
      />
      <CountScheduleCadenceCard draft={draft} patch={patch} isNew={isNew} />
      {existing.data ? <CountScheduleHistory schedule={existing.data} /> : null}
      <CountScheduleFooter
        isNew={isNew}
        canSave={canSave}
        saving={view.saving}
        deleting={view.deleting}
        onSave={view.onSave}
        onDelete={view.onDelete}
      />
    </div>
  );
}
