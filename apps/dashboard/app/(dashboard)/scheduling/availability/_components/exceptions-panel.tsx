'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';
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
      <CardBody>
        <CardTitle>Time off & exceptions</CardTitle>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
            <Field>
              <FieldLabel>Kind</FieldLabel>
              <NativeSelect
                value={kind}
                onChange={(e) => setKind(e.target.value as AvailabilityException['kind'])}
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel>From</FieldLabel>
              <FieldControl
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>To</FieldLabel>
              <FieldControl
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
            <Button color="module" loading={saving} onClick={add}>
              Add
            </Button>
          </div>
          <Field>
            <FieldControl
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional) — e.g. holiday, vacation"
            />
          </Field>

          {exceptions.length === 0 ? (
            <p className="text-base-content flex items-center gap-2 text-sm">
              <CalendarOff className="h-4 w-4" />
              No exceptions — this resource follows its weekly hours.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {exceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="border-base-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
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
                      <span className="text-base-content text-sm">{ex.reason}</span>
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
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
