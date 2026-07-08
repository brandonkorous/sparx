'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Textarea } from 'silicaui-react';

import { respondToReviewAction } from '../../../review-actions';

export function RespondForm({
  reviewId,
  initial,
  respondedAt,
}: {
  reviewId: string;
  initial: string | null;
  respondedAt: string | null;
}) {
  const router = useRouter();
  const [response, setResponse] = React.useState(initial ?? '');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function onSave() {
    if (!response.trim()) {
      setError('Response cannot be empty.');
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await respondToReviewAction({ reviewId, response: response.trim() });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={5}
        placeholder="Thanks for the feedback — we'll send out a replacement set right away."
      />
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-0">
          {respondedAt && (
            <p className="text-base-content/70 text-xs">
              Last response: {new Date(respondedAt).toLocaleString()}
            </p>
          )}
          {error && (
            <p className="text-danger text-xs" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-success text-xs" role="status" aria-live="polite">
              Saved
            </p>
          )}
        </div>
        <Button color="module" disabled={pending} onClick={onSave}>
          {initial ? 'Update response' : 'Post response'}
        </Button>
      </div>
    </div>
  );
}
