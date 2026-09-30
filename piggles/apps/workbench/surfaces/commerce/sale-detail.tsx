'use client';

// TAKE A SALE — money over the counter, with nothing bought online.
//
// Who it was for, what they had, what they handed over. It writes a real order
// so the sale lands in Orders, in Payments, in what she is owed and in her
// takings, exactly like one placed on the website.

import { shownInPlace } from '@wizeworks/query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import { faCashRegister } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { afterPaneChange } from '../../lib/defer';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CustomerPicker, type CustomerSummary } from '../invoicing/customer-picker';
import { orderErrorMessage } from './data';
import { SaleLines, salesTotal } from './sale-lines';
import { SalePayment } from './sale-payment';
import { useActivePropertyId } from '../../lib/api/shell-data';
import {
  useAgreedPrices,
  useSellables,
  useTakeSale,
  type SaleLine,
  type Sellable,
} from './sale-data';
import { depositDue, dueDayLabel } from './sale-made-to-order';
import { takingNote, whatToOffer } from './sale-taking';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function lineFrom(sellable: Sellable | null): SaleLine {
  const id = `l_${crypto.randomUUID().slice(0, 8)}`;
  if (!sellable) {
    return {
      id,
      name: '',
      quantity: 1,
      price: '0.00',
      sku: 'ITEM',
      productId: null,
      variantId: null,
      orderAheadDays: null,
      // Her own words and her own number from the first keystroke. Nothing in
      // the catalog to price, so nothing will ever overwrite it.
      priceTouched: true,
    };
  }
  return {
    id,
    // The version is half the name at a counter: two Marlow Knits on one sale
    // are two identical lines without it (issue 182 gave the picker this ladder
    // and the line dropped it again).
    name: sellable.detail ? `${sellable.name} · ${sellable.detail}` : sellable.name,
    quantity: 1,
    price: (sellable.priceCents / 100).toFixed(2),
    sku: sellable.sku,
    productId: sellable.productId ?? null,
    variantId: sellable.variantId ?? null,
    orderAheadDays: sellable.orderAheadDays ?? null,
    priceTouched: false,
    ...(sellable.deposit ? { deposit: sellable.deposit } : {}),
  };
}

/** The basket as a string, so an effect fires on a real change rather than on
 *  every render's new array. Hand-typed lines are absent: there is nothing to
 *  ask the pricing engine about them. */
function basketKey(
  customerId: string | null,
  propertyId: string | null,
  lines: SaleLine[]
): string {
  const items = lines
    .filter((line) => line.variantId !== null)
    .map((line) => `${line.variantId}:${line.quantity}`)
    .join(',');
  return `${customerId ?? ''}|${propertyId ?? ''}|${items}`;
}

