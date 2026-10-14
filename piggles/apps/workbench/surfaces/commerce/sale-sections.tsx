'use client';

// The parts of Take a sale that are not the lines or the money: the toolbar,
// what went wrong, who it was for, and when it is due (sparx persona issue 230).

import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
} from '@wizeworks/silicaui-react';
import { faCashRegister } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { PaneToolbar } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CustomerPicker, type CustomerSummary } from '../invoicing/customer-picker';
import { workFailureWords } from '../../lib/api-error';
import { orderErrorMessage } from './data';

export function SaleToolbar(props: { canSave: boolean; pending: boolean; onSubmit: () => void }) {
  return (
    <PaneToolbar
      label="Sale actions"
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={!props.canSave}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          <Icon glyph={faCashRegister} className="size-4" aria-hidden />
          Write it down
        </Button>
      }
    />
  );
}

export function NotWrittenDown({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert color="error">
      <AlertContent>
        <AlertTitle>The sale was not written down</AlertTitle>
        <AlertDescription>
          {orderErrorMessage(error, 'Nothing was recorded. Try again in a moment.')}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

/** The sales tax could not be worked out, so nothing is written down (issue 230). */
export function TaxTrouble({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert color="error">
      <AlertContent>
        <AlertTitle>The sales tax could not be worked out</AlertTitle>
        <AlertDescription>
          Nothing is written down until it is, so the sale is never recorded without its tax.{' '}
          {workFailureWords(
            error,
            'This is a problem reaching the server, not a problem with this sale.'
          )}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </AlertActions>
    </Alert>
  );
}

export function WhoItWasFor(props: {
  ctx: SurfaceContext;
  customer: CustomerSummary | null;
  setCustomer: (next: CustomerSummary | null) => void;
}) {
  return (
    <FormSection
      title="Who it was for"
      description="The sale goes onto their record, so what they have spent with you stays true. Everyone who buys from you needs a record, and somebody buying for the first time can be added from here."
    >
      <CustomerPicker
        value={props.customer?.id ?? null}
        onSelect={props.setCustomer}
        onClear={() => {
          props.setCustomer(null);
        }}
        // A first-time buyer at a counter is the commonest thing there is, and
        // the sentence that used to sit above this field sent her off to find
        // another screen and type the name a second time (issue 745).
        onAddNew={(typed) => {
          props.ctx.open('crm.customer.detail', { id: 'new', name: typed }, { target: 'beside' });
        }}
      />
    </FormSection>
  );
}

/** Between the lines and the money, because it changes both: this sale is not
 *  handed over today, and a deposit is a part payment rather than a shortfall
 *  (issue 026). */
export function DueDayNote({ dueDay }: { dueDay: string | null }) {
  if (!dueDay) return null;
  return (
    <Alert color="module" variant="soft">
      <AlertContent>
        <AlertTitle>Due {dueDay}</AlertTitle>
        <AlertDescription>
          Something on this sale has to be made first, so it stays on your list until you hand it
          over. Take a deposit now and the rest when they collect.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
