'use client';

// The orders table — the rows and the sortable headings.
//
// Columns disclose with @container, never a viewport query: pane width and
// screen width are unrelated here, and a viewport breakpoint leaves a narrow
// pane on a wide monitor rendering six columns into 300px.

import { Badge } from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { dueDaySignal, type DueTone } from '../../lib/console/days';
import { useBusinessZone } from '../../lib/business-timezone';
import {
  customerName,
  formatDate,
  formatMoney,
  paymentState,
  shippingState,
  type Order,
  type OrderSortKey,
  type SortDirection,
} from './data';

export interface OrdersSort {
  key: OrderSortKey;
  dir: SortDirection;
}

/** The tone classes for a promised day. Bare text, not a control, so this is
 *  deliberate coloring of prose rather than a re-skin. */
const DUE_INK: Record<DueTone, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  module: 'text-module',
};

/**
 * WHEN THIS ONE WAS PROMISED FOR, AND WHETHER THAT DAY HAS GONE.
 *
 * "Due Sat, Aug 29" for an order that has something to be made first, and
 * nothing at all for the rest — which is most of them. Silent once it has been
 * handed over or called off: a due date on a finished job is noise.
 *
 * It used to print that date and STOP, in one fixed color, so an order five
 * days past the day she promised it read exactly like one due next week
 * (issue 896). The lateness now comes from `dueDaySignal`, the same rule the
 * bills list and the deal board already say it with.
 */
function dueLine(
  order: Order,
  now: Date,
  zone: string | null | undefined
): { short: string; full: string; tone: DueTone } | null {
  if (!order.readyOn) return null;
  if (order.status !== 'placed' && order.status !== 'pending_approval') return null;
  const [year, month, day] = order.readyOn.split('-').map(Number);
  if (!year || !month || !day) return null;
  const when = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const signal = dueDaySignal(order.readyOn, now, zone);
  // Far enough out that the day itself is the news: the signal says so by
  // handing back no words, and the date is what she wants to read.
  if (!signal || signal.label === '') {
    return { short: `Due ${when}`, full: `Due ${when}`, tone: 'module' };
  }
  // Late or close, the COUNT leads and the day follows it, because "5 days
  // late" is the fact she acts on and "Fri, Sep 25" is the one she quotes.
  //
  // In a narrow pane only the count survives. This line is `whitespace-nowrap`
  // and so is the widest thing in its column, which makes it the thing that
  // decides how much room is left for the money — and the money was already
  // being pushed off the right edge at 360px before this said anything about
  // lateness. The count is the half she acts on, and the day is one tap away
  // on the order itself.
  return { short: signal.label, full: `${signal.label} · ${when}`, tone: signal.tone };
}

function SortHeader({
  sortKey,
  label,
  className,
  sort,
  onSort,
}: {
  sortKey: OrderSortKey;
  label: string;
  className?: string;
  sort: OrdersSort;
  onSort: (key: OrderSortKey) => void;
}) {
  const on = sort.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          onSort(sortKey);
        }}
      >
        {label}
        {on ? (
          <Icon
            glyph={sort.dir === 'asc' ? faArrowUp : faArrowDown}
            className="size-3"
            aria-hidden
          />
        ) : null}
      </button>
    </th>
  );
}

