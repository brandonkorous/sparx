'use client';

// WHAT THE MODAL CAN DO to the booking it is showing: the lifecycle step, the
// move, and the two hard-to-undo endings. Split from calendar-booking-parts.tsx,
// which states what a booking LOOKS like — a different question, and the one
// that changes for different reasons (RULE #0.5).

import { Button, Field, FieldControl, FieldLabel, Input } from '@wizeworks/silicaui-react';
import {
  faCalendarClock,
  faCheck,
  faCheckCircle,
  faRightToBracket,
  faUserXmark,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { MOVE_EXPLAINER } from './booking-move-copy';
import { Section } from './calendar-booking-parts';
import type { Acts, Moves } from './calendar-booking-state';

export function LifecycleRow({
  moves,
  busy,
  anyPending,
  act,
}: {
  moves: Moves;
  busy: Moves;
  anyPending: boolean;
  act: Acts;
}) {
  if (!moves.confirm && !moves.checkIn && !moves.complete) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {moves.confirm ? (
        <Button
          size="sm"
          color="module"
          loading={busy.confirm}
          disabled={anyPending}
          onClick={act.confirm}
        >
          <Icon glyph={faCheck} className="size-4" aria-hidden />
          Confirm
        </Button>
      ) : null}
      {moves.checkIn ? (
        <Button
          size="sm"
          color="module"
          loading={busy.checkIn}
          disabled={anyPending}
          onClick={act.checkIn}
        >
          <Icon glyph={faRightToBracket} className="size-4" aria-hidden />
          Check in
        </Button>
      ) : null}
      {moves.complete ? (
        <Button
          size="sm"
          color="module"
          loading={busy.complete}
          disabled={anyPending}
          onClick={act.complete}
        >
          <Icon glyph={faCheckCircle} className="size-4" aria-hidden />
          Complete
        </Button>
      ) : null}
    </div>
  );
}

/** The same "Move it" group the full pane uses, verbatim, so the interaction is
 *  identical wherever the operator meets it. */
export function MoveSection({
  when,
  setWhen,
  canMove,
  busy,
  onMove,
}: {
  when: string;
  setWhen: (value: string) => void;
  canMove: boolean;
  busy: boolean;
  onMove: () => void;
}) {
  return (
    <Section title="Move it" description={MOVE_EXPLAINER}>
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-0">
          <FieldLabel>New start</FieldLabel>
          <FieldControl
            render={
              <Input
                type="datetime-local"
                color="module"
                className="max-w-xs"
                value={when}
                onChange={(domEvent) => {
                  setWhen(domEvent.target.value);
                }}
              />
            }
          />
        </Field>
        <Button
          size="sm"
          variant="outline"
          color="module"
          loading={busy}
          disabled={!canMove}
          onClick={onMove}
        >
          <Icon glyph={faCalendarClock} className="size-4" aria-hidden />
          Move booking
        </Button>
      </div>
    </Section>
  );
}

/** The two hard-to-undo moves, kept apart at the bottom and quiet, so they never
 *  compete with the primary step above. */
export function EndingsRow({
  moves,
  busy,
  anyPending,
  act,
}: {
  moves: Moves;
  busy: Moves;
  anyPending: boolean;
  act: Acts;
}) {
  if (!moves.noShow && !moves.cancel) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {moves.noShow ? (
        <Button
          size="sm"
          variant="ghost"
          color="warning"
          loading={busy.noShow}
          disabled={anyPending}
          onClick={act.noShow}
        >
          <Icon glyph={faUserXmark} className="size-4" aria-hidden />
          Mark no-show
        </Button>
      ) : null}
      {moves.cancel ? (
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          loading={busy.cancel}
          disabled={anyPending}
          onClick={act.cancel}
        >
          <Icon glyph={faXmark} className="size-4" aria-hidden />
          Cancel booking
        </Button>
      ) : null}
    </div>
  );
}
