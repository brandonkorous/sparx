'use client';

// Catalog search-and-select for the quote-request form (docs/10 PRD).
// A quote line can reference a real product/variant (the merchant sees the
// exact SKU, not a guess from free text) or stay free-text for anything off
// the catalog. This only handles the product-linked half; the quote request
// builder (quote-request-builder.tsx) owns the typed-in path.

import { useEffect, useRef, useState } from 'react';
import { useCustomer } from '@/components/customer-provider';
import { searchQuoteProducts, type QuoteProductResult } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { Button, Input } from '@wizeworks/silicaui-react';

const DEBOUNCE_MS = 250;

export function QuoteProductPicker({
  onPick,
  currency,
}: {
  onPick: (product: QuoteProductResult) => void;
  /** The shop's currency. Every list price here was printed in dollars, and
   *  until it is known none is printed (sparx persona issue 085). */
  currency: string | null;
}) {
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
    <div className="relative">
      <Input
        id="quote-product-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search the catalog by product name"
      />
      {open && results.length > 0 && (
        <div className="card border-base-300 bg-base-100 absolute inset-x-0 top-[calc(100%+0.25rem)] z-10 max-h-64 overflow-y-auto border p-1">
          {results.map((r) => (
            <Button
              key={r.productId}
              type="button"
              variant="ghost"
              block
              className="h-auto justify-between gap-3 py-2 text-left font-normal"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r)}
            >
              <span>{r.title}</span>
              {r.priceCents != null && currency !== null && (
                <span className="text-sm whitespace-nowrap">
                  List price {formatMoney(r.priceCents, currency)}
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
