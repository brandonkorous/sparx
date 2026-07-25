'use client';

// Catalog search-and-select for the quote-request form (docs/10 B2B PRD).
// A quote line can reference a real product/variant (the merchant sees the
// exact SKU, not a guess from free text) or stay free-text for anything off
// the catalog — this only handles the product-linked half; the parent page
// still owns the plain "+ Add another item" free-text path.

import { useEffect, useRef, useState } from 'react';
import { useCustomer } from '@/components/customer-provider';
import { searchQuoteProducts, type QuoteProductResult } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Input } from '@wizeworks/silicaui-react';

const DEBOUNCE_MS = 250;

export function QuoteProductPicker({ onPick }: { onPick: (product: QuoteProductResult) => void }) {
  const { tenantSlug } = useCustomer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuoteProductResult[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      void searchQuoteProducts(tenantSlug, query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, tenantSlug]);

  function pick(product: QuoteProductResult) {
    onPick(product);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search the catalog to add a specific product…"
      />
      {open && results.length > 0 && (
        <div
          className="card border-base-300 border"
          style={{
            position: 'absolute',
            zIndex: 10,
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            maxHeight: '16rem',
            overflowY: 'auto',
            padding: '0.25rem',
          }}
        >
          {results.map((r) => (
            <button
              key={r.productId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                gap: '0.75rem',
                padding: '0.5rem 0.6rem',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: '0.375rem',
              }}
            >
              <span>{r.title}</span>
              {r.priceCents != null && (
                <span
                  className="text-base-content"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
                >
                  {formatMoney(r.priceCents, 'USD')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
