'use client';

// PDP reviews section (client island). Renders the rating summary + the approved
// review list (server-fetched first page, passed as props) and a collapsible
// "write a review" form that POSTs a guest review into the seller's moderation
// queue. Helpful counts are shown read-only (voting needs a shopper session).

import { useState } from 'react';
import { BadgeCheck, PenLine, ThumbsUp } from 'lucide-react';
import {
  Alert,
  Button,
  Field,
  FieldLabel,
  Input,
  Rating,
  Textarea,
} from '@wizeworks/silicaui-react';

import { Stars } from '@/components/stars';
import { submitProductReview, ReviewRequestError } from '@/lib/reviews-client';
import type { ProductReview } from '@/lib/market';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function ReviewCard({ review }: { review: ProductReview }) {
  return (
    <article className="border-base-300 border-t py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} reviewCount={1} size={15} />
        {review.title ? (
          <span className="text-base-content font-semibold">{review.title}</span>
        ) : null}
      </div>
      <div className="text-base-content mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
        <span>{review.author ?? 'Verified buyer'}</span>
        {review.verifiedPurchase ? (
          <span className="text-success inline-flex items-center gap-1">
            <BadgeCheck size={13} aria-hidden />
            Verified purchase
          </span>
        ) : null}
        <span aria-hidden>·</span>
        <span>{formatDate(review.createdAt)}</span>
      </div>
      <p className="text-base-content mt-2 text-sm leading-relaxed whitespace-pre-line">
        {review.body}
      </p>
      {review.response ? (
        <div className="bg-base-200 mt-3 rounded-lg p-3 text-sm">
          <p className="text-base-content font-semibold">Seller response</p>
          <p className="text-base-content mt-1 whitespace-pre-line">{review.response}</p>
        </div>
      ) : null}
      {review.helpfulCount > 0 ? (
        <p className="text-base-content mt-2 inline-flex items-center gap-1.5 text-[0.8125rem]">
          <ThumbsUp size={13} aria-hidden />
          {review.helpfulCount.toLocaleString()} found this helpful
        </p>
      ) : null}
    </article>
  );
}

function WriteReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!authorName.trim() || !body.trim()) {
      setError('Please add your name and a few words about the product.');
      return;
    }
    setBusy(true);
    try {
      await submitProductReview(slug, {
        rating,
        authorName: authorName.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        body: body.trim(),
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof ReviewRequestError ? err.message : 'Could not submit your review just now.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-base-300 flex flex-col gap-4 rounded-xl border p-4"
    >
      <Field>
        <FieldLabel>Your rating</FieldLabel>
        <Rating value={rating} onChange={setRating} size="lg" label="Your rating" />
      </Field>
      <Field>
        <FieldLabel>Your name</FieldLabel>
        <Input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="e.g. Jordan P."
          maxLength={63}
          required
        />
      </Field>
      <Field>
        <FieldLabel>Headline (optional)</FieldLabel>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
          maxLength={127}
        />
      </Field>
      <Field>
        <FieldLabel>Your review</FieldLabel>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you like or dislike? How did it work out for you?"
          rows={4}
          maxLength={5000}
          required
        />
      </Field>
      {error ? (
        <Alert color="danger" variant="soft">
          {error}
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          color="primary"
          variant="solid"
          size="md"
          loading={busy}
          disabled={busy}
        >
          Submit review
        </Button>
        <Button
          type="button"
          color="neutral"
          variant="ghost"
          size="md"
          onClick={onDone}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ProductReviews({
  slug,
  summary,
  reviews,
}: {
  slug: string;
  summary: { averageRating: number; total: number };
  reviews: ProductReview[];
}) {
  const [writing, setWriting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const hasReviews = summary.total > 0;

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-heading" className="text-base-content text-xl font-semibold">
            Customer reviews
          </h2>
          {hasReviews ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base-content text-2xl font-semibold">
                {summary.averageRating.toFixed(1)}
              </span>
              <Stars rating={summary.averageRating} reviewCount={summary.total} />
            </div>
          ) : (
            <p className="text-base-content mt-1 text-sm">
              No reviews yet — be the first to share your experience.
            </p>
          )}
        </div>
        {!writing && !submitted ? (
          <Button
            type="button"
            color="primary"
            variant="soft"
            size="sm"
            iconStart={<PenLine size={15} />}
            onClick={() => setWriting(true)}
          >
            Write a review
          </Button>
        ) : null}
      </div>

      {submitted ? (
        <Alert color="success" variant="soft">
          Thanks for your review! It’ll appear here once the seller approves it.
        </Alert>
      ) : null}

      {writing ? (
        <WriteReviewForm
          slug={slug}
          onDone={() => {
            setWriting(false);
            setSubmitted(true);
          }}
        />
      ) : null}

      {hasReviews ? (
        <div>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {summary.total > reviews.length ? (
            <p className="text-base-content mt-4 text-sm">
              Showing {reviews.length} of {summary.total.toLocaleString()} reviews.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
