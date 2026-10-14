'use client';

// TAKE A SALE: money over the counter. It writes a real order, with the sales tax
// checkout would charge (sparx persona issue 230), so it lands everywhere a website
// order does. What the sale holds is `use-counter-sale.ts`; this only lays it out.

import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { SaleLines } from './sale-lines';
import { lineFrom } from './sale-line-from';
import { SalePayment } from './sale-payment';
import { DueDayNote, NotWrittenDown, SaleToolbar, TaxTrouble, WhoItWasFor } from './sale-sections';
import { takingNote } from './sale-taking';
import { taxRowLabel } from './sale-tax';
import { useCounterSale } from './use-counter-sale';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';
const CURRENCY = 'USD';

export function SaleDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const sale = useCounterSale(ctx);
  const { setLines } = sale;
  return (
    <div className={PANE_SHELL}>
      <SaleToolbar canSave={sale.canSave} pending={sale.take.isPending} onSubmit={sale.submit} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <NotWrittenDown error={sale.take.isError ? sale.take.error : null} />
          <WhoItWasFor ctx={ctx} customer={sale.customer} setCustomer={sale.setCustomer} />
          {sale.tax.failed ? <TaxTrouble error={sale.tax.error} onRetry={sale.tax.retry} /> : null}
          <SaleLines
            lines={sale.lines}
            currency={CURRENCY}
            totals={sale.totals}
            taxLabel={taxRowLabel(sale.tax.quote)}
            taxKnown={sale.tax.quote !== null}
            onAdd={(sellable) => {
              setLines((current) => [...current, lineFrom(sellable)]);
            }}
            onChange={(id, next) => {
              setLines((current) => current.map((line) => (line.id === id ? next : line)));
            }}
            onRemove={(id) => {
              setLines((current) => current.filter((line) => line.id !== id));
            }}
          />
          <DueDayNote dueDay={sale.dueDay} />
          <SalePayment
            total={sale.totals.total}
            currency={CURRENCY}
            note={takingNote(sale.buysOnAccount)}
            {...sale.payment}
          />
        </div>
      </div>
    </div>
  );
}

export default SaleDetailSurface;
