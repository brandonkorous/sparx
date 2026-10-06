'use client';

import { Badge, Button, Text } from '@wizeworks/silicaui-react';
import { faCalendarRange, faSquare } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../../components/form-section';
import { bookingStateMeta, formatWhen, type SeriesOccurrence } from '../bookings-data';

/** The bookings a pattern has made, or a word on when they will appear. */
export function OccurrencesSection({
  occurrences,
  openOccurrence,
}: {
  occurrences: SeriesOccurrence[];
  openOccurrence: (id: string) => void;
}) {
  return (
    <FormSection title="The bookings it has made">
      {occurrences.length === 0 ? (
        <Text className="text-sm">
          No occurrences yet. The next ones are created automatically as the date approaches.
        </Text>
      ) : (
        <OccurrenceList occurrences={occurrences} openOccurrence={openOccurrence} />
      )}
    </FormSection>
  );
}

/** The bookings a pattern has made, one row each, opening the real booking. */
function OccurrenceList({
  occurrences,
  openOccurrence,
}: {
  occurrences: SeriesOccurrence[];
  openOccurrence: (id: string) => void;
}) {
  return (
    <div className="border-base-300 flex flex-col overflow-hidden rounded-md border">
      {occurrences.map((occurrence, index) => {
        const oMeta = bookingStateMeta(occurrence.status);
        return (
          <button
            key={occurrence.id}
            type="button"
            className={`hover:bg-base-200 flex items-center gap-3 px-3 py-2 text-left ${index > 0 ? 'border-base-200 border-t' : ''}`}
            onClick={() => {
              openOccurrence(occurrence.id);
            }}
          >
            <Icon glyph={faCalendarRange} className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 font-medium">
              {formatWhen(occurrence.startAt, occurrence.timezone)}
            </span>
            <Badge color={oMeta.tone} variant="soft" size="sm">
              {oMeta.label}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

/** The two ways to stop a live pattern. */
export function StopControls({
  pending,
  onStop,
}: {
  pending: boolean;
  onStop: (scope: 'future' | 'all') => Promise<void>;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-4">
      <Text className="text-sm">
        Stopping ends the pattern. Choose whether to keep the appointments already booked ahead, or
        cancel those too.
      </Text>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          color="danger"
          disabled={pending}
          onClick={() => {
            void onStop('future');
          }}
        >
          <Icon glyph={faSquare} className="size-4" aria-hidden />
          Stop making new ones
        </Button>
        <Button
          size="sm"
          variant="outline"
          color="danger"
          disabled={pending}
          onClick={() => {
            void onStop('all');
          }}
        >
          Stop and cancel upcoming
        </Button>
      </div>
    </div>
  );
}
