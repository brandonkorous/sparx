'use client';

// TAKE A SALE: money over the counter, with nothing bought online. Sparx persona
// issue 061.
//
// Who it was for, what they had, what they handed over. It writes a real order,
// so the sale lands in Orders, in Payments, in what is owed and in the takings,
// exactly like one placed on the website. A rebuilt part sold here carries its
// core deposit the same way it would at checkout, so the core shows up under
// Cores owed and the deposit can be paid back when the old part comes in.
//
// Two doors, one errand. From Orders it is a counter sale; from Wholesale orders
// it is an order a business rang through (`params.through === 'wholesale'`), and
// the tab says which in the catalog's title.
//
// A PANE, not a dialog: a sale is minutes of work with a customer and a list of
// parts in it, and a dialog would lose all of it to a reload or a site switch.
// The pane registers itself as unsaved work until the sale is written down.

import { shownInPlace } from '@wizeworks/query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  useToast,
} from '@wizeworks/silicaui-react';
import { Banknote } from 'lucide-react';

import { FormSection } from '../../components/form-section';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { afterPaneChange } from '../../lib/defer';
import { apiErrorMessage, workFailureWords } from '../../lib/api-error';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useActivePropertyId } from '../../lib/api/shell-data';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CustomerPicker, type CustomerSummary } from '../invoicing/customer-picker';
import { orderErrorMessage } from './data';
import { SaleLines } from './sale-lines';
import { SalePayment } from './sale-payment';
import { useAgreedPrices, useTakeSale, type SaleLine, type Sellable } from './sale-data';
import { saleTotals } from './sale-core';
import { taxKey, taxRowLabel, useSaleTax, type SaleTaxQuote } from './sale-tax';
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
      // Their own words and their own number from the first keystroke. Nothing
      // in the catalog to price, so nothing will ever overwrite it.
      priceTouched: true,
    };
  }
  return {
    id,
    // The version is half the name at a counter: two injectors on one sale are
    // two identical lines without it (issue 182).
    name: sellable.detail ? `${sellable.name} · ${sellable.detail}` : sellable.name,
    quantity: 1,
    price: (sellable.priceCents / 100).toFixed(2),
    sku: sellable.sku,
    productId: sellable.productId ?? null,
    variantId: sellable.variantId ?? null,
    priceTouched: false,
    // Paying the deposit is the default, as it is on the website: nobody is
    // left waiting on a part because a choice they never saw was made for them.
    ...(sellable.core ? { core: sellable.core, coreFirst: false } : {}),
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
    .map((line) => `${String(line.variantId)}:${String(line.quantity)}`)
    .join(',');
  return `${customerId ?? ''}|${propertyId ?? ''}|${items}`;
}

