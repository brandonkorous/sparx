import { RefreshCw } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

import { PriceReviewsManager, type PriceReviewRow } from './_components/price-reviews-manager';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Price changes — Commerce' };

// Staged price-recompute review queue (docs/48 §8/§11). When a bound variant's
// cost moves and the markup rule won't apply the change silently — it's set to
// always review, or the new price moved beyond its auto-apply tolerance — the
// markup-recompute-worker parks the proposed change here for a human to approve
// or reject.
export default async function PriceReviewsPage() {
  const reviews = await api.get<PriceReviewRow[]>('/v1/markup-recompute-reviews?status=pending');

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<RefreshCw className="h-5 w-5" />}
          title="Price changes"
          badge={
            reviews.length > 0 ? <Badge color="module">{reviews.length} pending</Badge> : undefined
          }
          description="Cost-driven price changes a markup rule recomputed but didn't apply on its own — because the rule is set to always review, or the new price moved beyond its auto-apply tolerance. Approve to update the price, or reject to keep the current one."
        />
        <p className="text-base-content text-sm">
          A rule set to “Auto-apply within tolerance” reprices small cost moves automatically; only
          changes beyond the band land here. Adjust a rule’s recompute behaviour on its editor.
        </p>
        <PriceReviewsManager initialReviews={reviews} />
      </div>
    </div>
  );
}
