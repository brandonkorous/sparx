'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Send, X } from 'lucide-react';
import { toast } from '@sparx/ui';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
} from '@wizeworks/silicaui-react';

import { cancelBroadcastAction, scheduleBroadcastAction, sendBroadcastAction } from '../actions';
import type { BroadcastRow } from '../../_lib/types';

export function BroadcastActions({ broadcast }: { broadcast: BroadcastRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [when, setWhen] = useState('');

  function send() {
    startTransition(async () => {
      const result = await sendBroadcastAction(broadcast.id);
      if (result.ok) {
        toast.success(`Sending to ${result.data.recipientCount} recipients.`);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  function schedule() {
    if (!when) {
      toast.error('Pick a date and time.');
      return;
    }
    startTransition(async () => {
      const result = await scheduleBroadcastAction(broadcast.id, new Date(when).toISOString());
      if (result.ok) {
        toast.success('Broadcast scheduled.');
        setScheduleOpen(false);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelBroadcastAction(broadcast.id);
      if (result.ok) {
        toast.success('Broadcast cancelled.');
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  if (broadcast.status === 'draft') {
    return (
      <div className="flex flex-row items-center gap-2">
        <Button color="module" onClick={send} loading={pending} disabled={pending}>
          <Send className="h-4 w-4" />
          Send now
        </Button>

        <Dialog
          open={scheduleOpen}
          onOpenChange={(open) => {
            if (!pending) setScheduleOpen(open);
          }}
        >
          <Button variant="outline" onClick={() => setScheduleOpen(true)} disabled={pending}>
            <CalendarClock className="h-4 w-4" />
            Schedule…
          </Button>
          <DialogContent className="max-w-sm">
            <div>
              <DialogTitle>Schedule broadcast</DialogTitle>
              <DialogDescription>
                Pick when this broadcast should send. Recipients are resolved at send time.
              </DialogDescription>
            </div>
            <Field className="py-2">
              <FieldLabel required>Send at</FieldLabel>
              <FieldControl
                name="broadcast-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={pending}
              />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScheduleOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                color="module"
                onClick={schedule}
                loading={pending}
                disabled={pending || !when}
              >
                Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (broadcast.status === 'scheduled') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base-content text-sm">
          Scheduled for{' '}
          {broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toLocaleString() : ''}
        </p>
        <Button variant="outline" onClick={cancel} loading={pending} disabled={pending}>
          <X className="h-4 w-4" />
          Cancel send
        </Button>
      </div>
    );
  }

  return null;
}
