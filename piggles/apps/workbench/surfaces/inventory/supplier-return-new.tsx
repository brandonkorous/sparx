'use client';

// Putting one together. Create and edit are the same surface, so this pane is
// what `{id:'new'}` renders.

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { PANE_SHELL_SCROLL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { RETURN_REASONS } from './supplier-returns-data';
import { NewReturnLines } from './supplier-return-new-lines';
import { useNewSupplierReturn, type NewReturnState } from './use-supplier-return-new';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function NewReturn({ ctx }: { ctx: SurfaceContext }) {
  const form = useNewSupplierReturn(ctx);

  return (
    <div className={PANE_SHELL_SCROLL}>
      <div className={COLUMN}>
        <Heading level={2} className="text-lg">
          Send something back to a supplier
        </Heading>

        <WhoAndWhere form={form} ctx={ctx} />
        <WhyItIsGoingBack form={form} />
        <NewReturnLines form={form} />

        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Button
            color="module"
            disabled={!form.canSave}
            loading={form.create.isPending}
            onClick={form.onSave}
          >
            Put the return together
          </Button>
          <Text className="text-sm">
            Nothing leaves the shelf yet. You send it on the next screen.
          </Text>
        </div>
      </div>
    </div>
  );
}

function WhoAndWhere({ form, ctx }: { form: NewReturnState; ctx: SurfaceContext }) {
  return (
    <FormSection
      title="Who and where"
      description="Which supplier it goes back to, and which of your locations it is leaving."
    >
      <SupplierField form={form} />
      <NoSuppliers form={form} ctx={ctx} />
      <LeavingFromField form={form} />
    </FormSection>
  );
}

function SupplierField({ form }: { form: NewReturnState }) {
  return (
    <Field>
      <FieldLabel>Supplier</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={form.supplierId}
            onChange={(event) => {
              form.setSupplierId(event.target.value);
            }}
          >
            <option value="">Choose a supplier…</option>
            {(form.suppliers.data?.items ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}

/** An empty supplier picker read like one still loading (issue 252). */
function NoSuppliers({ form, ctx }: { form: NewReturnState; ctx: SurfaceContext }) {
  if (!(form.suppliers.isSuccess && (form.suppliers.data?.items ?? []).length === 0)) return null;
  return (
    <Alert color="info">
      <AlertContent>
        <AlertTitle>No suppliers yet</AlertTitle>
        <AlertDescription>
          A return goes back to a supplier, so add the supplier first. It takes a name and a short
          code.
        </AlertDescription>
        <AlertActions>
          <Button
            color="module"
            onClick={() => {
              ctx.open('inventory.suppliers.detail', { id: 'new' }, { target: 'tab' });
            }}
          >
            Add a supplier
          </Button>
        </AlertActions>
      </AlertContent>
    </Alert>
  );
}

function LeavingFromField({ form }: { form: NewReturnState }) {
  return (
    <Field>
      <FieldLabel>Leaving from</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={form.warehouseId}
            onChange={(event) => {
              form.setWarehouseId(event.target.value);
            }}
          >
            {/* A blank option: nothing is chosen until she chooses it. Without one
                the select DRAWS the first location while the form holds nothing,
                and the button stays greyed out with nothing to say why. */}
            <option value="">Choose a location…</option>
            {form.activeLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}

function WhyItIsGoingBack({ form }: { form: NewReturnState }) {
  return (
    <FormSection
      title="Why it is going back"
      description="This is what you will be quoting at them, and it is what their record is scored on."
    >
      <ReasonField form={form} />
      <RmaNumberField form={form} />
      <NotesField form={form} />
    </FormSection>
  );
}

function ReasonField({ form }: { form: NewReturnState }) {
  return (
    <Field>
      <FieldLabel>Reason</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={form.reason}
            onChange={(event) => {
              form.setReason(event.target.value);
            }}
          >
            {RETURN_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}

function RmaNumberField({ form }: { form: NewReturnState }) {
  return (
    <Field>
      <FieldLabel>Their return number</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={form.rmaNumber}
            placeholder="RMA-4471"
            onChange={(event) => {
              form.setRmaNumber(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>
        Most suppliers will not take anything back without one. Leave it blank if they have not
        given you one yet. You can add it later.
      </FieldDescription>
    </Field>
  );
}

function NotesField({ form }: { form: NewReturnState }) {
  return (
    <Field>
      <FieldLabel>Notes</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color="module"
            rows={2}
            value={form.notes}
            onChange={(event) => {
              form.setNotes(event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}
