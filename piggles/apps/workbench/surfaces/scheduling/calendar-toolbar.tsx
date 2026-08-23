'use client';

// THE DIARY'S TOOLBAR — where in time you are, and whose diary you are looking at.
//
// Split out of calendar.tsx to keep that file inside the size rule. It owns no
// state: every control reports upward and the surface decides.
//
// The chrome buttons wear no `color` at all. These are secondary controls — step
// a week, jump to today — and a bare `.btn` resolves to `base-content`, which is
// theme-correct without naming `neutral` (root RULE #4). Four `color="neutral"`
// came across with the move and are gone.
//
// Linked calendars rides `actions` rather than `controls`, which is what lets a
// narrow bar fold it away WITH ITS NAME. See the note beside it.

import {
  Button,
  Join,
  NativeSelect,
  Text,
  ToggleGroup,
  ToggleGroupItem,
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
        the day, which is why it is never hidden: it carried `hidden @sm:block`
        and a phone-width diary therefore showed an empty bar, seven unlabelled
        weekday numbers, and no month or year anywhere on the screen. `status`
        is the slot for information rather than a control, and PaneToolbar's
        contract for it is one word: never hidden. It truncates instead. */
        <Text className="min-w-0 truncate font-medium">{label}</Text>
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
          {/* No `ml-auto`. These five are one run of chrome — where in time, which
              shape, whose diary — and an auto margin in the middle of a run only
              opens a gap. It also travelled: `controls` is RELOCATED verbatim
              into the narrow bar's popover, where a column of full-width rows
              had one control shoved against the right edge for no reason. */}
          <ToggleGroup
            size="sm"
            color="module"
            className="shrink-0"
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
            /* Wide enough for its own default option: at `max-w-40` the picker
               read "Everyone & equip" at every width, including inside a popover
               with room to spare. Still capped, because a business may name a
               chair a whole sentence. */
            className="max-w-56 shrink"
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
        </>
      }
      /* Linked calendars is an ACTION, not a control: it does something to the
         pane rather than narrowing what the pane shows. Written as a value so
         the narrow bar can give it its name — as bespoke `controls` JSX it was
         relocated verbatim, and a popover row holding one bare chain glyph and
         no words is a button with no meaning on a device that cannot hover. */
      actions={[
        {
          label: 'Linked outside calendars',
          icon: faLink,
          onClick: () => {
            onOpenLinkedCalendars();
          },
        },
      ]}
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
