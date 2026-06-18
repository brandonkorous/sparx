'use client';

// Discount-code input. Applies via the cart context; surfaces an inline error
// when the code is rejected.

import { useState } from 'react';

import { SparxButton, SparxInput } from '@sparx/site-ui';

import { useCart } from './cart-provider';

export function DiscountField() {
  const { applyDiscount } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const result = await applyDiscount(code.trim());
    setBusy(false);
    if (result.ok) setCode('');
    else setError(result.error ?? 'That code can’t be applied.');
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <SparxInput
          style={{ flex: 1 }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Discount code"
          aria-label="Discount code"
        />
        <SparxButton
          type="submit"
          color="neutral"
          variant="outline"
          disabled={busy || !code.trim()}
        >
          {busy ? 'Applying…' : 'Apply'}
        </SparxButton>
      </div>
      {error ? (
        <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>{error}</span>
      ) : null}
    </form>
  );
}