export function SaleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const toast = useToast();
  const take = useTakeSale();
  const propertyId = useActivePropertyId();

  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const { mutate: askWhatTheyPay } = useAgreedPrices();
  // The last basket the pricing engine was asked about. An answer that arrives
  // for a basket that has since changed is thrown away rather than applied: at
  // a counter the slow answer is always the stale one.
  const asked = useRef<string>('');
  const [paid, setPaid] = useState('');
  const [paidWith, setPaidWith] = useState('manual');
  const [paidNote, setPaidNote] = useState('');
  // Whether the amount has been typed on. Until it has, it tracks the total, so
  // adding a second thing to the sale does not leave the till short.
  const [amountTouched, setAmountTouched] = useState(false);

  const currency = 'USD';

  // THE SALES TAX (sparx persona issue 230). Asked of the server's tax engine,
  // the one checkout uses, whenever the customer, a line, a quantity or a price
  // changes; an answer is only used for the exact sale it was asked about.
  // Nothing is written down until the tax for this sale is known: a sale written
  // without it is the $0.00 of tax every counter sale used to carry.
  const { mutate: askTax } = useSaleTax();
  const [tax, setTax] = useState<{ key: string; quote: SaleTaxQuote } | null>(null);
  const [taxFailedFor, setTaxFailedFor] = useState<string | null>(null);
  // Why the last ask failed, so the words name the real cause (issue 260).
  const [taxError, setTaxError] = useState<unknown>(null);
  const askedTax = useRef('');
  const [taxAttempt, setTaxAttempt] = useState(0);
  const currentTaxKey = taxKey(customer?.id ?? null, lines);
  const taxQuote = tax?.key === currentTaxKey ? tax.quote : null;
  const taxReady = lines.length === 0 || taxQuote !== null;

  useEffect(() => {
    if (lines.length === 0 || askedTax.current === currentTaxKey) return;
    const key = currentTaxKey;
    // A short wait, so typing a price asks once rather than once a keystroke.
    const timer = setTimeout(() => {
      askedTax.current = key;
      askTax(
        { customerId: customer?.id ?? null, lines },
        {
          onSuccess: (quote) => {
            setTax({ key, quote });
            setTaxFailedFor(null);
          },
          onError: (error) => {
            setTaxError(error);
            setTaxFailedFor(key);
          },
        }
      );
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [currentTaxKey, customer, lines, askTax, taxAttempt]);

  // Core deposits and sales tax are IN the total taken, each on a row of its
  // own, exactly as the website's checkout adds them up.
  const totals = useMemo(() => saleTotals(lines, taxQuote?.totalTaxCents ?? 0), [lines, taxQuote]);
  // Filed under a business they buy for, which is the same fact the picker
  // marks. A business that phoned this through has handed over nothing.
  const buysOnAccount = customer?.companyId != null;
  const asking = useMemo(
    () => whatToOffer({ total: totals.total, buysOnAccount }),
    [totals.total, buysOnAccount]
  );

  useEffect(() => {
    if (!amountTouched) setPaid(asking);
  }, [asking, amountTouched]);

  // WHAT THIS CUSTOMER PAYS.
  //
  // The catalog price is the walk-in's. Asked again whenever the customer, the
  // site or a quantity changes, because all three change the answer: an
  // agreement belongs to one business, a price list to one site, and a bulk
  // break to a number of units. A typed price is never overwritten; the line
  // says what the agreed one was instead. The core deposit is not a price and is
  // never repriced: it is the version's own figure, whoever is buying.
  useEffect(() => {
    const key = basketKey(customer?.id ?? null, propertyId, lines);
    if (key === asked.current) return;
    asked.current = key;

    const basket = lines.flatMap((line) =>
      line.variantId === null ? [] : [{ variantId: line.variantId, quantity: line.quantity }]
    );

    if (!customer || basket.length === 0) {
      // Nobody named, so the catalog price is the whole of what is known, and an
      // untouched line goes BACK to it. Leaving the last customer's figure on
      // screen after they were taken off is how a wholesale price gets taken
      // over the counter from somebody never entitled to it.
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
          // The basket has moved on; applying this would put a price on the
          // wrong line.
          if (asked.current !== key) return;
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
        // would stop a sale over something already visible and fixable.
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
    customer !== null &&
    lines.length > 0 &&
    priced &&
    named &&
    taxReady &&
    !take.isPending &&
    !take.isSuccess;

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
        tax: taxQuote,
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
            <Banknote className="size-4" aria-hidden />
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
              // A first-time buyer at a counter is the commonest thing there is.
              // Beside, not on top: this sale is half written.
              onAddNew={(typed) => {
                ctx.open('crm.customer.detail', { id: 'new', name: typed }, { target: 'beside' });
              }}
            />
          </FormSection>

          {taxFailedFor === currentTaxKey ? (
            <Alert color="error">
              <AlertContent>
                <AlertTitle>The sales tax could not be worked out</AlertTitle>
                <AlertDescription>
                  Nothing is written down until it is, so the sale is never recorded without its
                  tax.{' '}
                  {apiErrorMessage(
                    taxError,
                    workFailureWords(
                      taxError,
                      'This is a problem reaching the server, not a problem with this sale.'
                    )
                  )}
                </AlertDescription>
              </AlertContent>
              <AlertActions>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    askedTax.current = '';
                    setTaxFailedFor(null);
                    setTaxAttempt((n) => n + 1);
                  }}
                >
                  Try again
                </Button>
              </AlertActions>
            </Alert>
          ) : null}

          <SaleLines
            lines={lines}
            currency={currency}
            totals={totals}
            taxLabel={taxRowLabel(taxQuote)}
            taxKnown={taxQuote !== null}
            onAdd={addLine}
            onChange={(id, next) => {
              setLines((current) => current.map((line) => (line.id === id ? next : line)));
            }}
            onRemove={(id) => {
              setLines((current) => current.filter((line) => line.id !== id));
            }}
          />

          <SalePayment
            total={totals.total}
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
