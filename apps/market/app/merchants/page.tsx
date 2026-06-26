// Merchant directory. A searchable, paginated grid of the independent sellers on
// sparx.market. Server-rendered (revalidate 60); the search box is the only
// client island.

import type { Metadata } from 'next';
import { Store } from 'lucide-react';

import { MarketPager } from '@/components/market-pager';
import { MerchantCard } from '@/components/merchant-card';
import { MerchantSearch } from '@/components/merchant-search';
import { listMerchants, toMerchantCardData } from '@/lib/market';
import type { RawSearchParams } from '@/lib/plp-params';

export const revalidate = 60;

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: 'Merchants',
  description:
    'Meet the independent sellers on sparx.market — real shops and makers shipping direct from across the sparx network.',
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams?: Promise<RawSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const rawQ = one(sp.q)?.trim();
  const q = rawQ && rawQ.length > 0 ? rawQ : undefined;
  const page = Math.max(1, Number(one(sp.page) ?? '1') || 1);

  const result = await listMerchants({ page, perPage: PER_PAGE, ...(q ? { q } : {}) });
  const totalPages = Math.max(1, Math.ceil(result.total / result.perPage));

  return (
    <div className="mx-container mx-section">
      <header className="mb-8">
        <h1 className="mx-page-title">Merchants</h1>
        <p className="mx-page-lead">
          {q
            ? `Sellers matching “${q}”.`
            : 'Independent shops and makers selling direct on sparx.market.'}
        </p>
        <div className="mt-5">
          <MerchantSearch initialQuery={q ?? ''} />
        </div>
      </header>

      {result.items.length > 0 ? (
        <>
          <div className="mx-grid">
            {result.items.map((merchant) => (
              <MerchantCard key={merchant.slug} merchant={toMerchantCardData(merchant)} />
            ))}
          </div>
          <MarketPager
            basePath="/merchants"
            searchParams={sp}
            page={result.page}
            totalPages={totalPages}
          />
        </>
      ) : (
        <div className="mx-empty">
          <span className="mx-empty__icon" aria-hidden>
            <Store size={40} />
          </span>
          <p className="mx-empty__title">{q ? `No sellers match “${q}”` : 'No sellers yet'}</p>
          <p>
            {q
              ? 'Try a different name, or browse the full directory.'
              : 'Independent sellers are joining the marketplace all the time — check back soon.'}
          </p>
        </div>
      )}
    </div>
  );
}
