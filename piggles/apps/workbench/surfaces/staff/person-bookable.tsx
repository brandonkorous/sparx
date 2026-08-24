'use client';

// APPOINTMENTS — whether customers can book this person, and where the rest of
// that setup lives.
//
// ONE ROSTER (issue 120). A salon set two stylists up under Bookings, saw them
// on every booking form, and was then told by the till that nobody was on her
// team. They were bookable resources; the team was a different table; nothing
// wrote both. They are one record now, and this is the switch between "on the
// team" and "on the team AND on the booking page".
//
// The switch is all that lives here. Their hours, their color and which
// services they do belong to the bookable side and already have a screen of
// their own — building a second place to set them would be the same mistake
// this issue is about.

import { Button, Text, useToast } from '@wizeworks/silicaui-react';
import { faCalendarDays, faArrowUpRightFromSquare } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import { afterPaneChange } from '../../lib/defer';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { staffErrorMessage, useSetBookable, type StaffMember } from './data';

export function PersonBookable({ ctx, person }: { ctx: SurfaceContext; person: StaffMember }) {
  const toast = useToast();
  const setBookable = useSetBookable();

  // `null` means Bookings is off for this business, so there is no such thing as
  // being bookable here. A switch would be asking a question the product has not
  // sold them the answer to.
  if (person.bookable === null) return null;

  const on = person.bookable;

  const flip = () => {
    setBookable.mutate(
      { id: person.id, bookable: !on },
      {
        onSuccess: () => {
          afterPaneChange(() => {
            toast.add({
              title: on
                ? `${person.name} is no longer taking appointments`
                : `${person.name} can be booked`,
              description: on
                ? 'Their past appointments are untouched, and you can switch this back on at any time.'
                : 'They will show on your booking page once they have hours and at least one service.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change that',
            description: staffErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  // Bookings' functionality on a team screen, so it wears the Bookings hue —
  // color follows functionality, not the pane it turns up on.
  return (
    <ModuleScope module="scheduling">
      <FormSection
        title="Appointments"
        description="Whether customers can book time with this person."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Icon glyph={faCalendarDays} className="text-module mt-1 size-4 shrink-0" aria-hidden />
            <Text className="text-base">
              {on
                ? 'Customers can book time with them, and they hold one appointment at a time.'
                : 'They are on your team but do not appear on your booking page.'}
            </Text>
          </div>
          <Button
            size="sm"
            color="module"
            variant={on ? 'outline' : 'solid'}
            loading={setBookable.isPending}
            onClick={flip}
          >
            {on ? 'Stop taking appointments' : 'Let customers book them'}
          </Button>
        </div>

        {on && person.resourceId ? (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={(event) => {
              ctx.open(
                'scheduling.resources.detail',
                { id: person.resourceId ?? '' },
                { target: event.shiftKey ? 'beside' : 'tab' }
              );
            }}
          >
            Their hours and services
            <Icon glyph={faArrowUpRightFromSquare} className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </FormSection>
    </ModuleScope>
  );
}
