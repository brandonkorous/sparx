'use client';

// "What is going back" on a new return: add items by code, then set how many
// and what was paid for each.

import { Button, Field, FieldControl, FieldLabel, Input, Text } from '@wizeworks/silicaui-react';
import { faCirclePlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { MoneyTextInput } from '../../components/money-input';
import { Table } from '../../components/table';
import type { DraftLine, NewReturnState } from './use-supplier-return-new';

type SetLines = NewReturnState['setLines'];

export function NewReturnLines({ form }: { form: NewReturnState }) {
  return (
    <FormSection
      title="What is going back"
      description="Add each item by its code. Leave the cost blank and we will use what you paid."
    >
      <SkuAdder form={form} />

      {form.lines.length === 0 ? (
        <Text className="text-sm">Nothing added yet.</Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="w-24 text-right">Going back</th>
              <th className="w-32 text-right">Paid each</th>
              <th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((line, index) => (
              <DraftLineRow
                key={`${line.variantId}:${index}`}
                line={line}
                index={index}
                setLines={form.setLines}
              />
            ))}
          </tbody>
        </Table>
      )}
    </FormSection>
  );
}

function SkuAdder({ form }: { form: NewReturnState }) {
  return (
    <div className="flex items-end gap-2">
      <Field className="flex-1">
        <FieldLabel>Item code</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={form.skuInput}
              placeholder="SATCHEL-1"
              onChange={(event) => {
                form.setSkuInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                form.addLine();
              }}
            />
          }
        />
      </Field>
      <Button color="module" loading={form.lookup.isPending} onClick={form.addLine}>
        <Icon glyph={faCirclePlus} className="size-4" aria-hidden />
        Add
      </Button>
    </div>
  );
}

interface LineProps {
  line: DraftLine;
  index: number;
  setLines: SetLines;
}

function DraftLineRow({ line, index, setLines }: LineProps) {
  return (
    <tr>
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{line.productTitle ?? 'Untitled product'}</span>
          <span className="truncate font-mono text-sm">{line.sku}</span>
        </span>
      </td>
      <td>
        <QuantityInput line={line} index={index} setLines={setLines} />
      </td>
      <td>
        <MoneyTextInput
          size="sm"
          color="module"
          className="w-28"
          placeholder="What you paid"
          aria-label={`What you paid for each ${line.sku}`}
          text={line.unitCost}
          onTextChange={(unitCost) => {
            setLines((current) => current.map((l, i) => (i === index ? { ...l, unitCost } : l)));
          }}
        />
      </td>
      <td className="w-0">
        <Button
          size="sm"
          variant="ghost"
          color="danger"
          aria-label={`Remove ${line.sku}`}
          onClick={() => {
            setLines((current) => current.filter((_, i) => i !== index));
          }}
        >
          <Icon glyph={faTrashCan} className="size-4" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}

function QuantityInput({ line, index, setLines }: LineProps) {
  return (
    <Input
      size="sm"
      color="module"
      type="number"
      min={1}
      aria-label={`How many ${line.sku} are going back`}
      /* A WIDTH. The item cell beside this is `w-full`, so an unfloored number
         box pays the whole shortfall: about 20px, a sliver of the digit. Receiving
         and recipes next door have carried `w-20`/`w-24` all along. */
      className="w-20 text-right tabular-nums"
      value={line.quantity}
      onChange={(event) => {
        const quantity = Number.parseInt(event.target.value, 10);
        setLines((current) =>
          current.map((l, i) =>
            i === index ? { ...l, quantity: Number.isFinite(quantity) ? quantity : 1 } : l
          )
        );
      }}
    />
  );
}
