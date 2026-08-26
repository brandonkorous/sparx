'use client';

// Recording what came back.

import { useEffect, useState } from 'react';
import {
  Checkbox,
  Field,
  FieldLabel,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';

import { ActionDialog, CONDITIONS } from './return-action-dialog';
import {
  conditionLabel,
  returnErrorMessage,
  useInspectReturn,
  type ReturnDetail,
} from './returns-data';

/** Record what came back. One condition per line, and whether it can go back on
 *  the shelf — restockable lines are added back into stock when you settle. */
export function InspectReturnModal({
  detail,
  open,
  onClose,
}: {
  detail: ReturnDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const inspect = useInspectReturn(detail.id);
  const [rows, setRows] = useState<Record<string, { condition: string; restockable: boolean }>>({});

  useEffect(() => {
    if (open) {
      setRows(
        Object.fromEntries(
          detail.items.map((it) => [it.id, { condition: 'like_new', restockable: true }])
        )
      );
    }
  }, [open, detail.items]);

  const submit = () => {
    const inspections = detail.items.map((it) => {
      const row = rows[it.id] ?? { condition: 'like_new', restockable: true };
      return {
        returnLineItemId: it.id,
        condition: row.condition,
        restockable: row.restockable,
      };
    });
    inspect.mutate(
      { inspections },
      {
        onSuccess: () => {
          toast.add({ title: 'Condition recorded', type: 'success' });
          onClose();
        },
        onError: (error) => {
          toast.add({
            title: 'Could not record the inspection',
            description: returnErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Record what came back"
      // "…when you settle the refund" was wrong on an exchange, where no refund
      // is ever settled and the restock would then have had no trigger at all
      // (issue 220). What actually puts it back is the decision below.
      description="Note the condition of each item. Anything you mark fit to resell goes back into your stock once you say what happens to it."
      submitLabel="Save the check"
      busy={inspect.isPending}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {detail.items.map((it) => {
          const row = rows[it.id] ?? { condition: 'like_new', restockable: true };
          return (
            <div key={it.id} className="flex flex-col gap-2">
              <span className="text-base font-medium">{it.orderItemName ?? 'Item'}</span>
              <div className="flex flex-wrap items-end gap-3">
                <Field className="min-w-[10rem] flex-1">
                  <FieldLabel>Condition</FieldLabel>
                  <NativeSelect
                    color="module"
                    value={row.condition}
                    aria-label={`Condition of ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setRows((current) => ({
                        ...current,
                        [it.id]: { ...row, condition: event.target.value },
                      }));
                    }}
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {conditionLabel(condition)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <label className="flex h-9 items-center gap-2">
                  <Checkbox
                    color="module"
                    checked={row.restockable}
                    aria-label={`Fit to resell — ${it.orderItemName ?? 'item'}`}
                    onChange={(event) => {
                      setRows((current) => ({
                        ...current,
                        [it.id]: { ...row, restockable: event.target.checked },
                      }));
                    }}
                  />
                  <Text as="span">Fit to resell</Text>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </ActionDialog>
  );
}
