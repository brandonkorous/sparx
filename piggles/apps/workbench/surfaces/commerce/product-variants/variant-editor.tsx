'use client';

// The money and the codes — what someone opens a version to change.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
} from '@wizeworks/silicaui-react';

import { MoneyInput } from '../../../components/money-input';
import { OptionalMoney } from './fields';
import type { VariantDraft } from './draft';
import type { Variant } from '../products-data';

const POLICY_ITEMS = [
  { value: 'deny', label: 'Stop selling it' },
  { value: 'continue', label: 'Keep selling it and owe it' },
  { value: 'preorder', label: 'Take pre-orders for it' },
];

const FULFILMENT_ITEMS = [
  { value: 'same', label: 'The same as the rest of the product' },
  { value: 'physical', label: 'Something you post or deliver' },
  { value: 'digital', label: 'A download' },
  { value: 'service', label: 'Work you do for them' },
];

export interface EditorProps {
  variant: Variant;
  label: string;
  draft: VariantDraft;
  problem: string | null;
  onChange: (change: Partial<VariantDraft>) => void;
}

function Prices({ label, draft, onChange }: Omit<EditorProps, 'problem' | 'variant'>) {
  return (
    <div className="flex flex-col gap-3 @md:flex-row">
      <Field className="min-w-0 flex-1">
        <FieldLabel>Price</FieldLabel>
        <FieldControl
          render={
            <MoneyInput
              color="module"
              value={draft.price}
              aria-label={`Price for ${label}`}
              onValueChange={(next) => {
                onChange({ price: next });
              }}
            />
          }
        />
        <FieldDescription>What a shopper pays for this version.</FieldDescription>
      </Field>

      <OptionalMoney
        label="Was"
        description="Shown crossed out beside the price, so a reduction is visible."
        value={draft.compareAt}
        addLabel="Add a was-price"
        onChange={(next) => {
          onChange({ compareAt: next });
        }}
      />

      <OptionalMoney
        label="What it costs you"
        description="Only you see this. It is what your profit is worked out from."
        value={draft.cost}
        addLabel="Add your cost"
        onChange={(next) => {
          onChange({ cost: next });
        }}
      />
    </div>
  );
}

function Codes({ draft, problem, onChange }: Omit<EditorProps, 'variant' | 'label'>) {
  return (
    <div className="flex flex-col gap-3 @md:flex-row">
      <Field className="min-w-0 flex-1">
        <FieldLabel>Product code</FieldLabel>
        <FieldControl
          render={
            <Input
              color={problem ? 'error' : 'module'}
              size="sm"
              value={draft.sku}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                onChange({ sku: event.target.value });
              }}
            />
          }
        />
        <FieldDescription>
          Your own reference for this version. It has to be different from every other code you use,
          including ones on retired versions.
        </FieldDescription>
      </Field>

      <Field className="min-w-0 flex-1">
        <FieldLabel>Barcode</FieldLabel>
        <FieldControl
          render={
            <Input
              color={problem ? 'error' : 'module'}
              size="sm"
              value={draft.barcode}
              placeholder="Optional"
              spellCheck={false}
              autoComplete="off"
              inputMode="numeric"
              onChange={(event) => {
                onChange({ barcode: event.target.value });
              }}
            />
          }
        />
        <FieldDescription>
          The number under the stripes on the packaging, if it has one.
        </FieldDescription>
      </Field>
    </div>
  );
}

export function VariantEditor({ variant, label, draft, problem, onChange }: EditorProps) {
  return (
    <>
      {variant.markupRuleId ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>This price is worked out for you</AlertTitle>
            <AlertDescription>
              It comes from a pricing rule based on what this costs you. Typing a price here changes
              it now, but the rule will set it again next time your cost moves — change the rule on
              the Pricing tab to make it stick.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Prices label={label} draft={draft} onChange={onChange} />
      <Codes draft={draft} problem={problem} onChange={onChange} />
      {problem ? <FieldStatus status="error">{problem}</FieldStatus> : null}

      <Field>
        <FieldLabel>When you run out of this one</FieldLabel>
        <Select
          color="module"
          size="sm"
          items={POLICY_ITEMS}
          value={draft.inventoryPolicy}
          aria-label={`What happens when ${label} runs out`}
          onValueChange={(next) => {
            onChange({ inventoryPolicy: next as string });
          }}
        />
        <FieldDescription>
          “Keep selling it and owe it” lets shoppers order something you have not got yet, and you
          send it when it arrives.
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel>What kind of thing this version is</FieldLabel>
        <Select
          color="module"
          size="sm"
          items={FULFILMENT_ITEMS}
          value={draft.fulfillmentType ?? 'same'}
          aria-label={`What kind of thing ${label} is`}
          onValueChange={(next) => {
            onChange({ fulfillmentType: next === 'same' ? null : (next as string) });
          }}
        />
        <FieldDescription>
          Leave this alone unless this one version differs — a downloadable size of an otherwise
          posted product, say.
        </FieldDescription>
      </Field>

      <label className="flex items-center gap-2">
        <Checkbox
          color="module"
          checked={draft.requiresShipping}
          aria-label={`${label} has to be delivered`}
          onChange={(event) => {
            onChange({ requiresShipping: event.target.checked });
          }}
        />
        <Text as="span">This has to be posted or delivered</Text>
      </label>
    </>
  );
}
