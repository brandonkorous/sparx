'use client';

// Editing an existing booking — moving it in time, and the two notes.
// Split out of the pane so each file holds one job (RULE #0.5).

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Icon } from '@piggles/ui';
import { faCalendarClock, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';

import { FormSection } from '../../components/form-section';
import type { WallClockBox } from '../../lib/wall-clock';
import { moveExplainer } from './booking-move-copy';

export function BookingMove({
  rescheduleLocal,
  setRescheduleLocal,
  clock,
  moved,
  isPending,
  onMove,
}: {
  rescheduleLocal: string;
  setRescheduleLocal: (value: string) => void;
  /** Whose clock the box is on: the booking's own (sparx persona issue 086). */
  clock: WallClockBox;
  moved: boolean;
  isPending: boolean;
  onMove: () => void;
}) {
  // The caller hides this once the booking is over — a completed or cancelled
  // booking does not move.
  return (
    <FormSection title="Move it" description={moveExplainer(clock.hint)}>
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-0" invalid={clock.problem !== null}>
          <FieldLabel>New start</FieldLabel>
          <FieldControl
            render={
              <Input
                color={clock.problem ? 'error' : 'module'}
                type="datetime-local"
                className="max-w-xs"
                value={rescheduleLocal}
                onChange={(event) => {
                  setRescheduleLocal(event.target.value);
                }}
              />
            }
          />
          {clock.problem ? <FieldError match>{clock.problem}</FieldError> : null}
        </Field>
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={!moved || isPending}
          loading={isPending}
          onClick={onMove}
        >
          <Icon glyph={faCalendarClock} className="size-4" aria-hidden />
          Move booking
        </Button>
      </div>
    </FormSection>
  );
}

export function BookingNotes({
  notes,
  setNotes,
  staffNotes,
  setStaffNotes,
  changed,
  isPending,
  onSave,
}: {
  notes: string;
  setNotes: (value: string) => void;
  staffNotes: string;
  setStaffNotes: (value: string) => void;
  changed: boolean;
  isPending: boolean;
  onSave: () => void;
}) {
  return (
    <FormSection
      title="Notes"
      description="What the customer sees, and a private note nobody outside your business reads."
      action={
        <Button
          size="sm"
          color="module"
          disabled={!changed || isPending}
          loading={isPending}
          onClick={onSave}
        >
          <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
          Save
        </Button>
      }
    >
      <Field>
        <FieldLabel>The customer sees</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel>Private note for your team</FieldLabel>
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={staffNotes}
              onChange={(event) => {
                setStaffNotes(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>The customer never sees this.</FieldDescription>
      </Field>
    </FormSection>
  );
}
