'use client';

// The offer itself: what to call it, how a shopper gets it, and what comes off.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Switch,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { MoneyTextInput } from '../../components/money-input';
import { CREATABLE_TYPES, TYPE_LABELS, type Draft } from './discount-draft';
import type { DiscountType } from './discounts-data';

export interface OfferFieldsProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  touched: boolean;
  nameError: string | null;
  codeError: string | null;
  percentError: string | null;
  amountError: string | null;
  canCreateType: boolean;
}

export function DiscountOfferFields({
  draft,
  set,
  touched,
  nameError,
  codeError,
  percentError,
  amountError,
  canCreateType,
}: OfferFieldsProps) {
  return (
    <>
      <FormSection title="Name">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <FieldControl
            render={
              <Input
                color={nameError && touched ? 'error' : 'module'}
                value={draft.name}
                placeholder="Summer sale"
                onChange={(event) => {
                  set('name', event.target.value);
                }}
              />
            }
          />
          {nameError && touched ? (
            <FieldStatus status="error">{nameError}</FieldStatus>
          ) : (
            <FieldDescription>For you — how you tell one discount from another.</FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>Note (optional)</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={2}
                value={draft.description}
                placeholder="Anything worth remembering about this offer."
                onChange={(event) => {
                  set('description', event.target.value);
                }}
              />
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="How shoppers get it"
        description="A code they type, or automatically on any qualifying order."
      >
        <Field>
          <FieldLabel>Shoppers type a code</FieldLabel>
          <FieldControl
            render={
              <Switch
                color="module"
                checked={draft.hasCode}
                onCheckedChange={(next: boolean) => {
                  set('hasCode', next);
                }}
              />
            }
          />
          <FieldDescription>
            {draft.hasCode
              ? 'Only orders that enter this code get the discount.'
              : 'The discount applies on its own — no code needed.'}
          </FieldDescription>
        </Field>

        {draft.hasCode ? (
          <Field>
            <FieldLabel>Code</FieldLabel>
            <FieldControl
              render={
                <Input
                  color={codeError && touched ? 'error' : 'module'}
                  value={draft.code}
                  placeholder="SUMMER10"
                  spellCheck={false}
                  autoComplete="off"
                  className="font-mono uppercase"
                  onChange={(event) => {
                    set('code', event.target.value.toUpperCase());
                  }}
                />
              }
            />
            {codeError && touched ? (
              <FieldStatus status="error">{codeError}</FieldStatus>
            ) : (
              <FieldDescription>
                What shoppers type at checkout. Letters and numbers work best.
              </FieldDescription>
            )}
          </Field>
        ) : null}
      </FormSection>

      <FormSection title="What it takes off">
        <Field>
          <FieldLabel>Kind of saving</FieldLabel>
          <Select
            color="module"
            aria-label="Kind of saving"
            value={draft.type}
            disabled={!canCreateType}
            items={Object.fromEntries(
              (canCreateType ? CREATABLE_TYPES : [draft.type]).map((type) => [
                type,
                TYPE_LABELS[type],
              ])
            )}
            onValueChange={(next) => {
              set('type', next as DiscountType);
            }}
          />
        </Field>

        {draft.type === 'percent' ? (
          <Field>
            <FieldLabel>Percentage off</FieldLabel>
            <FieldControl
              render={
                <div className="flex max-w-[10rem] items-center gap-2">
                  <Input
                    color={percentError && touched ? 'error' : 'module'}
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={draft.percentValue}
                    placeholder="10"
                    onChange={(event) => {
                      set('percentValue', event.target.value);
                    }}
                  />
                  <Text as="span" className="text-lg">
                    %
                  </Text>
                </div>
              }
            />
            {percentError && touched ? (
              <FieldStatus status="error">{percentError}</FieldStatus>
            ) : null}
          </Field>
        ) : draft.type === 'fixed' ? (
          <Field>
            <FieldLabel>Amount off</FieldLabel>
            <FieldControl
              render={
                <div className="flex max-w-[12rem] items-center gap-2">
                  <Text as="span" className="text-lg">
                    $
                  </Text>
                  <MoneyTextInput
                    color={amountError && touched ? 'error' : 'module'}
                    text={draft.amountDollars}
                    onTextChange={(text) => {
                      set('amountDollars', text);
                    }}
                  />
                </div>
              }
            />
            {amountError && touched ? (
              <FieldStatus status="error">{amountError}</FieldStatus>
            ) : null}
          </Field>
        ) : draft.type === 'free_shipping' ? (
          <Text className="text-sm">
            Qualifying orders pay nothing for delivery. Use the conditions below to require a
            minimum spend if you like.
          </Text>
        ) : null}
      </FormSection>
    </>
  );
}
