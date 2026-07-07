'use client';

// The marketplace header search — a client island with a live suggestion dropdown
// (matching products + shops) over a plain GET form to /products. Works without JS
// (the form submits to /products?q=); with JS it debounces suggestions, supports
// arrow-key navigation, and routes on select. The signature of the whole
// marketplace, so it's prominent and always present.

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Store, Tag } from 'lucide-react';
import { marketCategoryLabel } from '@sparx/commerce-schemas';
import { Input } from 'silicaui-react';

import { fetchSuggestions, type SuggestResult } from '@/lib/suggest-client';

const EMPTY: SuggestResult = { products: [], merchants: [] };

type Option =
  | { kind: 'search'; label: string; href: string }
  | { kind: 'product'; label: string; href: string; category: string }
  | { kind: 'merchant'; label: string; href: string };

function toOptions(query: string, results: SuggestResult): Option[] {
  const options: Option[] = [];
  const q = query.trim();
  if (q) options.push({ kind: 'search', label: q, href: `/products?q=${encodeURIComponent(q)}` });
  for (const p of results.products) {
    options.push({
      kind: 'product',
      label: p.title,
      href: `/products/${p.slug}`,
      category: p.category,
    });
  }
  for (const m of results.merchants) {
    options.push({ kind: 'merchant', label: m.name, href: `/merchants/${m.slug}` });
  }
  return options;
}

export function SearchAutocomplete({ className }: { className?: string }) {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState('');
  const [results, setResults] = useState<SuggestResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options = toOptions(value, results);

  // Debounced suggestion fetch. Aborts the in-flight request when the query moves on.
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchSuggestions(q, controller.signal).then(setResults);
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const selected = active >= 0 ? options[active] : undefined;
    if (selected) {
      go(selected.href);
    } else {
      const q = value.trim();
      if (q) go(`/products?q=${encodeURIComponent(q)}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const showDropdown = open && options.length > 0;

  return (
    <div ref={rootRef} className={className}>
      <form action="/products" role="search" onSubmit={onSubmit} className="relative">
        <div className="relative flex items-center">
          <Search
            size={17}
            aria-hidden
            className="pointer-events-none absolute left-3 z-10 text-[var(--color-text-tertiary)]"
          />
          <Input
            name="q"
            type="search"
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search products, shops, categories…"
            aria-label="Search the marketplace"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            role="combobox"
            className="w-full pl-10"
          />
        </div>

        {showDropdown ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
          >
            {options.map((opt, i) => {
              const isActive = i === active;
              return (
                <button
                  key={`${opt.kind}-${opt.href}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(opt.href)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-[var(--color-bg-subtle)]' : 'hover:bg-[var(--color-bg-subtle)]'
                  }`}
                >
                  <span className="text-[var(--color-text-tertiary)]" aria-hidden>
                    {opt.kind === 'merchant' ? (
                      <Store size={16} />
                    ) : opt.kind === 'product' ? (
                      <Tag size={16} />
                    ) : (
                      <Search size={16} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
                    {opt.kind === 'search' ? (
                      <>
                        Search for <span className="font-semibold">“{opt.label}”</span>
                      </>
                    ) : (
                      opt.label
                    )}
                  </span>
                  {opt.kind === 'product' ? (
                    <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                      {marketCategoryLabel(opt.category)}
                    </span>
                  ) : opt.kind === 'merchant' ? (
                    <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">Shop</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </form>
    </div>
  );
}
