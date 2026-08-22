'use client';

// THE DIARY'S TOOLBAR — where in time you are, and whose diary you are looking at.
//
// Split out of calendar.tsx to keep that file inside the size rule. It owns no
// state: every control reports upward and the surface decides.
//
// The chrome buttons wear no `color` at all. These are secondary controls — step
// a week, jump to today, open the linked-calendar list — and a bare `.btn`
// resolves to `base-content`, which is theme-correct without naming `neutral`
// (root RULE #4). Four `color="neutral"` came across with the move and are gone.

import {
  Button,
  Join,
  NativeSelect,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faChevronLeft, faChevronRight, faLink } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { View } from './calendar-columns';

interface CalendarToolbarProps {
  label: string;
  view: View;
  resourceId: string;
  resources: { id: string; name: string }[];
  isFetching: boolean;
  updatedAt: number | undefined;
  onSetView: (view: View) => void;
  onSetAnchor: (date: Date) => void;
  onSetResourceId: (id: string) => void;
  onStep: (direction: 1 | -1) => void;
  onRefresh: () => void;
  onOpenLinkedCalendars: () => void;
}

export function CalendarToolbar({
  label,
  view,
  resourceId,
  resources,
  isFetching,
  updatedAt,
  onSetView,
  onSetAnchor,
  onSetResourceId,
  onStep,
  onRefresh,
  onOpenLinkedCalendars,
}: CalendarToolbarProps) {
  return (
    <PaneToolbar
      label="Calendar controls"
      status={
        /* The "where am I in time" anchor. In the day view especially — whose
        columns are resource names, not dates — this is the only thing naming
        the day. Truncates rather than wraps the bar. */
        <Text className="hidden min-w-0 truncate font-medium @sm:block">{label}</Text>
      }
      controls={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSetAnchor(new Date());
            }}
          >
            Today
          </Button>
          <Join>
            <Button
              size="sm"
              variant="outline"
              shape="square"
              aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
              onClick={() => {
                onStep(-1);
              }}
            >
              <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="outline"
              shape="square"
              aria-label={view === 'week' ? 'Next week' : 'Next day'}
              onClick={() => {
                onStep(1);
              }}
            >
              <Icon glyph={faChevronRight} className="size-4" aria-hidden />
            </Button>
          </Join>
          <ToggleGroup
            size="sm"
            color="module"
            className="ml-auto shrink-0"
            value={[view]}
            onValueChange={(next: unknown[]) => {
              const picked = next.at(-1);
              if (picked === 'week' || picked === 'day') onSetView(picked);
            }}
          >
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
          </ToggleGroup>
          {/* People & equipment as a picker, not chips: a business can have twenty,
        and twenty chips is a bar taller than the grid. */}
          <NativeSelect
            size="sm"
            className="max-w-40 shrink"
            aria-label="Show the diary for"
            value={resourceId}
            disabled={resources.length === 0}
            onChange={(domEvent) => {
              onSetResourceId(domEvent.target.value);
            }}
          >
            <option value="">Everyone &amp; equipment</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </NativeSelect>
          <Tooltip content="Linked outside calendars" align="end">
            <Button
              size="sm"
              variant="ghost"
              shape="square"
              aria-label="Linked outside calendars"
              onClick={() => {
                onOpenLinkedCalendars();
              }}
            >
              <Icon glyph={faLink} className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        </>
      }
      refresh={
        /* ALWAYS the last child of a list toolbar — see RefreshButton. */
        <RefreshButton
          isFetching={isFetching}
          updatedAt={updatedAt}
          onRefresh={() => {
            onRefresh();
          }}
        />
      }
    />
  );
}
