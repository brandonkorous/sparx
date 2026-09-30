'use client';

// What sits under the toolbar: the "nothing is bookable yet" note, and either
// the links or the reason to make one.

import { Alert, AlertContent, AlertDescription, AlertTitle, Card } from '@wizeworks/silicaui-react';
import { faCalendarCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneEmpty } from '../../components/pane-empty';
import { MeetingLinksTable } from './meeting-links-table';
import type { MeetingLink } from './workspace-data';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

export function MeetingLinksBody({
  rows,
  noServices,
  onCopy,
  onEdit,
  onTogglePaused,
  onRetire,
}: {
  rows: MeetingLink[];
  noServices: boolean;
  onCopy: (link: MeetingLink) => void;
  onEdit: (link: MeetingLink) => void;
  onTogglePaused: (link: MeetingLink) => void;
  onRetire: (link: MeetingLink) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={COLUMN}>
        {noServices ? (
          <Alert color="info">
            <AlertContent>
              <AlertTitle>You need something bookable first</AlertTitle>
              <AlertDescription>
                A booking link points at one of your bookable services. That is where the length,
                your availability and your cancellation terms come from. Set one up under Bookings,
                then come back.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}

        {rows.length > 0 ? (
          <MeetingLinksTable
            rows={rows}
            onCopy={onCopy}
            onEdit={onEdit}
            onTogglePaused={onTogglePaused}
            onRetire={onRetire}
          />
        ) : (
          // The house first-run state. This was a bare heading and a paragraph
          // floating in the column with no card behind them, which is the exact
          // shape components/pane-empty.tsx says in its own header it exists to
          // stop. [[feedback_copy_the_house_layout_before_building]]
          <Card className="p-0">
            <PaneEmpty
              module={MODULE}
              icon={<Icon glyph={faCalendarCheck} className="size-6" aria-hidden />}
              title="No booking links yet"
              description="Make one and you get a web address you can put in an email signature, on a quote, or in a reply. Anyone who opens it picks a time from your real availability and the booking lands in your calendar, with the customer already attached."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
