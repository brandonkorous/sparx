'use client';

// The "who ships it, their code, their price" form for a supplier who ships when
// sent the order (sparx persona issue 171). Starts a link, or changes one.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  useToast,
} from '@wizeworks/silicaui-react';
import { faTruck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  formatCents,
  productErrorMessage,
  type DropshipLink,
  type Product,
  type ProductDropship,
} from './products-data';
import { useShipFromSupplier } from './product-dropship-link-data';

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Dollars typed in a box, as cents; null when it is not an amount. */
function toCents(typed: string): number | null {
  const value = typed.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!MONEY.test(value)) return null;
  return Math.round(Number(value) * 100);
}

function centsToTyped(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

export interface ShipFormProps {
  product: Product;
  data: ProductDropship;
  suppliers: { id: string; name: string }[];
  /** The link being changed, or undefined to start one. */
  link?: DropshipLink;
  onDone?: () => void;
}

/** What is typed, what is wrong with it, and what one sale leaves the business. */
function useShipForm({ data, suppliers, link }: ShipFormProps) {
  const first = data.variants.at(0);
  const [supplierId, setSupplierId] = useState(
    link?.supplier.id ?? (suppliers.length === 1 ? suppliers[0].id : '')
  );
  const [code, setCode] = useState(link?.supplierSku ?? first?.sku ?? '');
  const [cost, setCost] = useState(
    centsToTyped(link ? link.source.costPriceCents : (first?.costCents ?? null))
  );
  const [touched, setTouched] = useState(false);
  const costCents = toCents(cost);
  const problem =
    supplierId === ''
      ? 'Choose who ships it.'
      : code.trim() === ''
        ? 'Give their code for it.'
        : costCents === null
          ? 'Say what they charge you, like 1100.00.'
          : null;
  const onePrice = new Set(data.variants.map((v) => v.priceCents)).size === 1;
  const margin = costCents !== null && first && onePrice ? first.priceCents - costCents : null;
  return {
    first,
    supplierId,
    setSupplierId,
    code,
    setCode,
    cost,
    setCost,
    touched,
    setTouched,
    costCents,
    problem,
    margin,
  };
}

type ShipForm = ReturnType<typeof useShipForm>;

function marginWords(form: ShipForm): string {
  const { first, margin } = form;
  if (margin === null || !first) return 'For one, before shipping.';
  const price = formatCents(first.priceCents, first.currency);
  return margin > 0
    ? `You sell it for ${price}, so you make ${formatCents(margin, first.currency)} on each.`
    : `You sell it for ${price}, so you would lose money on each.`;
}

function CodeAndCost({ form }: { form: ShipForm }) {
  return (
    <div className="grid gap-3 @md:grid-cols-2">
      <Field>
        <FieldLabel>Their code for it</FieldLabel>
        <FieldControl
          render={
            <Input
              color={form.touched && form.code.trim() === '' ? 'error' : 'module'}
              value={form.code}
              spellCheck={false}
              onChange={(event) => {
                form.setCode(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>The part number they pick it by.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>What they charge you</FieldLabel>
        <FieldControl
          render={
            <Input
              color={form.touched && form.costCents === null ? 'error' : 'module'}
              value={form.cost}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => {
                form.setCost(event.target.value);
              }}
            />
          }
        />
        <FieldDescription>{marginWords(form)}</FieldDescription>
      </Field>
    </div>
  );
}

function SupplierPicker({ form, props }: { form: ShipForm; props: ShipFormProps }) {
  if (props.link) return null;
  return (
    <Field>
      <FieldLabel>Who ships it</FieldLabel>
      <Select
        color="module"
        aria-label="Who ships it"
        value={form.supplierId}
        placeholder="Choose a supplier…"
        items={Object.fromEntries(props.suppliers.map((s) => [s.id, s.name]))}
        onValueChange={(next) => {
          form.setSupplierId(next as string);
        }}
      />
    </Field>
  );
}

/** Saves the form; says what happened in a toast. */
function useSubmit(form: ShipForm, props: ShipFormProps) {
  const toast = useToast();
  const ship = useShipFromSupplier(props.product.id);
  const { product, link, suppliers, onDone } = props;
  const name = suppliers.find((s) => s.id === form.supplierId)?.name ?? 'Your supplier';
  const submit = () => {
    form.setTouched(true);
    if (form.problem || form.costCents === null) return;
    const input = {
      supplierId: form.supplierId,
      supplierSku: form.code,
      costCents: form.costCents,
    };
    ship.mutate(input, {
      onSuccess: () => {
        toast.add({
          title: link ? 'Saved' : `${name} ships ${product.title} now`,
          description: link
            ? undefined
            : 'When someone buys it, we email them the order from your business.',
          type: 'success',
        });
        onDone?.();
      },
      onError: (error) => {
        toast.add({
          title: 'Could not save that',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };
  return { submit, isPending: ship.isPending };
}

export function ShipFromSupplierForm(props: ShipFormProps) {
  const form = useShipForm(props);
  const { submit, isPending } = useSubmit(form, props);
  return (
    <div className="flex flex-col gap-3">
      <SupplierPicker form={form} props={props} />
      <CodeAndCost form={form} />
      {form.touched && form.problem ? (
        <FieldStatus status="error">{form.problem}</FieldStatus>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {props.onDone ? (
          <Button size="sm" variant="ghost" onClick={props.onDone}>
            Cancel
          </Button>
        ) : null}
        <Button size="sm" color="module" loading={isPending} onClick={submit}>
          {props.link ? null : <Icon glyph={faTruck} className="size-4" aria-hidden />}
          {props.link ? 'Save' : 'They ship this'}
        </Button>
      </div>
    </div>
  );
}
