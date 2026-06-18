'use client';

// Saved items. Lists the customer's wishlist with a link to each product and a
// remove action that stays in sync with the shared WishlistProvider (so heart
// buttons elsewhere update too).

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { SparxAlert, SparxButton } from '@sparx/site-ui';

import { useCustomer } from '@/components/customer-provider';
import { useWishlist } from '@/components/wishlist-provider';
import { getWishlist, type WishlistItem } from '@/lib/customer-client';
import { formatMoney } from '@/lib/format';
import { mediaUrl } from '@/lib/media';

export default function WishlistPage() {
  const { tenantSlug } = useCustomer();
  const { toggle, ids } = useWishlist();
  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getWishlist(tenantSlug)
      .then((res) => active && setItems(res))
      .catch(() => active && setError('Could not load your wishlist.'));
    return () => {
      active = false;
    };
  }, [tenantSlug]);

  // Reflect removals made here (or via heart buttons) without a refetch.
  const visible = items?.filter((i) => ids.has(i.variantId)) ?? null;

  async function remove(variantId: string) {
    await toggle(variantId);
  }

  return (
    <div>
      <h1 className="st-h2" style={{ marginBottom: '1.25rem' }}>
        Wishlist
      </h1>

      {error ? (
        <SparxAlert color="danger" role="alert">
          {error}
        </SparxAlert>
      ) : visible === null ? (
        <div className="st-skeleton" style={{ height: 160 }} />
      ) : visible.length === 0 ? (
        <div className="st-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="st-muted" style={{ marginBottom: '1rem' }}>
            You haven’t saved anything yet.
          </p>
          <SparxButton asChild color="primary">
            <Link href="/products">Browse products</Link>
          </SparxButton>
        </div>
      ) : (
        <div
          className="st-grid st-grid--auto"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          {visible.map((it) => {
            const img = mediaUrl(it.imageMediaId, tenantSlug);
            return (
              <div key={it.variantId} className="st-card" style={{ overflow: 'hidden' }}>
                <Link href={`/products/${it.handle}`} style={{ display: 'block' }}>
                  <div className="st-line__media" style={{ aspectRatio: '1', width: '100%' }}>
                    {img ? (
                      <Image
                        src={img}
                        alt={it.title}
                        fill
                        sizes="(max-width: 520px) 50vw, 200px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{it.title}</div>
                    <div className="st-muted" style={{ fontSize: '0.85rem' }}>
                      {formatMoney(it.priceCents)}
                    </div>
                  </div>
                </Link>
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  <SparxButton
                    color="neutral"
                    variant="ghost"
                    onClick={() => void remove(it.variantId)}
                  >
                    Remove
                  </SparxButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