export function SaleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const take = useTakeSale();
  const sellables = useSellables();
  const propertyId = useActivePropertyId();

  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const { mutate: askWhatTheyPay } = useAgreedPrices();
  // The last basket the pricing engine was asked about. An answer that arrives
  // for a basket she has since changed is thrown away rather than applied —
  // at a counter the slow answer is always the stale one.
  const asked = useRef<string>('');
  const [paid, setPaid] = useState('');
  const [paidWith, setPaidWith] = useState('manual');
  const [paidNote, setPaidNote] = useState('');
  // Whether she has touched the amount. Until she does it tracks the total, so
  // adding a second thing to the sale does not leave the till short.
  const [amountTouched, setAmountTouched] = useState(false);

  const currency = 'USD';
  const total = useMemo(() => salesTotal(lines), [lines]);
  const dueDay = useMemo(() => dueDayLabel(lines), [lines]);
  // Filed under a business they buy for, which is the same fact the picker
  // marks. A shop that phoned this through has handed over nothing.
  const buysOnAccount = customer?.companyId != null;
  // What the till offers to take. A deposit product asks for its deposit, not
  // the whole price — typing over a pre-filled total is how the wrong number
  // gets taken at a counter (issue 026) — and an order going out on account
  // offers nothing at all (issue 748).
  const asking = useMemo(
    () => whatToOffer({ depositAsked: depositDue(lines), total, buysOnAccount }),
    [lines, total, buysOnAccount]
  );

  useEffect(() => {
    if (!amountTouched) setPaid(asking);
  }, [asking, amountTouched]);

  // WHAT THIS CUSTOMER PAYS (issue 737).
  //
  // The till used to fill every line with the catalog's list price and post it
  // through, so a shop with a signed agreement was quoted full retail at the
  // counter it sells from — while its own website charged the agreed figure.
  //
  // Asked again whenever the customer, the site or a quantity changes, because
  // all three change the answer: an agreement belongs to one business, a price
  // list to one site, and a bulk break to a number of units. A price she has
  // typed is never overwritten; the line says what the agreed one was instead.
  useEffect(() => {
    const key = basketKey(customer?.id ?? null, propertyId, lines);
    if (key === asked.current) return;
    asked.current = key;

    // flatMap rather than filter-then-map: the narrowing survives, so nothing
    // here has to assert that a line the filter already kept has a version.
    const basket = lines.flatMap((line) =>
      line.variantId === null ? [] : [{ variantId: line.variantId, quantity: line.quantity }]
    );

    if (!customer || basket.length === 0) {
      // Nobody named, so the catalog price is the whole of what is known — and
      // an untouched line goes BACK to it. Leaving the last customer's figure on
      // screen after they were taken off is how a wholesale price gets taken
      // over the counter from somebody who was never entitled to it.
      setLines((current) =>
        current.some((line) => line.agreed)
          ? current.map((line) => {
              const { agreed, ...rest } = line;
              if (!agreed || line.priceTouched) return rest;
              return { ...rest, price: (agreed.listPriceCents / 100).toFixed(2) };
            })
          : current
      );
      return;
    }

    askWhatTheyPay(
      { customerId: customer.id, propertyId, lines: basket },
      {
        onSuccess: (byVariant) => {
          // She has moved on; this answer is about a basket that no longer
          // exists. Applying it would put a price on the wrong line.
          if (basketKey(customer.id, propertyId, lines) !== key) return;
          setLines((current) =>
            current.map((line) => {
              const found = line.variantId ? byVariant.get(line.variantId) : undefined;
              if (!found) return line;
              return {
                ...line,
                agreed: found,
                ...(line.priceTouched ? {} : { price: (found.unitPriceCents / 100).toFixed(2) }),
              };
            })
          );
        },
        // Silent. A counter that cannot reach the pricing engine still has the
        // catalog price in the box and a person who can type over it; a toast
        // here would stop a sale over something she can already see and fix.
        onError: () => undefined,
      }
    );
  }, [customer, propertyId, lines, askWhatTheyPay]);

  const started = customer !== null || lines.length > 0;
  useDirtySource(
    started && !take.isSuccess,
    'This sale has not been written down yet. Close anyway?'
  );

  const priced = lines.every((line) => Number.isFinite(Number(line.price)));
  const named = lines.every((line) => line.name.trim() !== '');
  const canSave =
    customer !== null && lines.length > 0 && priced && named && !take.isPending && !take.isSuccess;

  const addLine = (sellable: Sellable | null) => {
    setLines((current) => [...current, lineFrom(sellable)]);
  };

  const submit = () => {
    if (!canSave || !customer) return;
    take.mutate(
      {
        customerId: customer.id,
        currency,
        lines,
        paid: Number(paid) || 0,
        paidWith,
        paidNote,
        propertyId,
      },
      {
        onSuccess: (order) => {
          ctx.open('commerce.order.detail', { id: order.id }, { target: 'replace' });
          afterPaneChange(() => {
            toast.add({ title: 'Sale written down', type: 'success' });
          });
        },
        onError: shownInPlace,
      }
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Sale actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            disabled={!canSave}
            loading={take.isPending}
            onClick={submit}
          >
            <Icon glyph={faCashRegister} className="size-4" aria-hidden />
            Write it down
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {take.isError ? (
            <Alert color="error">
              <AlertContent>
                <AlertTitle>The sale was not written down</AlertTitle>
                <AlertDescription>
                  {orderErrorMessage(take.error, 'Nothing was recorded. Try again in a moment.')}
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <FormSection
            title="Who it was for"
            description="The sale goes onto their record, so what they have spent with you stays true. Everyone who buys from you needs a record, and somebody buying for the first time can be added from here."
          >
            <CustomerPicker
              value={customer?.id ?? null}
              onSelect={setCustomer}
              onClear={() => {
                setCustomer(null);
              }}
              // A first-time buyer at a counter is the commonest thing there is,
              // and the sentence that used to sit above this field sent her off
              // to find another screen and type the name a second time (issue
              // 745). The form opens with it already in.
              onAddNew={(typed) => {
                ctx.open('crm.customer.detail', { id: 'new', name: typed }, { target: 'beside' });
              }}
            />
          </FormSection>

          <SaleLines
            lines={lines}
            currency={currency}
            sellables={sellables.items}
            onAdd={addLine}
            onChange={(id, next) => {
              setLines((current) => current.map((line) => (line.id === id ? next : line)));
            }}
            onRemove={(id) => {
              setLines((current) => current.filter((line) => line.id !== id));
            }}
          />

          {/* Between the lines and the money, because it changes both: this
              sale is not handed over today, and a deposit is a part payment
              rather than a shortfall (issue 026). */}
          {dueDay ? (
            <Alert color="module" variant="soft">
              <AlertContent>
                <AlertTitle>Due {dueDay}</AlertTitle>
                <AlertDescription>
                  Something on this sale has to be made first, so it stays on your list until you
                  hand it over. Take a deposit now and the rest when they collect.
                </AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          <SalePayment
            total={total}
            currency={currency}
            note={takingNote(buysOnAccount)}
            paid={paid}
            setPaid={(value) => {
              setAmountTouched(true);
              setPaid(value);
            }}
            paidWith={paidWith}
            setPaidWith={setPaidWith}
            paidNote={paidNote}
            setPaidNote={setPaidNote}
          />
        </div>
      </div>
    </div>
  );
}

export default SaleDetailSurface;
