'use client';

// The booking-links toolbar: how many there are, the one thing you come here to
// make, and a refresh.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faCalendarClock, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar } from '../../components/pane-toolbar';

export function MeetingLinksToolbar({
  count,
  noServices,
  onNew,
  refresh,
}: {
  count: number;
  /** Nothing is bookable yet, so there is nothing a link could point at. */
  noServices: boolean;
  onNew: () => void;
  refresh: React.ReactNode;
}) {
  return (
    <PaneToolbar
      label="Booking link actions"
      status={
        <>
          <Icon glyph={faCalendarClock} className="size-4 shrink-0" aria-hidden />
          <Text as="span" className="text-sm">
            {count === 0
              ? 'No booking links yet'
              : count === 1
                ? '1 booking link'
                : `${String(count)} booking links`}
          </Text>
        </>
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={noServices}
          title={
            noServices
              ? 'Set up something bookable under Scheduling first'
              : 'Make a new booking link'
          }
          onClick={onNew}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          New booking link
        </Button>
      }
      refresh={refresh}
    />
  );
}
