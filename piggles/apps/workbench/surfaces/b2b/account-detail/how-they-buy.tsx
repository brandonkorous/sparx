'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { PaymentTermsField } from '../../../components/payment-terms-field';
import { FormSection } from '../../../components/form-section';
import { MoneyInput } from '../../../components/money-input';
import { formatCents, type AccountDetail, type AccountStatus } from '../accounts-data';
import { creditStanding } from '../../../lib/credit-standing';
import { type FieldProps } from './draft';
import { useTierItems } from './form-hooks';

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: 'Open for orders' },
  { value: 'credit_hold', label: 'On credit hold: no new orders until paid' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Closed' },
];

// The note under the Credit limit box: checkout refuses anything over
// `creditLimit - creditUsed`, so a zero turns every order on terms away.
function creditFieldNote(account: AccountDetail | undefined): string {
  if (account) {
    const standing = creditStanding(account.creditLimitCents, account.creditUsedCents);
    if (standing === 'limit') {
      return account.creditRemainingCents > 0
        ? `They have used ${formatCents(account.creditUsedCents)} of this, with ${formatCents(account.creditRemainingCents)} left.`
        : `They have used all of this, and ${formatCents(account.creditUsedCents)} in total.`;
    }
    if (standing === 'owing') {
      return `They still owe you ${formatCents(account.creditUsedCents)}, and cannot order on terms until you put an amount here.`;
    }
    return 'They cannot order on terms. Put an amount here to let them, up to that much at once.';
  }
  return 'The most they can owe you at once on terms. Left at zero, they cannot order on terms at all.';
}

export function HowTheyBuySection({
  account,
  draft,
  set,
  discountError,
  touched,
}: FieldProps & {
  account: AccountDetail | undefined;
  discountError: string | null;
  touched: boolean;
}) {
  const tierItems = useTierItems(account);
  return (
    <FormSection
      title="How they buy"
      description="The prices and terms this business gets. Set once here instead of on every order."
    >
      <TierField draft={draft} set={set} tierItems={tierItems} />

      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
        <CreditLimitField account={account} draft={draft} set={set} />
        <DiscountField draft={draft} set={set} discountError={discountError} touched={touched} />
      </div>

      <WhenTheyPayField draft={draft} set={set} />
      <StandingField draft={draft} set={set} />
      <PrivateNoteField draft={draft} set={set} />
    </FormSection>
  );
}

function TierField({
  draft,
  set,
  tierItems,
}: FieldProps & { tierItems: ReturnType<typeof useTierItems> }) {
  return (
    <Field>
      <FieldLabel>Wholesale group</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <Select
              color="module"
              aria-label="Wholesale group"
              value={draft.tierId}
              items={tierItems}
              onValueChange={(next) => {
                set('tierId', (next as string | null) ?? '');
              }}
            />
          </div>
        }
      />
      <FieldDescription>
        A set of businesses you charge the same way, set up under Wholesale groups. Leave it on
        normal prices to charge them the same as everyone else.
      </FieldDescription>
    </Field>
  );
}

function CreditLimitField({
  account,
  draft,
  set,
}: FieldProps & { account: AccountDetail | undefined }) {
  return (
    <Field>
      <FieldLabel>Credit limit</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-40">
            <MoneyInput
              color="module"
              value={draft.creditLimit}
              aria-label="Credit limit"
              onValueChange={(next) => {
                set('creditLimit', next);
              }}
            />
          </div>
        }
      />
      <FieldDescription>{creditFieldNote(account)}</FieldDescription>
    </Field>
  );
}

function DiscountField({
  draft,
  set,
  discountError,
  touched,
}: FieldProps & { discountError: string | null; touched: boolean }) {
  return (
    <Field>
      <FieldLabel>Extra discount</FieldLabel>
      <FieldControl
        render={
          <div className="flex max-w-40 items-center gap-1">
            <Input
              color={discountError && touched ? 'error' : 'module'}
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              className="text-right tabular-nums"
              aria-label="Extra discount percentage"
              value={String(draft.discountPercent)}
              onChange={(event) => {
                set('discountPercent', Number(event.target.value) || 0);
              }}
            />
            <Text as="span" className="text-sm">
              % off
            </Text>
          </div>
        }
      />
      {discountError && touched ? (
        <FieldStatus status="error">{discountError}</FieldStatus>
      ) : (
        <FieldDescription>
          Taken off everything, on top of their group&apos;s discount. Leave at zero for none.
        </FieldDescription>
      )}
    </Field>
  );
}

function WhenTheyPayField({ draft, set }: FieldProps) {
  return (
    <Field>
      <FieldLabel>When they pay</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <PaymentTermsField
              value={draft.paymentTerms}
              onChange={(next) => {
                set('paymentTerms', next);
              }}
            />
          </div>
        }
      />
      <FieldDescription>
        How long they have to pay after you invoice them. Leave unset to take payment up front.
      </FieldDescription>
    </Field>
  );
}

function StandingField({ draft, set }: FieldProps) {
  return (
    <Field>
      <FieldLabel>Standing</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-sm">
            <Select
              color="module"
              aria-label="Account standing"
              value={draft.status}
              items={STATUS_OPTIONS}
              onValueChange={(next) => {
                set('status', (next as AccountStatus | null) ?? 'active');
              }}
            />
          </div>
        }
      />
      <FieldDescription>
        Put them on credit hold to stop new orders until they&apos;ve paid what they owe.
      </FieldDescription>
    </Field>
  );
}

function PrivateNoteField({ draft, set }: FieldProps) {
  return (
    <Field>
      <FieldLabel>Private note</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={draft.notes}
            placeholder="Anything your team should know about this customer. Only you see this."
            onChange={(event) => {
              set('notes', event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}
