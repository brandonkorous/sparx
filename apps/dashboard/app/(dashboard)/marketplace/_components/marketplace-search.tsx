'use client';

// Marketplace home search. For now the only live category is Blueprints, so a
// submit routes to the blueprints browse with the query pre-applied (docs/60). A
// cross-category search lands when more categories go live.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@wizeworks/silicaui-react';

export function MarketplaceSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(
      trimmed
        ? `/marketplace/blueprints?q=${encodeURIComponent(trimmed)}`
        : '/marketplace/blueprints'
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative max-w-xl">
      <Search className="text-base-content/50 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the marketplace…"
        aria-label="Search the marketplace"
        className="pl-9"
      />
    </form>
  );
}
