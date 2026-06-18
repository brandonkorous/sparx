'use client';

// Full cart page body. Client component — reads the live cart from context,
// renders editable line items + an order summary with a discount-code field.

import Image from 'next/image';
import Link from 'next/link';

import { SparxButton } from '@sparx/site-ui';

import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { QuantityStepper } from './quantity-stepper';
import { DiscountField } from './discount-field';

export function CartView() {
  const {
    lines,
    totals,
    count,
    currency,
    updateItem,
    removeItem,
    appliedDiscountCodes,
    removeDiscount,
  } = useCart();

  if (lines.length === 0) {
    return (
      <div className="st-empty" style={{ minHeight: '40vh' }}>
        <span className="st-empty__icon" aria-hidden="true">
          🛒
        </span>
        <h2 className="st-h2" style={{ color: 'var(--st-text)' }}>
          Your cart is empty
        </h2>
        <p style={{ margin: 0 }}>Browse the catalog and add something you like.</p>
        <SparxButton asChild color="primary">
          <Link href="/products" style={{ marginTop: '0.5rem' }}>
            Shop all products
          </Link>
        </SparxButton>
      </div>
    );
  }

  return (
    <div className="st-cart-grid">
      <div>
        {lines.map((line) => (
          <div key={line.id} className="st-line">
            <div className="st-line__media">
              {line.imageUrl ? (
                <Image
                  src={line.imageUrl}
                  alt={line.title}
                  fill
                  sizes="88px"
                  style={{ objectFit: 'cover' }}
                />
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {line.productHandle ? (
                <Link
                  href={`/products/${line.productHandle}`}
                  className="st-card__title"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  {line.title}
                </Link>
              ) : (
                <span className="st-card__title">{line.title}</span>
              )}
              {line.variantTitle ? (
                <span className="st-muted" style={{ fontSize: '0.85rem' }}>
                  {line.variantTitle}
                </span>
              ) : null}
              {line.sku ? (
                <span className="st-muted" style={{ fontSize: '0.78rem' }}>
                  SKU: {line.sku}
                </span>
              ) : null}
              <div className="st-line__qty" style={{ marginTop: '0.25rem' }}>
                <QuantityStepper
                  value={line.quantity}
                  onChange={(q) => updateItem(line.id, q)}
                  onRemove={() => removeItem(line.id)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(line.id)}
                className="st-muted"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textAlign: 'left',
                  textDecoration: 'underline',
                  width: 'fit-content',
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 600 }}>
              {formatMoney(line.lineTotalCents, currency)}
              <div className="st-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                {formatMoney(line.unitPriceCents, currency)} ea
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="st-summary" style={{ position: 'sticky', top: '92px' }}>
        <h2 className="st-h3">Order summary</h2>
        <div className="st-summary__row">
          <span>Subtotal ({count} items)</span>
          <span>{formatMoney(totals.subtotalCents, currency)}</span>
        </div>
        {totals.discountTotalCents > 0 ? (
          <div className="st-summary__row" style={{ color: 'var(--color-success-text)' }}>
            <span>Discount</span>
            <span>−{formatMoney(totals.discountTotalCents, currency)}</span>
          </div>
        ) : null}
        {appliedDiscountCodes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {appliedDiscountCodes.map((code) => (
              <span
                key={code}
                className="st-badge"
                style={{ position: 'static', display: 'inline-flex', gap: '0.4rem' }}
              >
                {code}
                <button
                  type="button"
                  aria-label={`Remove ${code}`}
                  onClick={() => removeDiscount(code)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <DiscountField />

        <div className="st-summary__total">
          <span>Estimated total</span>
          <span>{formatMoney(totals.totalCents, currency)}</span>
        </div>
        <p className="st-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          Shipping &amp; taxes calculated at checkout.
        </p>
        <SparxButton asChild color="primary" size="lg" className="w-full">
          <Link href="/checkout">Proceed to checkout</Link>
        </SparxButton>
        <SparxButton asChild color="neutral" variant="ghost" className="w-full">
          <Link href="/products">Continue shopping</Link>
        </SparxButton>
      </aside>
    </div>
  );
}
