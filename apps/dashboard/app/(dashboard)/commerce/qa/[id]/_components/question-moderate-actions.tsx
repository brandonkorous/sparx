'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

import { Button } from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import { moderateQuestionAction } from '../../../review-actions';

export function QuestionModerateActions({
  questionId,
  status,
}: {
  questionId: string;
  status: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function decide(next: 'published' | 'rejected') {
    void (async () => {
      const ok = await confirm({
        title: `Mark question ${next}?`,
        description:
          next === 'published'
            ? 'Publishing makes the question visible on the storefront PDP.'
            : 'Rejected questions stay out of the storefront and the customer is not notified.',
        confirmLabel: next === 'published' ? 'Publish' : 'Reject',
        tone: next === 'published' ? 'module' : 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await moderateQuestionAction({ questionId, status: next });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-row gap-2">
        {status !== 'published' && (
          <Button color="module" disabled={pending} onClick={() => decide('published')}>
            <Check className="h-4 w-4" />
            Publish
          </Button>
        )}
        {status !== 'rejected' && (
          <Button variant="ghost" disabled={pending} onClick={() => decide('rejected')}>
            <X className="h-4 w-4" />
            Reject
          </Button>
        )}
      </div>
      {error && (
        <p className="text-danger text-xs" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
