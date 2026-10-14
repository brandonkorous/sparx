'use client';

// "Have a supplier ship this": the owner's side of a supplier who ships when sent
// the order (sparx persona issue 171).
//
// The panel used to say there was no switch for this, because a product became a
// supplier's only by importing it from their list. A maker or wholesaler who
// ships to the customer has no list: the owner already sells the product. So the
// owner chooses the supplier here, says the supplier's code for it and what they
// charge, and every sale of it is emailed to them from then on.

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
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { Plus, Truck, Unlink } from 'lucide-react';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  formatCents,
  productErrorMessage,
  type DropshipLink,
  type Product,
  type ProductDropship,
} from './products-data';
import {
  useHandLinkedSuppliers,
  useShipFromSupplier,
  useStopSupplierShipping,
} from './product-dropship-link-data';

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

/** The form: who ships it, their code, their price. Used to start it and to
 *  change it; when changing, the supplier is fixed. */
function ShipFromSupplierForm({
  product,
  data,
  suppliers,
  link,
  onDone,
}: {
  product: Product;
  data: ProductDropship;
  suppliers: { id: string; name: string }[];
  /** The link being changed, or undefined to start one. */
  link?: DropshipLink;
  onDone?: () => void;
}) {
  const toast = useToast();
  const ship = useShipFromSupplier(product.id);
  const first = data.variants[0];
  const [supplierId, setSupplierId] = useState(
    link?.supplier.id ?? (suppliers.length === 1 ? (suppliers.at(0)?.id ?? '') : '')
  );
  const [code, setCode] = useState(link?.supplierSku ?? first?.sku ?? '');
  const [cost, setCost] = useState(
    centsToTyped(link ? link.source.costPriceCents : (first?.costCents ?? null))
  );
  const [touched, setTouched] = useState(false);

  const costCents = toCents(cost);
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? link?.supplier.name;
  const problem =
    supplierId === ''
      ? 'Choose who ships it.'
      : code.trim() === ''
        ? 'Give their code for it.'
        : costCents === null
          ? 'Say what they charge you, like 1100.00.'
          : null;
  // What one sale leaves the business, when every version sells at one price.
  const prices = new Set(data.variants.map((v) => v.priceCents));
  const margin =
    costCents !== null && first && prices.size === 1 ? first.priceCents - costCents : null;

  const submit = () => {
    setTouched(true);
    if (problem || costCents === null) return;
    ship.mutate(
      { supplierId, supplierSku: code, costCents },
      {
        onSuccess: () => {
          toast.add({
            title: link ? 'Saved' : `${supplierName ?? 'Your supplier'} ships ${product.title} now`,
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
      }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {link ? null : (
        <Field>
          <FieldLabel>Who ships it</FieldLabel>
          <Select
            color="module"
            aria-label="Who ships it"
            value={supplierId}
            placeholder="Choose a supplier…"
            items={Object.fromEntries(suppliers.map((s) => [s.id, s.name]))}
            onValueChange={(next) => {
              setSupplierId(next as string);
            }}
          />
        </Field>
      )}
      <div className="grid gap-3 @md:grid-cols-2">
        <Field>
          <FieldLabel>Their code for it</FieldLabel>
          <FieldControl
            render={
              <Input
                color={touched && code.trim() === '' ? 'error' : 'module'}
                value={code}
                spellCheck={false}
                onChange={(event) => {
                  setCode(event.target.value);
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
                color={touched && costCents === null ? 'error' : 'module'}
                value={cost}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(event) => {
                  setCost(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            {margin === null || !first
              ? 'For one, before shipping.'
              : margin > 0
                ? `You sell it for ${formatCents(first.priceCents, first.currency)}, so you make ${formatCents(margin, first.currency)} on each.`
                : `You sell it for ${formatCents(first.priceCents, first.currency)}, so you would lose money on each.`}
          </FieldDescription>
        </Field>
      </div>
      {touched && problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onDone ? (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button size="sm" color="module" loading={ship.isPending} onClick={submit}>
          {link ? (
            'Save'
          ) : (
            <>
              <Truck className="size-4" aria-hidden />
              They ship this
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * On a product nobody ships for the business: choose the supplier who will. When
 * there is no such supplier yet, the way to add one, already on the right kind.
 */
export function ShipFromSupplierSection({
  ctx,
  product,
  data,
}: {
  ctx: SurfaceContext;
  product: Product;
  data: ProductDropship;
}) {
  const { suppliers, isError } = useHandLinkedSuppliers();

  if (isError) {
    return (
      <Text className="text-sm">
        Your suppliers could not be loaded, so nobody can be chosen to ship this right now.
      </Text>
    );
  }
  if (suppliers === undefined) {
    return (
      <p className="text-sm" role="status">
        Loading your suppliers…
      </p>
    );
  }
  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <Text className="text-sm">
          A maker or wholesaler who ships to your customer when you send them the order can ship
          this for you. Add them first, with the email address they take orders at.
        </Text>
        <div className="flex justify-start">
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open(
                'dropship.supplier.detail',
                { id: 'new', type: 'direct' },
                { target: 'tab' }
              );
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add a supplier you send orders to
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Text className="text-sm">
        Have a supplier ship {product.title} to your customer. Each time someone buys it, we email
        them the order from your business, with your customer’s address.
      </Text>
      <ShipFromSupplierForm product={product} data={data} suppliers={suppliers} />
    </div>
  );
}

/** On a product a supplier ships by hand-made link: change their code or price,
 *  or stop them shipping it. Takes the place of "Pull it again", which needs a
 *  product list they do not have. */
export function HandLinkedActions({
  link,
  product,
  data,
}: {
  link: DropshipLink;
  product: Product;
  data: ProductDropship;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const stop = useStopSupplierShipping(product.id);
  const [editing, setEditing] = useState(false);

  const onStop = () => {
    void (async () => {
      const ok = await confirm({
        title: `Stop ${link.supplier.name} shipping ${product.title}?`,
        description:
          'From now on, when someone buys it, the order is not emailed to them: you pick, pack and post it yourself. Orders already sent to them are not changed.',
        confirmLabel: 'Stop them shipping it',
        cancelLabel: 'Keep it with them',
        color: 'warning',
      });
      if (!ok) return;
      stop.mutate(link.id, {
        onSuccess: () => {
          toast.add({ title: `You ship ${product.title} yourself now`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not change who ships it',
            description: productErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      });
    })();
  };

  if (editing) {
    return (
      <div className="border-base-300 border-t pt-4">
        <ShipFromSupplierForm
          product={product}
          data={data}
          suppliers={[{ id: link.supplier.id, name: link.supplier.name }]}
          link={link}
          onDone={() => {
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className="border-base-300 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
      <Button
        size="sm"
        variant="outline"
        color="module"
        onClick={() => {
          setEditing(true);
        }}
      >
        Change their code or price
      </Button>
      <Button size="sm" variant="outline" color="warning" loading={stop.isPending} onClick={onStop}>
        <Unlink className="size-4" aria-hidden />
        Stop them shipping it
      </Button>
    </div>
  );
}
