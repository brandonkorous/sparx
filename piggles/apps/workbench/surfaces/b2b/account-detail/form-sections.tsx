'use client';

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../../components/form-section';
import { CustomPropertiesPanel } from '../../crm/custom-properties-panel';
import { SaveFailure } from '@/components/save-failure';
import { paymentTermsLabel, type AccountDetail } from '../accounts-data';
import { accountTierWords } from '../tier-choices';
import { type FieldProps } from './draft';
import { type AccountForm } from './form-hooks';
import { HowTheyBuySection } from './how-they-buy';

interface FormSectionsProps {
  isNew: boolean;
  account: AccountDetail | undefined;
  form: AccountForm;
  nameError: string | null;
  discountError: string | null;
}

export function AccountFormSections({
  isNew,
  account,
  form,
  nameError,
  discountError,
}: FormSectionsProps) {
  const { draft, touched, set, failure } = form;
  return (
    <>
      {isNew ? (
        <Text>
          Set up a business you supply on agreed prices and terms. Once it&apos;s saved you can add
          the people who order for them and see their orders, quotes and invoices.
        </Text>
      ) : account ? (
        <Text className="text-sm">
          {accountTierWords(account) ? `${accountTierWords(account)} · ` : ''}
          {paymentTermsLabel(account.paymentTerms)}
        </Text>
      ) : null}

      <SaveFailure title="Could not save this customer" message={failure} />

      {/* 1 — Who they are */}
      <WhoTheyAreSection draft={draft} set={set} nameError={nameError} touched={touched} />

      {/* 2 — How they buy */}
      <HowTheyBuySection
        account={account}
        draft={draft}
        set={set}
        discountError={discountError}
        touched={touched}
      />

      {/* The extra details this business tracks on a company (docs/144 §3).
              The SAME bag the CRM's company pane edits — one record, one set of
              fields, whichever door you came in through. */}
      <CustomPropertiesPanel
        objectKey="company"
        values={draft.customProperties}
        onChange={(next) => {
          set('customProperties', next);
        }}
      />
    </>
  );
}

function WhoTheyAreSection({
  draft,
  set,
  nameError,
  touched,
}: FieldProps & { nameError: string | null; touched: boolean }) {
  return (
    <FormSection title="Who they are">
      <CompanyNameField draft={draft} set={set} nameError={nameError} touched={touched} />

      <TaxAndWebsiteFields draft={draft} set={set} />
    </FormSection>
  );
}

function CompanyNameField({
  draft,
  set,
  nameError,
  touched,
}: FieldProps & { nameError: string | null; touched: boolean }) {
  return (
    <Field>
      <FieldLabel>Company name</FieldLabel>
      <FieldControl
        render={
          <Input
            color={nameError && touched ? 'error' : 'module'}
            value={draft.companyName}
            placeholder="The shop or business you are selling to"
            onChange={(event) => {
              set('companyName', event.target.value);
            }}
          />
        }
      />
      {nameError && touched ? (
        <FieldStatus status="error">{nameError}</FieldStatus>
      ) : (
        <FieldDescription>The business you&apos;re selling to.</FieldDescription>
      )}
    </Field>
  );
}

function TaxAndWebsiteFields({ draft, set }: FieldProps) {
  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      <Field>
        <FieldLabel>Tax number</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.taxId}
              placeholder="Optional"
              onChange={(event) => {
                set('taxId', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>
          Their VAT or business tax number, if you need it on their paperwork.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Website</FieldLabel>
        <FieldControl
          render={
            <Input
              color="module"
              value={draft.website}
              placeholder="acme.com"
              onChange={(event) => {
                set('website', event.target.value);
              }}
            />
          }
        />
        <FieldDescription>Optional.</FieldDescription>
      </Field>
    </div>
  );
}
