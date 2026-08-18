'use client';

// Rows and numbers — where most of a working day is actually spent.
//
// A theme that only ever gets judged on a hero looks fine and then falls apart on
// a table of forty orders, so the board shows one.

import {
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Badge,
} from '@wizeworks/silicaui-react';
import { BoardTile } from './tile';

const ORDERS = [
  { id: '1042', name: 'Charlie Chapman', total: '$48.00', state: 'Paid', tone: 'success' as const },
  { id: '1041', name: 'Howard Hudson', total: '$16.50', state: 'Declined', tone: 'error' as const },
  { id: '1040', name: 'Fiona Fisher', total: '$92.20', state: 'Packing', tone: 'warning' as const },
  {
    id: '1039',
    name: 'Amanda Anderson',
    total: '$7.00',
    state: 'Collected',
    tone: 'info' as const,
  },
];

export function DataTile() {
  return (
    <BoardTile title="Rows and numbers" hint="Orders, invoices and stock — where the day is spent.">
      <Stats>
        <Stat>
          <StatTitle>This month</StatTitle>
          <StatValue>$32,400</StatValue>
          <StatDesc>21% up on last month</StatDesc>
        </Stat>
      </Stats>

      {/* Three columns, not four: this tile is one grid cell wide, and a table that
          has to scroll sideways reads as broken rather than as a specimen. */}
      <Table zebra hover size="sm">
        <thead>
          <tr>
            <th>Order</th>
            <th>Total</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {ORDERS.map((order) => (
            <tr key={order.id}>
              <td>
                <span className="block">#{order.id}</span>
                <span className="text-base-content text-sm">{order.name}</span>
              </td>
              <td>{order.total}</td>
              <td>
                <Badge color={order.tone} variant="soft">
                  {order.state}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </BoardTile>
  );
}
