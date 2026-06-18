'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';

import { createSerialUnitAction, updateSerialStatusAction } from '../../../_lib/lot-actions';
import {
  SERIAL_STATUS_OPTIONS,
  serialStatusColor,
  serialStatusLabel,
  type SerialRow,
} from '../../_components/types';

// The serial roster for a lot (docs/100 P4d): list the per-unit serials, add a new
// one (inherits the lot's item + warehouse), and change a serial's status inline.
// Status is traceability metadata — it doesn't move on-hand (the ledger does that).

export function SerialsPanel({
  lotId,
  variantId,
  warehouseId,
  serials,
}: {
  lotId: string;
  variantId: string;
  warehouseId: string;
  serials: SerialRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Heading level={3}>Serials</Heading>
          <Text size="sm" variant="muted">
            {serials.length} unit{serials.length === 1 ? '' : 's'}
          </Text>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          {serials.length === 0 ? (
            <Text size="sm" variant="muted">
              No serials on this lot yet — add one below.
            </Text>
          ) : (
            serials.map((s) => <SerialRowItem key={s.id} lotId={lotId} serial={s} />)
          )}
          <AddSerialRow lotId={lotId} variantId={variantId} warehouseId={warehouseId} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function SerialRowItem({ lotId, serial: s }: { lotId: string; serial: SerialRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function changeStatus(status: string) {
    if (status === s.status) return;
    setError(null);
    startTransition(async () => {
      const result = await updateSerialStatusAction(lotId, s.id, status);
      if (!result.ok) setError(result.error.message);
      else router.refresh();
    });
  }

  return (
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Stack gap={0} className="min-w-[12rem] flex-1">
        <Text size="sm" className="font-mono font-medium">
          {s.serial}
        </Text>
        {s.soldOnOrderItemId ? (
          <Text size="xs" variant="muted">
            sold on order item
          </Text>
        ) : null}
      </Stack>
      <Badge color={serialStatusColor(s.status)}>{serialStatusLabel(s.status)}</Badge>
      <Stack gap={0} className="w-[9rem]">
        <Label htmlFor={`status-${s.id}`} className="sr-only">
          Change status
        </Label>
        <NativeSelect
          id={`status-${s.id}`}
          value={s.status}
          disabled={pending}
          onChange={(e) => changeStatus(e.target.value)}
        >
          {SERIAL_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Stack>
      {error && (
        <Text size="xs" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function AddSerialRow({
  lotId,
  variantId,
  warehouseId,
}: {
  lotId: string;
  variantId: string;
  warehouseId: string;
}) {
  const router = useRouter();
  const [serial, setSerial] = React.useState('');
  const [status, setStatus] = React.useState('in_stock');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const value = serial.trim();
    if (!value) {
      setError('Enter a serial number.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const result = await createSerialUnitAction(lotId, {
        variantId,
        warehouseId,
        lotBatchId: lotId,
        serial: value,
        status,
      });
      if (!result.ok) {
        setError(result.error.message);
        setBusy(false);
        return;
      }
      setSerial('');
      setStatus('in_stock');
      setBusy(false);
      router.refresh();
    })();
  }

  return (
    <Stack gap={2}>
      <Stack
        direction="row"
        gap={3}
        align="end"
        wrap
        className="rounded border border-dashed border-[var(--color-border-default)] p-3"
      >
        <Stack gap={1} className="min-w-[12rem] flex-1">
          <Label htmlFor="add-serial">Add serial number</Label>
          <Input
            id="add-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. SN-0001"
          />
        </Stack>
        <Stack gap={1} className="w-[9rem]">
          <Label htmlFor="add-serial-status">Status</Label>
          <NativeSelect
            id="add-serial-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {SERIAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Stack>
        <Button color="module" type="button" onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add serial'}
        </Button>
      </Stack>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}
