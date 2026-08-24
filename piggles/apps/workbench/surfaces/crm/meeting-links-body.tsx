'use client';

// What sits under the toolbar: the "nothing is bookable yet" note, and either
// the links or the reason to make one.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Heading,
  Text,
} from '@wizeworks/silicaui-react';
import { MeetingLinksTable } from './meeting-links-table';
import type { MeetingLink } from './workspace-data';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

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
                A booking link points at one of your bookable services — that is where the length,
                your availability and your cancellation terms come from. Set one up under
                Scheduling, then come back.
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
          // A bare heading over blank space says nothing. Somebody who has
          // never made one of these needs to know what they would get.
          <div className="flex flex-col gap-1">
            <Heading level={2} className="text-lg">
              No booking links yet
            </Heading>
            <Text>
              Make one and you get a web address you can put in an email signature, on a quote, or
              in a reply — anyone who opens it picks a time from your real availability and the
              booking lands in your calendar, with the customer already attached.
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
