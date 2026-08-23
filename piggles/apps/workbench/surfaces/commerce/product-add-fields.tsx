'use client';

// The four answers a product needs to exist. Held by product-add.tsx, which
// owns the validation and the submit — this file is only the fields.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Switch,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MoneyTextInput } from '../../components/money-input';

export interface NewProductFieldsProps {
  title: string;
  onTitle: (value: string) => void;
  /** Already resolved — the typed handle, or the one derived from the name. */
  handle: string;
  onHandle: (value: string) => void;
  price: string;
  onPrice: (value: string) => void;
  priceError: string | null;
  sku: string;
  onSku: (value: string) => void;
  skuError: string | null;
  onSale: boolean;
  onOnSale: (value: boolean) => void;
}

export function NewProductFields(p: NewProductFieldsProps) {
  return (
    <>
      <FormSection title="What you are selling">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={p.title}
                placeholder="Handmade leather satchel"
                onChange={(event) => {
                  p.onTitle(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>What shoppers see. You can change this later.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Web address</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={p.handle}
                placeholder="handmade-leather-satchel"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  p.onHandle(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            The end of this product&apos;s page address on your website — yoursite.com/products/
            {p.handle || '…'}
          </FieldDescription>
        </Field>
      </FormSection>

      <FormSection
        title="Price"
        description="Every product needs a price and a code before anyone can buy it, so both are set up here. Once it exists you can add sizes, colors and their own prices on the Options and Variants tabs."
      >
        <Field>
          <FieldLabel>Price</FieldLabel>
          <FieldControl
            render={
              <MoneyTextInput
                color={p.priceError ? 'error' : 'module'}
                text={p.price}
                aria-label="Price"
                onTextChange={p.onPrice}
              />
            }
          />
          {p.priceError ? (
            <FieldStatus status="error">{p.priceError}</FieldStatus>
          ) : (
            <FieldDescription>What a shopper pays. You can change it any time.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>Product code</FieldLabel>
          <FieldControl
            render={
              <Input
                color={p.skuError ? 'error' : 'module'}
                value={p.sku}
                placeholder="SATCHEL-1"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  p.onSku(event.target.value);
                }}
              />
            }
          />
          {p.skuError ? (
            <FieldStatus status="error">{p.skuError}</FieldStatus>
          ) : (
            <FieldDescription>
              Your own reference for this product — on labels, on invoices, in your records. It has
              to be different from every other code you use.
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>Put it on sale straight away</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={p.onSale}
                onCheckedChange={(next: boolean) => {
                  p.onOnSale(next);
                }}
              />
            }
          />
          <FieldDescription>
            Leave this off to save it out of sight and finish it first. Either way you can change
            your mind in one click.
          </FieldDescription>
        </Field>
      </FormSection>
    </>
  );
}
