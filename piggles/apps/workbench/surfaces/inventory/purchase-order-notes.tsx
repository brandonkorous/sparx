// The order's notes: typed while a draft, read back in full ink once placed.

import { Field, FieldControl, FieldLabel, Textarea } from '@wizeworks/silicaui-react';
import { FormSection } from '../../components/form-section';
import type { PurchaseOrderPane } from './use-purchase-order-detail';

export function NotesSection({ pane }: { pane: PurchaseOrderPane }) {
  const { editable, draft, setHeader } = pane;
  return (
    <FormSection title="Notes">
      {editable ? (
        <Field>
          <FieldLabel>Notes for this order</FieldLabel>
          <FieldControl
            render={
              <Textarea
                color="module"
                rows={3}
                value={draft.header.notes ?? ''}
                placeholder="Delivery instructions, a PO reference on their side…"
                onChange={(event) => {
                  setHeader('notes', event.target.value === '' ? null : event.target.value);
                }}
              />
            }
          />
        </Field>
      ) : (
        // The note is what people come back to READ (issue 494); `whitespace-pre-wrap`
        // keeps the lines they typed, as the textarea did.
        <Field>
          <FieldLabel>Notes for this order</FieldLabel>
          <p className="min-h-10 text-sm whitespace-pre-wrap">
            {draft.header.notes ?? 'Nothing noted.'}
          </p>
        </Field>
      )}
    </FormSection>
  );
}
