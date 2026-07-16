// Live Chat inbox — CRM customer context (docs/69 A-5).
// Presentational; data is fetched server-side and passed in.

import { Badge } from '@wizeworks/silicaui-react';

import type { CustomerContextDto } from '../_lib/types';

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function CustomerContextSidebar({
  context,
}: {
  context: CustomerContextDto;
}): React.JSX.Element {
  return (
    <aside className="border-base-300 hidden h-full overflow-y-auto border-l p-4 lg:block">
      <h2 className="text-base-content text-xs font-semibold tracking-wide uppercase">Customer</h2>
      <div className="mt-2">
        <div className="text-base-content text-sm font-medium">
          {context.name ?? 'Anonymous visitor'}
        </div>
        {context.email ? <div className="text-base-content text-xs">{context.email}</div> : null}
        {context.phone ? <div className="text-base-content text-xs">{context.phone}</div> : null}
        {context.company ? (
          <div className="text-base-content text-xs">{context.company}</div>
        ) : null}
        {context.linked && context.type ? (
          <div className="mt-2">
            <Badge color="module" variant="soft" size="sm">
              {context.type}
            </Badge>
          </div>
        ) : null}
      </div>

      {context.linked ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="border-base-300 rounded-lg border p-2">
              <div className="text-base-content text-xs">Lifetime</div>
              <div className="text-sm font-semibold">{money(context.lifetimeValue)}</div>
            </div>
            <div className="border-base-300 rounded-lg border p-2">
              <div className="text-base-content text-xs">Orders</div>
              <div className="text-sm font-semibold">{context.orderCount}</div>
            </div>
          </div>

          {context.recentOrders.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-base-content text-xs font-semibold tracking-wide uppercase">
                Recent orders
              </h3>
              <ul className="mt-2 space-y-1">
                {context.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="text-base-content">{money(o.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-base-content mt-4 text-xs">Not linked to a CRM customer yet.</p>
      )}
    </aside>
  );
}
