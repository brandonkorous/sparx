'use client';

// Slide-in mini-cart. Mounted once in the root layout (inside CartProvider);
// opens when an item is added or the header cart button is clicked.

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

import { formatMoney } from '@/lib/format';
import { useCart } from './cart-provider';
import { QuantityStepper } from './quantity-stepper';

export function MiniCart() {
  const { drawerOpen, closeDrawer, lines, totals, count, currency, updateItem, removeItem } =
    useCart();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div className="st-drawer-backdrop" role="presentation">
      <button
        type="button"
        aria-label="Close cart"
        className="st-drawer-backdrop__close"
        onClick={closeDrawer}
      />
      <aside
        className="st-drawer-panel st-drawer-panel--right"
        aria-label="Shopping cart"
        role="dialog"
        aria-modal="true"
      >
        <div className="st-drawer-panel__head">
          <span className="st-h3">Your cart ({count})</span>
          <button
            type="button"
            className="st-iconbtn"
            aria-label="Close cart"
            onClick={closeDrawer}
          >
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="st-empty" style={{ flex: 1 }}>
            <span className="st-empty__icon" aria-hidden="true">
              🛒
            </span>
            <p style={{ margin: 0 }}>Your cart is empty.</p>
            <button type="button" className="st-btn st-btn--primary" onClick={closeDrawer}>
              Keep shopping
            </button>
          </div>
        ) : (
          <>
            <div className="st-drawer-panel__body">
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {line.productHandle ? (
                      <Link
                        href={`/products/${line.productHandle}`}
                        onClick={closeDrawer}
                        className="st-card__title"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {line.title}
                      </Link>
                    ) : (
                      <span className="st-card__title">{line.title}</span>
                    )}
                    {line.variantTitle ? (
                      <span className="st-muted" style={{ fontSize: '0.82rem' }}>
                        {line.variantTitle}
                      </span>
                    ) : null}
                    <div className="st-line__qty">
                      <QuantityStepper
                        value={line.quantity}
                        onChange={(q) => updateItem(line.id, q)}
                        onRemove={() => removeItem(line.id)}
                        small
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(line.lineTotalCents, currency)}
                  </div>
                </div>
              ))}
            </div>

            <div className="st-drawer-panel__foot">
              <div className="st-summary__total">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotalCents, currency)}</span>
              </div>
              <p className="st-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                Shipping &amp; taxes calculated at checkout.
              </p>
              <Link
                href="/checkout"
                className="st-btn st-btn--primary st-btn--block st-btn--lg"
                onClick={closeDrawer}
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                className="st-btn st-btn--secondary st-btn--block"
                onClick={closeDrawer}
              >
                View cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