function OrderRow({
  order,
  now,
  zone,
  onOpen,
}: {
  order: Order;
  now: Date;
  zone: string | null | undefined;
  onOpen: (order: Order, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const paid = paymentState(order);
  const shipped = shippingState(order);
  const due = dueLine(order, now, zone);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(order, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(order, event);
      }}
    >
      <td className="text-sm">
        {/* An order number is one token and must never be broken across lines.
            Auto table layout hands this column whatever is left after the others
            have taken theirs, and in a docked pane that was 83px — enough to
            render "O-000016" as "O-" over "000016". The identifier is what she
            reads a row by, so it claims its width; the wrapper scrolls if the
            table ever genuinely outgrows the pane. */}
        <span className="font-mono whitespace-nowrap">{order.orderNumber}</span>
        {/* Same reasoning as the due day below: on a phone the Customer column
            is gone and an owner scans this list for "Ravi's order", never for
            O-000001. Hidden once that column appears (issue 262).

            The cap is what makes `truncate` mean anything. A name has no natural
            width, so with nothing to truncate AGAINST the span just grew the
            column: "Marguerite Adeyemi" wanted 115px against the 77px the order
            number needs, and a longer name would have taken more still. That is
            the failure IDENTITY_CELL's own note describes, and here it pushed the
            money off the right edge on a phone.

            96px because that is about what "Due Thu, Sep 10" already costs. The
            column has to fit the due line regardless, so a name held to the same
            width can never be the thing that widens it — which is the rule, not a
            number picked to make one screen fit. It relaxes as soon as there is
            room, and disappears entirely once the Customer column appears. */}
        <span className="block max-w-24 truncate text-xs @sm:max-w-48 @lg:hidden">
          {customerName(order.customer)}
        </span>
        {/* Under the number rather than in a column of its own, so it survives
            every width — the day a made-to-order job is due is the thing a
            shop that makes things scans this list for (issue 026). */}
        {/* Nowrap for the same reason. "Due Thu, Sep 10" in an 83px column wraps
            to four lines and the last one is clipped by the row height, so the
            date a late job is late BY was the part that disappeared. */}
        {due ? (
          <span className={`${DUE_INK[due.tone]} block text-xs font-semibold whitespace-nowrap`}>
            {/* One line, two lengths — @sm is where the name above is already
                allowed to grow, so the column widens in one step rather than
                two. Both are rendered and one is hidden, because a container
                query cannot be read from JavaScript at this level. */}
            <span className="@sm:hidden">{due.short}</span>
            <span className="hidden @sm:inline">{due.full}</span>
          </span>
        ) : null}
      </td>
      <td className="hidden max-w-48 truncate @lg:table-cell">{customerName(order.customer)}</td>
      {/* @3xl, not @2xl. Six columns need 719px and @2xl let the sixth in at 672,
          so a docked pane rendered all of them and pushed the TOTAL off the right
          edge — "$67" where "$67.00" belongs. Placed was already the last column
          to appear, so it is the one that waits a step longer. */}
      <td className="hidden text-sm @3xl:table-cell">{formatDate(order.placedAt)}</td>
      <td>
        <Badge color={paid.tone} variant="soft" size="sm">
          {paid.label}
        </Badge>
      </td>
      <td className="hidden @xl:table-cell">
        <Badge color={shipped.tone} variant="soft" size="sm">
          {shipped.label}
        </Badge>
      </td>
      <td className="text-right font-medium tabular-nums">
        {formatMoney(order.total, order.currency)}
      </td>
    </tr>
  );
}

export function OrdersTable({
  rows,
  sort,
  onSort,
  onOpen,
}: {
  rows: Order[];
  sort: OrdersSort;
  onSort: (key: OrderSortKey) => void;
  onOpen: (order: Order, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  // HER CALENDAR, NOT THIS COMPUTER'S. Read once for the whole table: "how late
  // is this" is a question about the shop's own days, and a list counted on the
  // reader's clock disagrees with the order's own pane by one whole day for
  // anybody sitting in a different zone.
  const zone = useBusinessZone();
  const now = new Date();
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Order</th>
          <th className="hidden @lg:table-cell">Customer</th>
          <SortHeader
            sortKey="placedAt"
            label="Placed"
            className="hidden @3xl:table-cell"
            sort={sort}
            onSort={onSort}
          />
          <th>Payment</th>
          <th className="hidden @xl:table-cell">Delivery</th>
          <SortHeader
            sortKey="total"
            label="Total"
            className="text-right"
            sort={sort}
            onSort={onSort}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((order) => (
          <OrderRow key={order.id} order={order} now={now} zone={zone} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
