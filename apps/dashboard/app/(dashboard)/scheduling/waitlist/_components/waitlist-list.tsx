'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Label,
  DropdownMenuTrigger,
  toast,
  useConfirm,
} from '@sparx/ui';
import { CalendarPlus, MoreHorizontal, Send, Trash2 } from 'lucide-react';

import type { AvailabilitySlot, WaitlistEntry } from '../../_lib/types';
import { formatDate, formatTime } from '../../_lib/format';
import {
  acceptWaitlistAction,
  loadSlotsAction,
  offerWaitlistAction,
  removeWaitlistAction,
} from '../../_lib/actions';

const STATUS_COLOR: Record<string, string> = {
  waiting: 'warning',
  offered: 'info',
  booked: 'success',
  expired: 'neutral',
  cancelled: 'danger',
};

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** Book a waitlist entry on the customer's behalf — pick a slot in their window. */
function BookOfferModal({
  entry,
  onClose,
}: {
  entry: WaitlistEntry;
  onClose: (booked: boolean) => void;
}) {
  const startDate = isoDateOnly(entry.desiredFrom);
  const [date, setDate] = useState(startDate);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setSlots(null);
    const from = new Date(`${date}T00:00`).toISOString();
    const to = new Date(`${date}T00:00`);
    to.setDate(to.getDate() + 1);
    const result = await loadSlotsAction({
      serviceId: entry.serviceId,
      from,
      to: to.toISOString(),
    });
    setLoading(false);
    if (result.ok) setSlots(result.data);
    else toast.error(result.error);
  }

  async function book(startAt: string) {
    setSaving(true);
    const result = await acceptWaitlistAction(entry.id, startAt);
    setSaving(false);
    if (result.ok) {
      toast.success('Booked — the customer is confirmed');
      onClose(true);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose(false)}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Book for {entry.customerName}</ModalTitle>
        </ModalHeader>
        <div className="flex flex-col gap-3 px-1 py-2">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {entry.serviceName} · requested {formatDate(entry.desiredFrom)} –{' '}
            {formatDate(entry.desiredTo)}
          </p>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="wl-date">Date</Label>
              <Input
                id="wl-date"
                type="date"
                min={isoDateOnly(entry.desiredFrom)}
                max={isoDateOnly(entry.desiredTo)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} loading={loading}>
              Find times
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <Spinner size="sm" /> Checking…
            </div>
          ) : slots ? (
            slots.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No open times that day.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <Button
                    key={s.startAt}
                    type="button"
                    size="sm"
                    color="module"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void book(s.startAt)}
                  >
                    {formatTime(s.startAt)}
                  </Button>
                ))}
              </div>
            )
          ) : null}
        </div>
      </ModalContent>
    </Modal>
  );
}

export function WaitlistList({ entries }: { entries: WaitlistEntry[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [booking, setBooking] = useState<WaitlistEntry | null>(null);

  async function offer(e: WaitlistEntry) {
    const result = await offerWaitlistAction(e.id);
    if (result.ok) {
      toast.success(`Offer sent to ${e.customerName}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function remove(e: WaitlistEntry) {
    const ok = await confirm({
      title: `Remove ${e.customerName} from the waitlist?`,
      description: 'They stop being offered openings for this service.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await removeWaitlistAction(e.id);
    if (result.ok) {
      toast.success('Removed');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Requested window</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const active = e.status === 'waiting' || e.status === 'offered';
            return (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.customerName}</TableCell>
                <TableCell>{e.serviceName ?? 'Service'}</TableCell>
                <TableCell className="text-[var(--color-muted-foreground)]">
                  {formatDate(e.desiredFrom)} – {formatDate(e.desiredTo)}
                </TableCell>
                <TableCell>
                  <Badge color={STATUS_COLOR[e.status] ?? 'neutral'} variant="soft">
                    {e.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        shape="square"
                        size="sm"
                        aria-label="Waitlist actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {active ? (
                        <>
                          <DropdownMenuItem onSelect={() => void offer(e)}>
                            <Send className="mr-2 h-4 w-4" />
                            Send offer
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setBooking(e)}>
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            Book a slot
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void remove(e)}
                            className="text-[var(--color-danger)]"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {booking ? (
        <BookOfferModal
          entry={booking}
          onClose={(booked) => {
            setBooking(null);
            if (booked) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
