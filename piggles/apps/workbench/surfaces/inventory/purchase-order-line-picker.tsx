// Which item a line is for: chosen when adding, shown as identity when editing
// (changing the item is a remove-and-add).

import {
  Alert,
  AlertContent,
  AlertDescription,
  Button,
  Combobox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import type { VariantOption } from './use-purchase-order-line-pick';
import type { LineEditorModel } from './use-purchase-order-line-editor';

export function LineIdentity({ model }: { model: LineEditorModel }) {
  return (
    <div className="border-base-300 flex flex-col gap-0.5 rounded-lg border p-3">
      <Text className="font-medium">{model.variant?.productTitle ?? 'Item'}</Text>
      <Text className="font-mono text-sm">{model.variant?.variantSku ?? 'No code'}</Text>
    </div>
  );
}

function SupplierItemField({ model }: { model: LineEditorModel }) {
  return (
    <Field>
      <FieldLabel>Item you buy from this supplier</FieldLabel>
      <Combobox
        color="module"
        items={model.variantOptions}
        value={model.selectedOption}
        disabled={model.supplierVariants.isLoading}
        placeholder={
          model.variantOptions.length === 0
            ? 'Nothing recorded for this supplier yet'
            : 'Search what you buy here…'
        }
        emptyMessage="No match. Try the product code below instead."
        aria-label="Item"
        clearable={false}
        onValueChange={(next) => {
          model.pickSuggested(next as VariantOption | null);
        }}
      />
      <FieldDescription>
        These are the items recorded against this supplier, with their price ready to fill in.
      </FieldDescription>
    </Field>
  );
}

function CodeLookupField({ model }: { model: LineEditorModel }) {
  return (
    <Field>
      <FieldLabel>Or find any item by its code</FieldLabel>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <FieldControl
            render={
              <Input
                color="module"
                size="sm"
                value={model.skuLookup}
                placeholder="Product code"
                spellCheck={false}
                onChange={(event) => {
                  model.setSkuLookup(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void model.findByCode();
                  }
                }}
              />
            }
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          color="neutral"
          disabled={model.skuLookup.trim() === ''}
          loading={model.lookupPending}
          onClick={() => {
            void model.findByCode();
          }}
        >
          Find
        </Button>
      </div>
    </Field>
  );
}

export function LinePicker({ model }: { model: LineEditorModel }) {
  const { variant, lookupError, selectedOption } = model;
  return (
    <>
      <SupplierItemField model={model} />
      <div className="flex flex-col gap-2">
        <CodeLookupField model={model} />
        {lookupError ? (
          <Alert color="danger" variant="soft">
            <AlertContent>
              <AlertDescription>{lookupError}</AlertDescription>
            </AlertContent>
          </Alert>
        ) : null}
        {variant && !selectedOption ? (
          <Text className="text-sm">
            Selected:{' '}
            <span className="font-medium">{variant.productTitle ?? variant.variantSku}</span>
          </Text>
        ) : null}
      </div>
    </>
  );
}
