// Order details: who it is from, where it lands, and the reference. Editable on a
// draft; on a placed order each value is a settled FACT, not a faded control.

import {
  Combobox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import type { PurchaseOrderPane } from './use-purchase-order-detail';
import { ExpectedField, FreightField, PaymentTermsField } from './purchase-order-fields-terms';
import { SettledField } from './purchase-order-settled-field';

/** Picked when creating, fixed once the order exists (line prices are snapshots). */
function SupplierField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, supplierItems, setHeader } = pane;
  if (!pane.isNew) {
    return (
      <SettledField
        label="Supplier"
        value={pane.supplierName}
        empty="Not recorded"
        description="Fixed when the order was raised, because the costs on it were agreed with them."
      />
    );
  }
  return (
    <Field>
      <FieldLabel required>Supplier</FieldLabel>
      <Combobox
        color="module"
        items={supplierItems}
        value={supplierItems.find((item) => item.value === draft.header.supplierId) ?? null}
        placeholder="Who are you buying from?"
        emptyMessage="No supplier matches that."
        aria-label="Supplier"
        clearable={false}
        onValueChange={(next) => {
          const option = next as { value: string } | null;
          if (option) setHeader('supplierId', option.value);
        }}
      />
      <FieldDescription>Fixed once the order is saved.</FieldDescription>
    </Field>
  );
}

function WhereItLandsField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, activeLocations, setHeader } = pane;
  if (!pane.editable) {
    return (
      <SettledField
        label="Where it lands"
        value={
          activeLocations.find((location) => location.id === draft.header.warehouseId)?.name ?? null
        }
        empty="Not recorded"
        description="The stock arrives into this location."
      />
    );
  }
  return (
    <Field>
      <FieldLabel required>Where it lands</FieldLabel>
      <NativeSelect
        color="module"
        value={draft.header.warehouseId}
        aria-label="Where it lands"
        onChange={(event) => {
          setHeader('warehouseId', event.target.value);
        }}
      >
        <option value="">Choose a location…</option>
        {activeLocations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </NativeSelect>
      <FieldDescription>The stock arrives into this location.</FieldDescription>
    </Field>
  );
}

function ReferenceField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, setHeader } = pane;
  if (!pane.editable) {
    return (
      <SettledField label="Your reference" value={draft.header.reference} empty="None given" />
    );
  }
  return (
    <Field>
      <FieldLabel>Your reference</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.header.reference ?? ''}
            placeholder="A quote number, say"
            onChange={(event) => {
              setHeader('reference', event.target.value === '' ? null : event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

export function OrderDetailsSection({ pane }: { pane: PurchaseOrderPane }) {
  return (
    <FormSection title="Order details">
      <div className="grid gap-3 @md:grid-cols-2">
        <SupplierField pane={pane} />
        <WhereItLandsField pane={pane} />
        <ReferenceField pane={pane} />
        <ExpectedField pane={pane} />
        <PaymentTermsField pane={pane} />
        <FreightField pane={pane} />
      </div>
    </FormSection>
  );
}
