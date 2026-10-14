'use client';

// The box for adding one item you buy from this supplier: which item, their
// code for it, what they charge, and whether they are your go-to for it.

import {
  Alert,
  AlertContent,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  Heading,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { MoneyTextInput } from '../../components/money-input';
import { VariantPicker } from '../commerce/variant-picker';
import type { SupplierVariant } from './suppliers-data';
import type { SupplierLinks } from './use-supplier-links';

function LinkItemField({ links, variants }: { links: SupplierLinks; variants: SupplierVariant[] }) {
  const { picked, setPicked } = links;
  return (
    <Field className="@md:col-span-2">
      <FieldLabel>The item</FieldLabel>
      {picked ? (
        <div className="flex flex-wrap items-center gap-2">
          <Text className="font-medium">{picked.productTitle}</Text>
          <Text as="span" className="font-mono text-sm">
            {picked.sku}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPicked(null);
            }}
          >
            Choose a different one
          </Button>
        </div>
      ) : (
        <VariantPicker
          onPick={setPicked}
          excludeIds={variants.map((link) => link.variantId)}
          placeholder="Search your products by name or code…"
        />
      )}
    </Field>
  );
}

function LinkCodeAndCost({ links }: { links: SupplierLinks }) {
  return (
    <>
      <Field>
        <FieldLabel>Their code (optional)</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              size="sm"
              value={links.supplierSku}
              placeholder="What the supplier calls it"
              spellCheck={false}
              onChange={(event) => {
                links.setSupplierSku(event.target.value);
              }}
            />
          }
        />
      </Field>
      <Field>
        <FieldLabel>What they charge (each)</FieldLabel>
        <FieldControl
          render={
            <MoneyTextInput
              color="module"
              size="sm"
              aria-label="What they charge for each one"
              text={links.cost}
              className="text-right"
              onTextChange={links.setCost}
            />
          }
        />
      </Field>
    </>
  );
}

function LinkPreferred({ links }: { links: SupplierLinks }) {
  return (
    <div className="flex items-end">
      <label className="flex items-center gap-2 pb-1">
        <Checkbox
          color="module"
          checked={links.preferred}
          aria-label="My go-to supplier for this item"
          onChange={(event) => {
            links.setPreferred(event.target.checked);
          }}
        />
        <Text as="span" className="text-sm">
          My go-to supplier for this item
        </Text>
      </label>
    </div>
  );
}

export function AddSupplierLink({
  links,
  variants,
}: {
  links: SupplierLinks;
  variants: SupplierVariant[];
}) {
  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded-lg border p-3">
      <Heading level={4} className="text-base font-semibold">
        Add an item you buy here
      </Heading>
      <div className="grid gap-3 @md:grid-cols-2">
        <LinkItemField links={links} variants={variants} />
        <LinkCodeAndCost links={links} />
        <LinkPreferred links={links} />
      </div>

      {links.error ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertDescription>{links.error}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          color="module"
          disabled={links.picked === null}
          loading={links.saving}
          onClick={() => {
            links.addLink();
          }}
        >
          Add item
        </Button>
        <Button size="sm" variant="ghost" onClick={links.resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
