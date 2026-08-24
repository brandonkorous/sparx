'use client';

// The person pane's header: whether they are here, whether they are on the
// clock, and the lifecycle actions. Their name is a field in the body, never
// also a heading up here.

import { Badge, Button, Text, useToast } from '@wizeworks/silicaui-react';
import {
  faBoxArchive,
  faClock,
  faCoins,
  faFloppyDisk,
  faTrashCan,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { afterPaneChange } from '../../lib/defer';
import type { useStaffMember } from './data';
import { staffErrorMessage, useClock, type TimeEntry } from './data';
import { formatMinutes, staffState } from './format';
import type { usePersonWrites } from './person-writes';

type PersonQuery = ReturnType<typeof useStaffMember>;

/** Clocking in and out, from the header. Only for somebody who exists and is
 *  still here — there is no shift to start for a person who has left. */
function ClockButton({ id, running }: { id: string; running: TimeEntry | null }) {
  const toast = useToast();
  const { clockIn, clockOut } = useClock();

  const failed = (title: string) => (error: unknown) => {
    toast.add({
      title,
      description: staffErrorMessage(error, 'Nothing was changed.'),
      type: 'error',
    });
  };

  if (running) {
    return (
      <Button
        size="sm"
        variant="outline"
        color="info"
        loading={clockOut.isPending}
        onClick={() => {
          clockOut.mutate(
            { staffMemberId: id },
            {
              onSuccess: (entry) => {
                afterPaneChange(() => {
                  toast.add({
                    title: `Clocked out — ${formatMinutes(entry.minutes)}`,
                    description: 'It is waiting to be approved on the timesheet.',
                    type: 'success',
                  });
                });
              },
              onError: failed('Could not clock out'),
            }
          );
        }}
      >
        Clock out
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      color="info"
      loading={clockIn.isPending}
      onClick={() => {
        clockIn.mutate({ staffMemberId: id }, { onError: failed('Could not clock in') });
      }}
    >
      <Icon glyph={faClock} className="size-4" aria-hidden />
      Clock in
    </Button>
  );
}

export interface PersonToolbarProps {
  id: string;
  isNew: boolean;
  archived: boolean;
  status: string;
  running: TimeEntry | null;
  canSave: boolean;
  person: PersonQuery;
  writes: ReturnType<typeof usePersonWrites>;
  onSave: () => void;
}

export function PersonToolbar(props: PersonToolbarProps) {
  const { id, isNew, archived, running, writes } = props;
  const state = staffState(props.status);

  return (
    <PaneToolbar
      label="Person actions"
      refresh={
        isNew ? undefined : (
          <RefreshButton
            isFetching={props.person.isFetching}
            updatedAt={props.person.data ? props.person.dataUpdatedAt : undefined}
            onRefresh={() => {
              void props.person.refetch();
            }}
          />
        )
      }
    >
      {isNew ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon glyph={faCoins} className="size-4" aria-hidden />
          <Text as="span" className="text-sm font-medium">
            New person
          </Text>
        </span>
      ) : (
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      )}

      {running ? (
        <Badge color="info" size="sm">
          <Icon glyph={faClock} className="size-3.5" aria-hidden />
          On the clock
        </Badge>
      ) : null}

      {!isNew && !archived ? <ClockButton id={id} running={running} /> : null}

      <Button
        size="sm"
        color="module"
        className="ml-auto shrink-0"
        disabled={!props.canSave}
        loading={writes.save.isPending}
        onClick={props.onSave}
      >
        <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
        {isNew ? 'Add them' : 'Save'}
      </Button>

      {isNew ? null : (
        <>
          {/* Bringing somebody back is a good outcome and says so; marking them
              as left carries no tone of its own, so it takes none. */}
          <Button
            size="sm"
            variant="ghost"
            {...(archived ? { color: 'success' as const } : {})}
            loading={writes.archive.isPending}
            aria-label={archived ? 'Bring them back' : 'Mark as left'}
            title={archived ? 'Bring them back' : 'Mark as left'}
            onClick={() => {
              void writes.onArchive(!archived);
            }}
          >
            <Icon glyph={faBoxArchive} className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="danger"
            aria-label="Delete this record"
            title="Delete this record"
            onClick={() => {
              void writes.onDelete();
            }}
          >
            <Icon glyph={faTrashCan} className="size-4" aria-hidden />
          </Button>
        </>
      )}
    </PaneToolbar>
  );
}
