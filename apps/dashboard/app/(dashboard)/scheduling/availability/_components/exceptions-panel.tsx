'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Stack,
  toast,
  useConfirm,
} from '@sparx/ui';
import { CalendarOff, Trash2 } from 'lucide-react';

import type { AvailabilityException } from '../../_lib/types';
import { formatDateTime } from '../../_lib/format';
import { createExceptionAction, deleteExceptionAction } from '../../_lib/actions';

const KINDS: { value: AvailabilityException['kind']; label: string }[] = [
  { value: 'closed', label: 'Closed' },
  { value: 'blackout', label: 'Blackout' },
  { value: 'custom_hours', label: 'Custom hours' },
  { value: 'special_price', label: 'Special pricing' },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

function toIso(local: string): string {
  return new Date(local).toISOString();
}

export function ExceptionsPanel({
  resourceId,
  exceptions,
}: {
  resourceId: string;
  exceptions: AvailabilityException[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [kind, setKind] = useState<AvailabilityException['kind']>('closed');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!start || !end) {
      toast.error('Pick a start and end');
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast.error('End must be after start');
      return;
    }
    setSaving(true);
    const result = await createExceptionAction({
      resourceId,
      kind,
      startAt: toIso(start),
      endAt: toIso(end),
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success('Exception added');
      setStart('');
      setEnd('');
      setReason('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function remove(ex: AvailabilityException) {
    const ok = await confirm({
      title: 'Delete this exception?',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteExceptionAction(ex.id);
    if (result.ok) {
      toast.success('Exception deleted');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time off & exceptions</CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
            <div>
              <Label htmlFor="ex-kind">Kind</Label>
              <NativeSelect
                id="ex-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as AvailabilityException['kind'])}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="ex-start">From</Label>
              <Input
                id="ex-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ex-end">To</Label>
              <Input
                id="ex-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <Button color="module" loading={saving} onClick={add}>
              Add
            </Button>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional) — e.g. holiday, vacation"
          />

          {exceptions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <CalendarOff className="h-4 w-4" />
              No exceptions — this resource follows its weekly hours.
            </p>
          ) : (
            <Stack gap={2}>
              {exceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="soft" color={ex.resourceId ? 'neutral' : 'warning'}>
                      {KIND_LABEL[ex.kind] ?? ex.kind}
                      {ex.resourceId ? '' : ' · all'}
                    </Badge>
                    <span className="text-sm">
                      {formatDateTime(ex.startAt)} → {formatDateTime(ex.endAt)}
                    </span>
                    {ex.reason ? (
                      <span className="text-sm text-[var(--color-muted-foreground)]">
                        {ex.reason}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    shape="square"
                    size="sm"
                    aria-label="Delete exception"
                    onClick={() => void remove(ex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
