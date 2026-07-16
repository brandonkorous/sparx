import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';
import { statusLabel } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

interface CartItem {
  cartItemId: string;
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

interface CartTotals {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  giftCardAppliedCents: number;
  accountCreditAppliedCents: number;
  totalCents: number;
}

interface CartSnapshot {
  cartId: string;
  customerId: string | null;
  customerName: string | null;
  channel: string;
  currency: string;
  items: CartItem[];
  appliedDiscountCodes: string[];
  appliedGiftCardCodes: string[];
  accountCreditAppliedCents: number;
  totals: CartTotals;
  expiresAt: string;
  abandonedAt: string | null;
}

export async function CartDetailContent({ id }: Props) {
  let cart: CartSnapshot | null;
  try {
    cart = await api.get<CartSnapshot | null>(`/v1/commerce/carts/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  if (!cart) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold">{cart.cartId.slice(0, 8)}</h1>
          <Badge color="neutral" variant="soft" size="sm">
            {statusLabel(cart.channel)}
          </Badge>
          {cart.abandonedAt && (
            <Badge color="warning" variant="soft" size="sm">
              abandoned
            </Badge>
          )}
        </div>
        <p className="text-base-content text-base">
          {cart.customerId ? (
            <>
              Customer{' '}
              <span className="text-sm">{cart.customerName ?? cart.customerId.slice(0, 8)}</span>
            </>
          ) : (
            'Guest cart'
          )}
          {' · '}
          currency {cart.currency}
        </p>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Items</h3>
            <p className="opacity-70">
              Frozen at the moment of last storefront write; reopening recomputes totals.
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Variant</th>
                <th>SKU</th>
                <th>Name</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((it) => (
                <tr key={it.cartItemId}>
                  <td>
                    <p className="font-mono text-xs">{it.variantId.slice(0, 8)}</p>
                  </td>
                  <td>
                    <p className="font-mono text-xs">{it.sku}</p>
                  </td>
                  <td>{it.name}</td>
                  <td>{it.quantity}</td>
                  <td>${(it.unitPriceCents / 100).toFixed(2)}</td>
                  <td>${(it.subtotalCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Totals</h3>
          </div>
          <div className="flex flex-col gap-2">
            <Row label="Subtotal" value={fmt(cart.totals.subtotalCents, cart.currency)} />
            <Row
              label="Discounts"
              value={`-${fmt(cart.totals.discountTotalCents, cart.currency)}`}
            />
            <Row label="Shipping" value={fmt(cart.totals.shippingTotalCents, cart.currency)} />
            <Row label="Tax" value={fmt(cart.totals.taxTotalCents, cart.currency)} />
            <Row
              label="Gift card applied"
              value={`-${fmt(cart.totals.giftCardAppliedCents, cart.currency)}`}
            />
            <Row
              label="Account credit applied"
              value={`-${fmt(cart.totals.accountCreditAppliedCents, cart.currency)}`}
            />
            <Row label="Total" value={fmt(cart.totals.totalCents, cart.currency)} bold />
            {cart.appliedDiscountCodes.length > 0 && (
              <div className="flex flex-row flex-wrap gap-1 pt-1">
                {cart.appliedDiscountCodes.map((code) => (
                  <Badge key={code} color="neutral" variant="soft" size="sm" className="font-mono">
                    {code}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function fmt(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex flex-row gap-4">
      <p className="text-base-content w-40 text-sm">{label}</p>
      <p className={`text-sm ${bold ? 'font-semibold' : ''}`}>{value}</p>
    </div>
  );
}
