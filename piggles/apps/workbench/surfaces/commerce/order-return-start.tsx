'use client';

// Writing down that something is coming back.
//
// ONE reason for the whole return, not one per line. The schema allows a reason
// per line and the common case by a distance is a single garment going back for
// a single reason; a reason column beside every line makes the one-line case
// answer a question it does not have. Two things going back for two different
// reasons are two returns, which is also how they will be inspected and settled.

import { useState } from 'react';
import { Button, Checkbox, Input, NativeSelect, Text, useToast } from '@wizeworks/silicaui-react';

import { formatMoney } from './data';
import { useStartReturn, type ReturnableLine, type StartReturnLine } from './order-return-data';
import {
  DEFAULT_RETURN_OUTCOME,
  DEFAULT_RETURN_REASON,
  RETURN_OUTCOMES,
  RETURN_REASONS,
  returnErrorMessage,
} from './returns-data';

interface StartReturnProps {
  orderId: string;
  currency: string;
  lines: ReturnableLine[];
  /** Opens the return that was just made, so the next step — approving it — is
   *  one click away rather than a hunt through a list. */
  onStarted: (returnId: string) => void;
}

/** Chosen quantity per line. Absent means "not going back". */
type Chosen = Record<string, number>;

function LineRow({
  line,
  chosen,
  currency,
  onChange,
}: {
  line: ReturnableLine;
  chosen: number | undefined;
  currency: string;
  onChange: (quantity: number) => void;
}) {
  const picked = (chosen ?? 0) > 0;
  return (
    <label className="border-base-300 flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
      <Checkbox
        color="module"
        checked={picked}
        aria-label={`Send back ${line.name}`}
        onChange={(event) => {
          onChange(event.target.checked ? 1 : 0);
        }}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-base font-medium">{line.name}</span>
        <span className="font-mono text-sm">{line.sku}</span>
      </span>
      <span className="text-base tabular-nums">{formatMoney(line.unitPrice, currency)}</span>
      {/* The stepper appears only once the line is chosen, and only when there
          is genuinely a choice to make. On a single garment it would be a box
          that can hold exactly one number. */}
      {picked && line.most > 1 ? (
        <span className="flex items-center gap-2">
          <span className="text-sm">How many</span>
          <Input
            type="number"
            min={1}
            max={line.most}
            value={String(chosen ?? 1)}
            className="w-20"
            aria-label={`How many ${line.name} are coming back`}
            onChange={(event) => {
              const asked = Number(event.target.value);
              if (!Number.isFinite(asked)) return;
              onChange(Math.min(Math.max(Math.round(asked), 1), line.most));
            }}
          />
          <span className="text-sm">of {line.most}</span>
        </span>
      ) : null}
    </label>
  );
}

export function StartReturn({ orderId, currency, lines, onStarted }: StartReturnProps) {
  const start = useStartReturn();
  const toast = useToast();
  const [chosen, setChosen] = useState<Chosen>({});
  const [reason, setReason] = useState<string>(DEFAULT_RETURN_REASON);
  const [outcome, setOutcome] = useState<string>(DEFAULT_RETURN_OUTCOME);
  const [note, setNote] = useState('');

  const picked: StartReturnLine[] = lines
    .filter((line) => (chosen[line.orderItemId] ?? 0) > 0)
    .map((line) => ({
      orderItemId: line.orderItemId,
      quantity: chosen[line.orderItemId] ?? 1,
      reasonCode: reason,
      ...(note.trim() ? { customerNote: note.trim() } : {}),
    }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (picked.length === 0) return;
    start.mutate(
      { orderId, preferredOutcome: outcome, items: picked },
      {
        onSuccess: (created) => {
          setChosen({});
          setNote('');
          toast.add({
            title: 'Return opened',
            description: 'Approve it when you are happy for the goods to come back.',
            type: 'success',
          });
          onStarted(created.id);
        },
        onError: (error) => {
          toast.add({
            title: 'Could not open the return',
            description: returnErrorMessage(
              error,
              'Nothing was recorded against this order. Try again in a moment.'
            ),
            type: 'error',
          });
        },
      }
    );
  }

  return (
    <form onSubmit={submit} className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <Text className="text-base font-medium">What is coming back</Text>
      <div className="flex flex-col">
        {lines.map((line) => (
          <LineRow
            key={line.orderItemId}
            line={line}
            currency={currency}
            chosen={chosen[line.orderItemId]}
            onChange={(quantity) => {
              setChosen((current) => ({ ...current, [line.orderItemId]: quantity }));
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="text-base font-medium">Why it is going back</span>
          <NativeSelect
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          >
            {RETURN_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="text-base font-medium">What they want instead</span>
          <NativeSelect
            value={outcome}
            onChange={(event) => {
              setOutcome(event.target.value);
            }}
          >
            {RETURN_OUTCOMES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="text-base font-medium">Anything they said (optional)</span>
          <Input
            value={note}
            placeholder="Wants it in Slate instead…"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
        <Button
          type="submit"
          color="primary"
          loading={start.isPending}
          disabled={picked.length === 0}
        >
          Start the return
        </Button>
      </div>
    </form>
  );
}
