'use client';

// Merchant directory search box (client). Pushes `?q=` into the URL (server
// re-renders the grid). Pure control surface — the grid is server-rendered.

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button, Input } from '@wizeworks/silicaui-react';

export function MerchantSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = q.trim();
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    params.delete('page');
    const s = params.toString();
    router.push(s ? `/merchants?${s}` : '/merchants');
  }

  return (
    <form className="flex max-w-md gap-2" onSubmit={submit} role="search">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search sellers by name"
        aria-label="Search sellers"
      />
      <Button type="submit" color="primary" variant="solid" shape="square" aria-label="Search">
        <Search size={16} aria-hidden />
      </Button>
    </form>
  );
}
