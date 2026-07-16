'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  NativeSelect,
} from '@wizeworks/silicaui-react';

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
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Serials</h3>
          <p className="text-base-content text-sm">
            {serials.length} unit{serials.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {serials.length === 0 ? (
            <p className="text-base-content text-sm">No serials on this lot yet — add one below.</p>
          ) : (
            serials.map((s) => <SerialRowItem key={s.id} lotId={lotId} serial={s} />)
          )}
          <AddSerialRow lotId={lotId} variantId={variantId} warehouseId={warehouseId} />
        </div>
      </CardBody>
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
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
        <p className="font-mono text-sm font-medium">{s.serial}</p>
        {s.soldOnOrderItemId ? (
          <p className="text-base-content text-xs">sold on order item</p>
        ) : null}
      </div>
      <Badge color={serialStatusColor(s.status)}>{serialStatusLabel(s.status)}</Badge>
      <div className="flex w-[9rem] flex-col gap-0">
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
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
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
    <div className="flex flex-col gap-2">
      <div className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded border border-dashed p-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
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
        </div>
        <div className="flex w-[9rem] flex-col gap-1">
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
        </div>
        <Button color="module" type="button" onClick={add} disabled={busy}>
          {busy ? 'Adding…' : 'Add serial'}
        </Button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
