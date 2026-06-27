'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Checkbox, Input, NativeSelect, Stack, Text } from '@sparx/ui';
import type { RecordReturnInspectionInput } from '@sparx/commerce-schemas';

import { recordReturnInspectionAction } from '../../../return-actions';

interface ReturnLineItem {
  id: string;
  orderItemId: string;
  quantity: number;
  approvedQuantity: number;
}

const CONDITIONS = [
  'unopened',
  'like_new',
  'used_good',
  'used_acceptable',
  'damaged',
  'destroyed',
] as const;

type Condition = (typeof CONDITIONS)[number];

interface LineState {
  condition: Condition;
  restockable: boolean;
  note: string;
}

export function ReturnInspectionForm({
  returnId,
  items,
}: {
  returnId: string;
  items: ReturnLineItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<Record<string, LineState>>(
    Object.fromEntries(
      items.map((it) => [it.id, { condition: 'like_new', restockable: true, note: '' }])
    )
  );

  function update(itemId: string, patch: Partial<LineState>) {
    setState((prev) => ({ ...prev, [itemId]: { ...prev[itemId]!, ...patch } }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const inspections: RecordReturnInspectionInput['inspections'] = items
      .filter((it) => it.approvedQuantity > 0)
      .map((it) => {
        const line = state[it.id]!;
        return {
          returnLineItemId: it.id,
          condition: line.condition,
          restockable: line.restockable,
          photoMediaIds: [],
          ...(line.note.trim() ? { note: line.note.trim() } : {}),
        };
      });

    if (inspections.length === 0) {
      setError('No approved-quantity lines to inspect.');
      return;
    }

    startTransition(async () => {
      const result = await recordReturnInspectionAction({ returnId, inspections });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={3}>
        {items.map((it) => {
          const line = state[it.id]!;
          const disabled = it.approvedQuantity === 0;
          return (
            <Stack
              key={it.id}
              direction="row"
              gap={2}
              align="center"
              className={disabled ? 'opacity-60' : ''}
            >
              <Text size="xs" className="w-32 font-mono">
                {it.orderItemId.slice(0, 8)}
              </Text>
              <NativeSelect
                value={line.condition}
                onChange={(e) => update(it.id, { condition: e.target.value as Condition })}
                disabled={disabled}
                className="w-44"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-1.5">
                <Checkbox
                  color="module"
                  checked={line.restockable}
                  onCheckedChange={(checked) => update(it.id, { restockable: checked === true })}
                  disabled={disabled}
                />
                <Text size="xs">restock</Text>
              </label>
              <Input
                placeholder="note"
                value={line.note}
                onChange={(e) => update(it.id, { note: e.target.value })}
                disabled={disabled}
                className="flex-1"
              />
            </Stack>
          );
        })}
        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite">
            {error}
          </Text>
        )}
        <Stack direction="row" gap={2} justify="end">
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Recording…' : 'Record inspection'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
