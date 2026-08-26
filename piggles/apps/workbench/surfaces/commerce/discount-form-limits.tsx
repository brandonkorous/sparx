'use client';

// The conditions around the offer: who qualifies, when it runs, how often.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import type { Draft } from './discount-draft';

export interface LimitFieldsProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}

export function DiscountLimitFields({ draft, set }: LimitFieldsProps) {
  return (
    <>
      <FormSection title="Who qualifies" description="Leave these empty to let every order use it.">
        <Field>
          <FieldLabel>Minimum spend</FieldLabel>
          <FieldControl
            render={
              <div className="flex max-w-[12rem] items-center gap-2">
                <Text as="span" className="text-lg">
                  $
                </Text>
                <Input
                  color="module"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={draft.minSpendDollars}
                  placeholder="0.00"
                  onChange={(event) => {
                    set('minSpendDollars', event.target.value);
                  }}
                />
              </div>
            }
          />
          <FieldDescription>The basket must total at least this much.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Minimum number of items</FieldLabel>
          <FieldControl
            render={
              <div className="max-w-[8rem]">
                <Input
                  color="module"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft.minItems}
                  placeholder="0"
                  onChange={(event) => {
                    set('minItems', event.target.value);
                  }}
                />
              </div>
            }
          />
        </Field>

        <Field>
          <FieldLabel>First order only</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={draft.firstOrderOnly}
                onCheckedChange={(next: boolean) => {
                  set('firstOrderOnly', next);
                }}
              />
            }
          />
          <FieldDescription>Only a customer&apos;s very first order can use it.</FieldDescription>
        </Field>
      </FormSection>

      <FormSection
        title="When it runs"
        description="Leave a date empty to have no start or no end."
      >
        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>Starts</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="datetime-local"
                  value={draft.startLocal}
                  onChange={(event) => {
                    set('startLocal', event.target.value);
                  }}
                />
              }
            />
          </Field>
          <Field>
            <FieldLabel>Ends</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="datetime-local"
                  value={draft.endLocal}
                  onChange={(event) => {
                    set('endLocal', event.target.value);
                  }}
                />
              }
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="How often it can be used"
        description="Leave the total empty for no overall cap."
      >
        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>Total uses allowed</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={draft.totalUsageLimit}
                  placeholder="No limit"
                  onChange={(event) => {
                    set('totalUsageLimit', event.target.value);
                  }}
                />
              }
            />
          </Field>
          <Field>
            <FieldLabel>Uses per customer</FieldLabel>
            <FieldControl
              render={
                <Input
                  color="module"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={draft.perCustomerLimit}
                  onChange={(event) => {
                    set('perCustomerLimit', event.target.value);
                  }}
                />
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Can combine with other discounts</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={draft.combine}
                onCheckedChange={(next: boolean) => {
                  set('combine', next);
                }}
              />
            }
          />
          <FieldDescription>
            {draft.combine
              ? 'A shopper can use this alongside other offers on the same order.'
              : 'This is used on its own — no other discount stacks with it.'}
          </FieldDescription>
        </Field>
      </FormSection>
    </>
  );
}
