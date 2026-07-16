import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { ModerateActions } from './_components/moderate-actions';
import { RespondForm } from './_components/respond-form';

export const dynamic = 'force-dynamic';

// Customer-attached review photos resolve through the public media redirect
// (/v1/public/media/:id?tenant=slug) — the one resolver that works for both
// stored uploads and hot-linked external keys. Mirrors product-media-panel.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

function mediaUrl(mediaAssetId: string, tenantSlug: string): string {
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(mediaAssetId)}?tenant=${encodeURIComponent(
    tenantSlug
  )}`;
}

interface Props {
  id: string;
}

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

interface ReviewDetail {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  variantId: string | null;
  customerId: string | null;
  orderId: string | null;
  rating: number;
  title: string;
  body: string;
  displayName: string | null;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  unhelpfulCount: number;
  response: string | null;
  respondedAt: string | null;
  mediaAssetIds: string[];
  createdAt: string;
}

export async function ReviewDetailContent({ id }: Props) {
  let review: ReviewDetail;
  try {
    review = await api.get<ReviewDetail>(`/v1/commerce/reviews/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  // Slug for the public media redirect that renders attached photos.
  const tenant = await api.get<{ slug: string }>('/v1/tenant');

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle/moderation controls teleport into the shared detail
          chrome's header (drawer/modal chrome or the full-page shell),
          parity with ConfiguratorTemplate. */}
      <DetailHeaderSlot>
        <ModerateActions reviewId={review.id} status={review.status} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <Stars value={review.rating} />
            <h1 className="text-3xl font-semibold">{headingFor(review)}</h1>
          </div>
          <div className="flex flex-row items-center gap-2">
            <Badge color={statusTone(review.status)} variant="soft" size="sm">
              {statusLabel(review.status)}
            </Badge>
            {review.verifiedPurchase && (
              <Badge color="success" variant="soft" size="sm">
                Verified purchase
              </Badge>
            )}
            <p className="text-base-content text-sm">
              {review.displayName ?? (review.customerId ? 'Customer' : 'Anonymous')} ·{' '}
              {new Date(review.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Review body</h3>
            <p className="opacity-70">
              On the storefront this renders alongside the product gallery + variant picker. The
              merchant response (below) is shown immediately under the review when present.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="whitespace-pre-wrap">{review.body}</p>
            {review.mediaAssetIds.length > 0 && (
              <div className="flex flex-row flex-wrap gap-2">
                {review.mediaAssetIds.map((mid) => (
                  <img
                    key={mid}
                    src={mediaUrl(mid, tenant.slug)}
                    alt="Submitted with this review"
                    loading="lazy"
                    className="border-base-300 h-20 w-20 rounded-md border object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex flex-row gap-4">
              <p className="text-base-content text-xs">Helpful: {review.helpfulCount}</p>
              <p className="text-base-content text-xs">Unhelpful: {review.unhelpfulCount}</p>
              <p className="text-base-content text-xs">
                Product:{' '}
                {review.productTitle ? (
                  <Link
                    href={`/commerce/products/${review.productId}`}
                    className="text-base-content hover:text-module hover:underline"
                  >
                    {review.productTitle}
                  </Link>
                ) : (
                  'Deleted product'
                )}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Merchant response</h3>
            <p className="opacity-70">
              Public reply attributed to your team. Saving overwrites any previous response.
            </p>
          </div>
          <RespondForm
            reviewId={review.id}
            initial={review.response}
            respondedAt={review.respondedAt}
          />
        </CardBody>
      </Card>
    </div>
  );
}

// Titles are optional, so lead the heading with the title when present,
// otherwise a trimmed snippet of the body — never an empty <h1>.
function headingFor(review: ReviewDetail): string {
  const title = review.title.trim();
  if (title) return title;
  const body = review.body.trim();
  if (!body) return 'Untitled review';
  return body.length > 70 ? `${body.slice(0, 70).trimEnd()}…` : body;
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex flex-row items-center gap-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= value
              ? 'text-module h-4 w-4 fill-[var(--color-module)]'
              : 'text-base-content h-4 w-4'
          }
        />
      ))}
    </div>
  );
}
