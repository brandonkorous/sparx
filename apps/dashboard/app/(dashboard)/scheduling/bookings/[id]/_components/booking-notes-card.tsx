'use client';

// Editable notes for a booking — the customer-facing note and the internal
// staff note, saved together through the booking PATCH (the route's documented
// staff-edit path). Explicit-save, last-write-wins like every other editor; an
// unsaved edit registers the leave-guard so closing the drawer/navigating away
// confirms before discarding (docs/86).

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  Textarea,
} from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';

import { updateBookingAction } from '../../../_lib/actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

export function BookingNotesCard({
  id,
  notes,
  staffNotes,
}: {
  id: string;
  notes: string | null;
  staffNotes: string | null;
}) {
  const router = useRouter();
  const [noteValue, setNoteValue] = useState(notes ?? '');
  const [staffValue, setStaffValue] = useState(staffNotes ?? '');
  const [saved, setSaved] = useState({ note: notes ?? '', staff: staffNotes ?? '' });
  const [saving, setSaving] = useState(false);

  const dirty = noteValue !== saved.note || staffValue !== saved.staff;
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'booking' });

  const save = useCallback(async () => {
    setSaving(true);
    const result = await updateBookingAction(id, {
      notes: noteValue.trim() || null,
      staffNotes: staffValue.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      setSaved({ note: noteValue, staff: staffValue });
      toast.success('Notes saved');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [id, noteValue, staffValue, router]);

  return (
    <Card>
      <CardBody>
        <CardTitle>Notes</CardTitle>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Customer note</FieldLabel>
            <FieldControl
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              render={
                <Textarea
                  rows={2}
                  placeholder="Visible to the customer on confirmations and reminders."
                />
              }
            />
          </Field>
          <Field>
            <FieldLabel>Staff note</FieldLabel>
            <FieldControl
              value={staffValue}
              onChange={(e) => setStaffValue(e.target.value)}
              render={
                <Textarea rows={3} placeholder="Internal only — never shown to the customer." />
              }
            />
          </Field>
          <div className="flex flex-row justify-end">
            <Button
              type="button"
              color="module"
              onClick={() => void save()}
              loading={saving}
              disabled={!dirty}
            >
              Save notes
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
