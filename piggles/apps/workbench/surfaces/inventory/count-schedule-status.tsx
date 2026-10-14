'use client';

// A counting schedule's heading, its open-count warning, its history, and
// the Save and Delete buttons.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Heading,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { faCalendarClock, faFloppyDisk, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { plural } from './data';
import {
  cadenceLabel,
  type CountSchedule,
  type scheduleState,
  type useCountSchedule,
} from './planning-data';
import { isDue } from './count-schedule-draft';

// Still loading, or not there (deleted, or another business's link): said
// plainly, rather than an empty form that would save as nothing (issue 226).
export function CountScheduleUnavailable({
  existing,
}: {
  existing: ReturnType<typeof useCountSchedule>;
}) {
  if (existing.isLoading) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading the schedule…" />
      </div>
    );
  }
  return (
    <div className={PANE_SHELL}>
      <PaneLoadError
        {...(existing.isError ? { error: existing.error } : { reason: 'missing' as const })}
        noun="count schedule"
        title="Could not load this schedule"
        description="This is a problem reaching the server. The schedule itself is unaffected. Nothing has been changed or lost."
        onRetry={() => {
          void existing.refetch();
        }}
      />
    </div>
  );
}

export function CountScheduleHeader({
  isNew,
  state,
}: {
  isNew: boolean;
  state: ReturnType<typeof scheduleState> | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading level={2} className="text-lg">
        {isNew ? 'Set up a counting schedule' : 'Counting schedule'}
      </Heading>
      {state ? (
        <Badge color={state.tone} variant="soft">
          {state.label}
        </Badge>
      ) : null}
    </div>
  );
}

export function OpenCountAlert({ countNumber }: { countNumber: string | null }) {
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>The last count from this schedule is still open</AlertTitle>
        <AlertDescription>
          Count {countNumber} has not been posted, so no new count will be created until it is. Two
          open counts over the same shelves produce two sets of expected figures for one lot of
          stock, and posting the second silently undoes the first.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export function CountScheduleHistory({ schedule }: { schedule: CountSchedule }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <Heading level={3} className="text-base">
        <Icon
          glyph={faCalendarClock}
          className="mr-1 inline size-4 align-text-bottom"
          aria-hidden
        />
        History
      </Heading>
      <Text className="text-sm">
        {cadenceLabel(schedule.cadence, schedule.intervalDays)} ·{' '}
        {plural(schedule.coveredLevels, 'item', 'items')} currently covered
      </Text>
      <Text className="text-sm">
        Last run:{' '}
        {schedule.lastRunAt ? <Timestamp value={schedule.lastRunAt} format="relative" /> : 'never'}
        {schedule.lastCountNumber ? ` (count ${schedule.lastCountNumber})` : ''}
      </Text>
      <Text className="text-sm">
        {/* A past date under "Next run" reads as broken: a fresh schedule is due
            at once and said "7 seconds ago". Overdue is a state, not a timestamp. */}
        {isDue(schedule.nextRunAt) ? (
          <>Next run: due now. It will be picked up on the next nightly pass.</>
        ) : (
          <>
            Next run: <Timestamp value={schedule.nextRunAt} format="relative" />
          </>
        )}
      </Text>
    </Card>
  );
}

interface FooterProps {
  isNew: boolean;
  canSave: boolean;
  saving: boolean;
  deleting: boolean;
  onSave: () => void;
  onDelete: () => void;
}

export function CountScheduleFooter(props: FooterProps) {
  const { isNew, canSave, saving, deleting, onSave, onDelete } = props;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button color="module" disabled={!canSave} loading={saving} onClick={onSave}>
        <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
        {isNew ? 'Set it up' : 'Save changes'}
      </Button>
      {!isNew ? (
        <Button
          className="ml-auto"
          variant="ghost"
          color="danger"
          loading={deleting}
          onClick={onDelete}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          Delete
        </Button>
      ) : null}
    </div>
  );
}
