'use client';

// What the people & equipment card shows: the list, or why there is no list.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faPlus, faUsers } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { ListEmptyState } from '../../components/list-empty-state';
import { ResourcesTable } from './resources-table';
import { resourceKindLabel, type SchedulingResource } from './setup-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

// The one sentence that makes this list and My Team read as the same roster: they
// are one record (issue 120), and saying so is how somebody knows not to type
// anybody twice.
export function RosterNote({ onOpenTeam }: { onOpenTeam: () => void }) {
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <Text className="text-sm">
        The people here are your team. Add somebody in either place and they appear in both.
      </Text>
      <Button size="xs" variant="ghost" onClick={onOpenTeam}>
        Open your team
      </Button>
    </div>
  );
}

export interface ResourcesBodyProps {
  isError: boolean;
  /** The failed read's error, so the failure says WHY it failed (issue 260). */
  error: unknown;
  isPending: boolean;
  rows: SchedulingResource[];
  /** The kind currently being shown, or '' for every kind. */
  kind: string;
  onRetry: () => void;
  onAdd: () => void;
  onOpen: (resource: SchedulingResource, event: { shiftKey: boolean; altKey: boolean }) => void;
}

export function ResourcesBody(props: ResourcesBodyProps) {
  const { isError, isPending, rows, kind } = props;

  if (isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faUsers} className="size-6" aria-hidden />}
        title="Could not load your people & equipment"
        description="This is a problem reaching the server. Nothing is affected: the list just could not be read just now."
        error={props.error}
        onRetry={props.onRetry}
      />
    );
  }

  if (isPending) return <PaneWaiting />;

  if (rows.length === 0) {
    return (
      <ListEmptyState
        module={MODULE}
        filtered={kind !== ''}
        noResults={{
          icon: <Icon glyph={faUsers} className="size-6" aria-hidden />,
          title: 'Nothing matches that',
          description: `You are only seeing “${kind ? resourceKindLabel(kind) : ''}”. Switch to every kind to see the rest.`,
        }}
        firstRun={{
          title: 'Nothing set up yet',
          description:
            'Add the people and things a booking uses up. Your staff, your rooms, your equipment. Once they exist, you can set the hours each one is free.',
          actions: (
            <Button size="sm" color="module" onClick={props.onAdd}>
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              Add a person or equipment
            </Button>
          ),
        }}
      />
    );
  }

  return <ResourcesTable rows={rows} onOpen={props.onOpen} />;
}
