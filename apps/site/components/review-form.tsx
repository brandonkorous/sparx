'use client';

// Write-a-review form for the PDP. Submits to the public reviews endpoint via
// the same-origin proxy; reviews enter moderation, so on success we show a
// "thanks, pending" state rather than optimistically inserting the review.

import { useState } from 'react';

import { Alert, Button, Input, Textarea } from '@wizeworks/silicaui-react';

const API_BASE = '/api/sparx';

// Interactive star rating. Native radios (one per star) keep it fully keyboard-
// and screen-reader-accessible — arrow keys move between stars, the group is
// labelled by the legend — while the visible glyphs fill on hover/selection.
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value; // hover preview wins, else the committed value
  return (
    <fieldset className="st-stars-input" onMouseLeave={() => setHover(0)}>
      <legend>Rating</legend>
      <div className="st-stars-input__row">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={shown >= n ? 'st-stars-input__star is-on' : 'st-stars-input__star'}
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="st-sr-only"
            />
            <span aria-hidden="true">★</span>
            <span className="st-sr-only">
              {n} star{n === 1 ? '' : 's'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({ tenantSlug, handle }: { tenantSlug: string; handle: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/v1/public/commerce/products/${encodeURIComponent(handle)}/reviews?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            rating,
            authorName,
            authorEmail: authorEmail || undefined,
            title: title || undefined,
            body,
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as
        | { success: true }
        | { success: false; error: { message: string } }
        | null;
      if (!res.ok || !json || json.success === false) {
        throw new Error(json?.success === false ? json.error.message : 'Could not submit.');
      }
      setState('done');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  if (state === 'done') {
    return <Alert color="success">Thanks for your review! It’ll appear once it’s approved.</Alert>;
  }

  if (!open) {
    return (
      <Button type="button" color="neutral" variant="outline" onClick={() => setOpen(true)}>
        Write a review
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="st-form">
      <StarRating value={rating} onChange={setRating} />
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <label className="st-field" style={{ flex: 1 }}>
          <span>Name</span>
          <Input required value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
        </label>
        <label className="st-field" style={{ flex: 1 }}>
          <span>Email (optional)</span>
          <Input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
          />
        </label>
      </div>
      <label className="st-field">
        <span>Title (optional)</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="st-field">
        <span>Review</span>
        <Textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {error ? (
        <Alert color="danger" role="alert">
          {error}
        </Alert>
      ) : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Button type="button" color="neutral" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" color="primary" disabled={state === 'busy'}>
          {state === 'busy' ? 'Submitting…' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}
