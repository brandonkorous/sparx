'use client';

// Writing down that something is coming back, with ONE reason for the whole return. The common case
// is one garment for one reason, so a reason per line asks a question it does not have; two reasons
// are two returns, which is also how they are inspected and settled.

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
  /** Opens the return that was just made, so the next step, approving it, is
   *  one click away rather than a hunt through a list. */
  onStarted: (returnId: string) => void;
}

/** Chosen quantity per line. Absent means "not going back". */
type Chosen = Record<string, number>;

function LineRow(props: {
  line: ReturnableLine;
  chosen: number | undefined;
  currency: string;
  onChange: (quantity: number) => void;
}) {
  const { line, chosen, onChange } = props;
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
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-base font-medium">{line.name}</span>
        <span className="font-mono text-sm">{line.sku}</span>
      </span>
      <span className="text-base tabular-nums">{formatMoney(line.unitPrice, props.currency)}</span>
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

function OptionField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
      <span className="text-base font-medium">{label}</span>
      <NativeSelect
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

function useSubmitReturn(
  orderId: string,
  reset: () => void,
  onStarted: (returnId: string) => void
) {
  const start = useStartReturn();
  const toast = useToast();
  const send = (preferredOutcome: string, items: StartReturnLine[]) => {
    start.mutate(
      { orderId, preferredOutcome, items },
      {
        onSuccess: (created) => {
          reset();
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
  };
  return { send, isPending: start.isPending };
}

function useReturnForm(
  orderId: string,
  lines: ReturnableLine[],
  onStarted: (returnId: string) => void
) {
  const [chosen, setChosen] = useState<Chosen>({});
  const [reason, setReason] = useState<string>(DEFAULT_RETURN_REASON);
  const [outcome, setOutcome] = useState<string>(DEFAULT_RETURN_OUTCOME);
  const [note, setNote] = useState('');
  const start = useSubmitReturn(
    orderId,
    () => {
      setChosen({});
      setNote('');
    },
    onStarted
  );

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
    start.send(outcome, picked);
  }

  const fields = { reason, setReason, outcome, setOutcome, note, setNote };
  return { start, chosen, setChosen, picked, submit, fields };
}

function ReturnChoices({ form }: { form: ReturnType<typeof useReturnForm> }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <OptionField
        label="Why it is going back"
        value={form.fields.reason}
        options={RETURN_REASONS}
        onChange={form.fields.setReason}
      />
      <OptionField
        label="What they want instead"
        value={form.fields.outcome}
        options={RETURN_OUTCOMES}
        onChange={form.fields.setOutcome}
      />
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
        <span className="text-base font-medium">Anything they said (optional)</span>
        <Input
          value={form.fields.note}
          placeholder="Wants it in Slate instead…"
          onChange={(event) => {
            form.fields.setNote(event.target.value);
          }}
        />
      </label>
      <Button
        type="submit"
        color="primary"
        loading={form.start.isPending}
        disabled={form.picked.length === 0}
      >
        Start the return
      </Button>
    </div>
  );
}

export function StartReturn({ orderId, currency, lines, onStarted }: StartReturnProps) {
  const form = useReturnForm(orderId, lines, onStarted);

  return (
    <form onSubmit={form.submit} className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <Text className="text-base font-medium">What is coming back</Text>
      <div className="flex flex-col">
        {lines.map((line) => (
          <LineRow
            key={line.orderItemId}
            line={line}
            currency={currency}
            chosen={form.chosen[line.orderItemId]}
            onChange={(quantity) => {
              form.setChosen((current) => ({ ...current, [line.orderItemId]: quantity }));
            }}
          />
        ))}
      </div>

      <ReturnChoices form={form} />
    </form>
  );
}
