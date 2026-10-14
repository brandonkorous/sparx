'use client';

// The order picker, the invoice's own details and the save row of the
// "enter a supplier's invoice" pane.

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
  FieldStatus,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import { DayInput } from '../../components/day-input';
import { formatCents } from './data';
import type { SupplierBillDraft } from './use-supplier-bill-draft';
import type { SurfaceContext } from '../../lib/surfaces/registry';

export function BillOrderSection({ draft }: { draft: SupplierBillDraft }) {
  return (
    <FormSection
      title="Which order it is for"
      description="The lines come across from the order already filled in, so you only change what they have actually charged differently."
    >
      <Field>
        <FieldLabel>Order to a supplier</FieldLabel>
        <FieldControl
          render={
            <NativeSelect
              color="module"
              value={draft.purchaseOrderId}
              onChange={(event) => {
                draft.setPurchaseOrderId(event.target.value);
              }}
            >
              <option value="">Choose an order…</option>
              {draft.billable.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.number} · {candidate.supplierName ?? 'Unnamed supplier'} ·{' '}
                  {formatCents(candidate.totalCents, candidate.currency)}
                </option>
              ))}
            </NativeSelect>
          }
        />
        <FieldDescription>
          Only orders that have actually been placed can have been invoiced.
        </FieldDescription>
      </Field>
    </FormSection>
  );
}

/** Shown before an order is picked. With no placed order at all it says so and
 *  offers one, rather than "Choose an order" over an empty list (issue 252). */
export function ChooseOrderAlert({
  draft,
  ctx,
}: {
  draft: SupplierBillDraft;
  ctx: SurfaceContext;
}) {
  if (draft.nothingPlaced) {
    return (
      <Alert color="info">
        <AlertContent>
          <AlertTitle>No order to enter an invoice against yet</AlertTitle>
          <AlertDescription>
            A supplier&apos;s invoice is entered against the order you placed with them, so its
            lines and prices come across. Place the order first, then enter the invoice when it
            arrives.
          </AlertDescription>
          <AlertActions>
            <Button
              color="module"
              onClick={() => {
                ctx.open('inventory.purchase-orders.detail', { id: 'new' }, { target: 'tab' });
              }}
            >
              New order
            </Button>
          </AlertActions>
        </AlertContent>
      </Alert>
    );
  }
  return (
    <Alert color="info">
      <AlertContent>
        <AlertTitle>Choose an order to start</AlertTitle>
        <AlertDescription>
          Every line, the agreed price and what actually arrived all come from the order. That is
          what makes the check possible, and it is far quicker than typing the invoice out again.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function InvoiceNumberField({ draft }: { draft: SupplierBillDraft }) {
  return (
    <Field>
      <FieldLabel>Their invoice number</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.number}
            placeholder="INV-88214"
            onChange={(event) => {
              draft.setNumber(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>
        Theirs, not ours. It is how a query to their accounts department is phrased. The same number
        cannot be entered twice for one supplier.
      </FieldDescription>
    </Field>
  );
}

export function BillInvoiceSection({ draft }: { draft: SupplierBillDraft }) {
  return (
    <FormSection title="The invoice" description="As printed on their paperwork.">
      <InvoiceNumberField draft={draft} />
      <Field>
        <FieldLabel>Invoice date</FieldLabel>
        <FieldControl
          render={
            <DayInput
              color="module"
              value={draft.billedAt}
              onValueChange={(value) => {
                draft.setBilledAt(value);
              }}
            />
          }
        />
        {draft.billedError ? <FieldStatus status="error">{draft.billedError}</FieldStatus> : null}
      </Field>
      <Field>
        <FieldLabel>Due</FieldLabel>
        <FieldControl
          render={
            <DayInput
              color="module"
              value={draft.dueAt}
              onValueChange={(value) => {
                draft.setDueAt(value);
              }}
            />
          }
        />
        <FieldDescription>
          Leave it blank if they have not stated one. An invoice with no due date is never reported
          as overdue, which is honest rather than convenient.
        </FieldDescription>
        {draft.dueError ? <FieldStatus status="error">{draft.dueError}</FieldStatus> : null}
      </Field>
    </FormSection>
  );
}

export function BillSaveRow({ draft }: { draft: SupplierBillDraft }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <Button
        color="module"
        disabled={!draft.canSave}
        loading={draft.create.isPending}
        onClick={draft.onSave}
      >
        Enter the invoice
      </Button>
      <Text className="text-sm">
        It is checked against the order and the delivery the moment it is saved.
      </Text>
    </div>
  );
}
