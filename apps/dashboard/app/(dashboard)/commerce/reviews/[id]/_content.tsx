import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Star } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Stack,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

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
    <Stack gap={6}>
      <Stack direction="row" align="end" justify="between" wrap gap={2}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={2}>
            <Stars value={review.rating} />
            <Heading level={1}>{headingFor(review)}</Heading>
          </Stack>
          <Stack direction="row" gap={2} align="center">
            <Badge color={statusTone(review.status)} variant="soft" size="sm">
              {statusLabel(review.status)}
            </Badge>
            {review.verifiedPurchase && (
              <Badge color="success" variant="soft" size="sm">
                Verified purchase
              </Badge>
            )}
            <Text size="sm" variant="muted">
              {review.displayName ?? (review.customerId ? 'Customer' : 'Anonymous')} ·{' '}
              {new Date(review.createdAt).toLocaleString()}
            </Text>
          </Stack>
        </Stack>
        <ModerateActions reviewId={review.id} status={review.status} />
      </Stack>

      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Review body</Heading>
            <CardDescription>
              On the storefront this renders alongside the product gallery + variant picker. The
              merchant response (below) is shown immediately under the review when present.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={3}>
            <Text className="whitespace-pre-wrap">{review.body}</Text>
            {review.mediaAssetIds.length > 0 && (
              <Stack direction="row" gap={2} wrap>
                {review.mediaAssetIds.map((mid) => (
                  <img
                    key={mid}
                    src={mediaUrl(mid, tenant.slug)}
                    alt="Submitted with this review"
                    loading="lazy"
                    className="h-20 w-20 rounded-md border border-[var(--color-border-default)] object-cover"
                  />
                ))}
              </Stack>
            )}
            <Stack direction="row" gap={4}>
              <Text size="xs" variant="muted">
                Helpful: {review.helpfulCount}
              </Text>
              <Text size="xs" variant="muted">
                Unhelpful: {review.unhelpfulCount}
              </Text>
              <Text size="xs" variant="muted">
                Product:{' '}
                {review.productTitle ? (
                  <Link
                    href={`/commerce/products/${review.productId}`}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--module-active)] hover:underline"
                  >
                    {review.productTitle}
                  </Link>
                ) : (
                  'Deleted product'
                )}
              </Text>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="module">
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Merchant response</Heading>
            <CardDescription>
              Public reply attributed to your team. Saving overwrites any previous response.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <RespondForm
            reviewId={review.id}
            initial={review.response}
            respondedAt={review.respondedAt}
          />
        </CardContent>
      </Card>
    </Stack>
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
    <Stack direction="row" gap={0} align="center">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= value
              ? 'h-4 w-4 fill-[var(--module-active)] text-[var(--module-active)]'
              : 'h-4 w-4 text-[var(--color-text-muted)]'
          }
        />
      ))}
    </Stack>
  );
}
