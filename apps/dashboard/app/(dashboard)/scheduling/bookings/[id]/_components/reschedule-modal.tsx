'use client';

// Reschedule a booking — pick a new date, find the open slots that respect the
// service's availability + buffers, and move the booking. Drives the scheduling
// engine's reschedule (which re-checks the no-overlap guarantee), the same flow
// the create form uses to surface slots.

import { useState } from 'react';
import {
  Button,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Spinner,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import { loadSlotsAction, rescheduleBookingAction } from '../../../_lib/actions';
import type { AvailabilitySlot } from '../../../_lib/types';
import { formatTime } from '../../../_lib/format';

/** Local YYYY-MM-DD for the date input's default (the booking's current day). */
function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RescheduleModal({
  open,
  onOpenChange,
  id,
  serviceId,
  startAt,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  serviceId: string;
  startAt: string;
  onDone: () => void;
}) {
  const [date, setDate] = useState(localDate(startAt));
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function findTimes() {
    setLoading(true);
    setSlots(null);
    setSelected(null);
    const from = new Date(`${date}T00:00`).toISOString();
    const to = new Date(`${date}T00:00`);
    to.setDate(to.getDate() + 1);
    const result = await loadSlotsAction({ serviceId, from, to: to.toISOString() });
    setLoading(false);
    if (result.ok) setSlots(result.data);
    else toast.error(result.error);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    const result = await rescheduleBookingAction(id, selected);
    setSaving(false);
    if (result.ok) {
      toast.success('Booking rescheduled');
      onOpenChange(false);
      onDone();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Reschedule booking</ModalTitle>
        </ModalHeader>
        <div className="flex flex-col gap-4 px-1 py-2">
          <Stack direction="row" align="end" gap={2}>
            <div className="flex-1">
              <Label htmlFor="rs-date">New date</Label>
              <Input
                id="rs-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void findTimes()}
              loading={loading}
            >
              Find times
            </Button>
          </Stack>

          {loading ? (
            <Stack direction="row" align="center" gap={2}>
              <Spinner size="sm" />
              <Text size="sm" variant="muted">
                Checking availability…
              </Text>
            </Stack>
          ) : slots ? (
            slots.length === 0 ? (
              <Text size="sm" variant="muted">
                No open times that day. Try another date.
              </Text>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot.startAt}
                    type="button"
                    size="sm"
                    color="module"
                    variant={selected === slot.startAt ? 'solid' : 'outline'}
                    onClick={() => setSelected(slot.startAt)}
                  >
                    {formatTime(slot.startAt)}
                  </Button>
                ))}
              </div>
            )
          ) : (
            <Text size="sm" variant="muted">
              Pick a date and find open times — only slots that respect availability and buffers are
              offered.
            </Text>
          )}

          <Stack direction="row" justify="end" gap={2}>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              color="module"
              onClick={() => void save()}
              loading={saving}
              disabled={!selected}
            >
              Reschedule
            </Button>
          </Stack>
        </div>
      </ModalContent>
    </Modal>
  );
}
