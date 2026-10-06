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
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { type AccountDetail } from '../accounts-data';
import { TaxExemptionsNotYet, TaxExemptionsSection } from '../../commerce/tax-exemptions-section';
import { AccountFleet } from '../account-fleet';
import { type FieldProps } from './draft';
import { ContactsSection } from './contacts-section';
import { type AccountForm } from './form-hooks';

interface LinkedSectionsProps {
  ctx: SurfaceContext;
  isNew: boolean;
  account: AccountDetail | undefined;
  form: AccountForm;
  fleetError: string | null;
}

export function AccountLinkedSections({
  ctx,
  isNew,
  account,
  form,
  fleetError,
}: LinkedSectionsProps) {
  return (
    <>
      {/* 3 — Who can order */}
      {isNew ? (
        <FormSection title="Who can order">
          <Text className="text-sm">
            Save the account first, then add the people at this business who are allowed to place
            orders.
          </Text>
        </FormSection>
      ) : account ? (
        <ContactsSection ctx={ctx} accountId={account.id} />
      ) : null}

      {/* 4 — Tax exemption: the certificate a reseller or a farm keeps on the
              business, read at checkout for everyone ordering on its behalf. */}
      {isNew ? (
        <TaxExemptionsNotYet noun="customer" />
      ) : account ? (
        <TaxExemptionsSection companyId={account.id} name={account.companyName} />
      ) : null}

      {/* Their fleet: the vehicles this business runs, which decide what their
              buyers see as fitting (sparx persona issue 086). Size saves with the pane. */}
      <AccountFleetSection
        ctx={ctx}
        isNew={isNew}
        account={account}
        form={form}
        fleetError={fleetError}
      />
    </>
  );
}

function AccountFleetSection({ ctx, isNew, account, form, fleetError }: LinkedSectionsProps) {
  const { draft, set, touched } = form;
  return isNew ? (
    <FormSection title="Their fleet">
      <Text className="text-sm">
        Save the customer first, then add the vehicles this business runs.
      </Text>
    </FormSection>
  ) : account ? (
    <AccountFleet
      ctx={ctx}
      accountId={account.id}
      sizeField={
        <FleetSizeField draft={draft} set={set} fleetError={fleetError} touched={touched} />
      }
    />
  ) : null;
}

function FleetSizeField({
  draft,
  set,
  fleetError,
  touched,
}: FieldProps & { fleetError: string | null; touched: boolean }) {
  return (
    <Field>
      <FieldLabel>Fleet size</FieldLabel>
      <FieldControl
        render={
          <div className="max-w-40">
            <Input
              color={fleetError && touched ? 'error' : 'module'}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="text-right tabular-nums"
              aria-label="Fleet size"
              value={draft.fleetSize}
              onChange={(event) => {
                set('fleetSize', event.target.value);
              }}
            />
          </div>
        }
      />
      {fleetError && touched ? (
        <FieldStatus status="error">{fleetError}</FieldStatus>
      ) : (
        <FieldDescription>How many units they run in total.</FieldDescription>
      )}
    </Field>
  );
}
