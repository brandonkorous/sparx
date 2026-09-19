'use client';

// WHOSE THESE UNITS ARE — on the screen that says how many there are.
//
// ── Why this file exists ─────────────────────────────────────────────────
//
// The whole ownership axis was built and reachable from nowhere. `Whose stock`
// listed the exceptions, the endpoints existed, `useSetOwnership` was written
// with its cache invalidation worked out — and no screen called it. The
// exception list's own empty state said:
//
//   "Set it on an item's stock screen when you start holding goods you have not
//    bought."
//
// There was nothing to set on an item's stock screen. A sentence telling
// somebody where to go, pointing at a place with nothing there, is worse than
// no sentence: they go and look, and conclude they have misunderstood.
// [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── Per location, because that is where the answer lives ─────────────────
//
// Ownership is a fact about (this item × this place). Mixing owned and consigned
// units of the same thing in the same room has no answer to "which one did I
// just sell", so the model refuses to pretend — and so does this block, which
// sits on the location card rather than at the top of the pane.
//
// ── What it changes, said out loud ───────────────────────────────────────
//
// Exactly one thing: whether the units count toward what your stock is worth.
// It does NOT hold them back from your website, and a business owner reaching
// for "this is not mine" to stop something selling wants the unsellable shelf
// instead. The block says so, because the opposite is the natural assumption.

import { useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  Badge,
  Button,
  Field,
  FieldLabel,
  NativeSelect,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faHandshake } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { useSetOwnership, type SetOwnershipInput } from './demand-data';
import { useSuppliers } from './suppliers-data';
import { useCustomers } from '../crm/customers-data';
import { stockErrorMessage, type StockLevel } from './data';

type Ownership = SetOwnershipInput['ownership'];

/** What each answer means, in the words somebody would use out loud. */
const CHOICES: { value: Ownership; label: string }[] = [
  { value: 'owned', label: 'Mine. I bought it' },
  { value: 'consignment', label: "A supplier's, until it sells" },
  { value: 'customer_owned', label: "A customer's own goods" },
  { value: '3pl_owned', label: "A warehouse partner's" },
];

/** Who has to be named for each answer. `owned` names nobody. */
function ownerKind(ownership: Ownership): 'none' | 'supplier' | 'customer' {
  if (ownership === 'owned') return 'none';
  if (ownership === 'customer_owned') return 'customer';
  return 'supplier';
}

/** What to call a customer in the picker. The two brands type the row
 *  differently, so the name is assembled here from the parts both carry, and a
 *  record with neither a name nor an email says so rather than drawing a blank
 *  option nobody can choose between. */
function customerLabel(customer: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}): string {
  // Written out rather than an `||` chain: every one of these can be the EMPTY
  // STRING as well as null, and `??` would happily hand back the empty one.
  const parts = [customer.firstName, customer.lastName, customer.company, customer.email];
  for (const part of parts) {
    const written = part?.trim() ?? '';
    if (written !== '') return written;
  }
  return 'A customer with no name on file';
}

/** The badge that goes beside the location's name when the stock is not yours. */
export function OwnershipBadge({ level }: { level: StockLevel }) {
  if (level.ownership === 'owned') return null;
  const label = CHOICES.find((c) => c.value === level.ownership)?.label ?? 'Not yours';
  return (
    <Badge color="warning" variant="soft" size="sm">
      <Icon glyph={faHandshake} className="size-3" aria-hidden />
      {level.ownerName === null ? label : `Held for ${level.ownerName}`}
    </Badge>
  );
}

export function StockOwnershipBlock({
  variantId,
  level,
  onDone,
}: {
  variantId: string;
  level: StockLevel;
  onDone: () => void;
}) {
  const toast = useToast();
  const save = useSetOwnership();

  const [ownership, setOwnership] = useState<Ownership>(
    CHOICES.find((choice) => choice.value === level.ownership)?.value ?? 'owned'
  );
  const [supplierId, setSupplierId] = useState(level.ownerSupplierId ?? '');
  const [customerId, setCustomerId] = useState(level.ownerCustomerId ?? '');

  const kind = ownerKind(ownership);
  // Only asked for when it is about to be shown. A shop that never holds
  // anybody else's goods never fetches either list.
  const suppliers = useSuppliers({ take: 200, skip: 0, includeArchived: false });
  const customers = useCustomers({});
  const supplierRows = suppliers.data?.items ?? [];
  const customerRows = customers.data?.items ?? [];

  // The server refuses consigned stock with nobody named, because somebody is
  // owed for it when it sells. Refusing here, where the person is looking,
  // beats refusing three weeks later at settlement.
  const needsOwner = ownership === 'consignment';
  const named =
    kind === 'supplier' ? supplierId !== '' : kind === 'customer' ? customerId !== '' : true;
  const canSave = !needsOwner || named;

  const submit = () => {
    const input: SetOwnershipInput = {
      variantId,
      warehouseId: level.warehouseId,
      ownership,
      ownerSupplierId: kind === 'supplier' && supplierId !== '' ? supplierId : null,
      ownerCustomerId: kind === 'customer' && customerId !== '' ? customerId : null,
    };
    save.mutate(input, {
      onSuccess: () => {
        onDone();
        toast.add({
          title:
            ownership === 'owned'
              ? `${level.warehouseName} is marked as your own stock`
              : `${level.warehouseName} is marked as somebody else's stock`,
          description:
            ownership === 'owned'
              ? 'These units count toward what your stock is worth again.'
              : 'These units still sell as normal. They no longer count toward what your stock is worth.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change who owns this',
          description: stockErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className="border-base-300 flex flex-col gap-3 border-t pt-3">
      <Field>
        <FieldLabel>Whose stock this is at {level.warehouseName}</FieldLabel>
        <NativeSelect
          size="sm"
          value={ownership}
          onChange={(event) => {
            setOwnership(event.target.value as Ownership);
          }}
        >
          {CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {kind === 'supplier' ? (
        <Field>
          <FieldLabel>Who it belongs to</FieldLabel>
          <NativeSelect
            size="sm"
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value);
            }}
          >
            <option value="">Nobody named yet</option>
            {supplierRows.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </NativeSelect>
          {supplierRows.length === 0 && !suppliers.isLoading ? (
            <Text className="text-sm">
              You have no suppliers on file yet. Add one under Partners and it will appear here.
            </Text>
          ) : null}
        </Field>
      ) : null}

      {kind === 'customer' ? (
        <Field>
          <FieldLabel>Whose goods they are</FieldLabel>
          <NativeSelect
            size="sm"
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
            }}
          >
            <option value="">Nobody named yet</option>
            {customerRows.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerLabel(customer)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      {/* The assumption everybody makes, corrected before they act on it. */}
      <Alert color={ownership === 'owned' ? 'info' : 'warning'} variant="soft">
        <AlertContent>
          <AlertDescription>
            {ownership === 'owned'
              ? 'Your own stock counts toward what your stock is worth, which is the figure your books and your valuation reports use.'
              : 'Stock that is not yours still sells exactly as normal, because being able to sell it is the whole reason to hold it. What changes is what your stock is WORTH: these units stop counting as money you have tied up, so your valuation is not overstated by somebody else’s goods.'}
          </AlertDescription>
        </AlertContent>
      </Alert>

      {needsOwner && !named ? (
        <Text className="text-sm">
          Consigned stock needs an owner: somebody is owed for it when it sells.
        </Text>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          color="module"
          disabled={!canSave}
          loading={save.isPending}
          onClick={submit}
        >
          Save who owns this
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
