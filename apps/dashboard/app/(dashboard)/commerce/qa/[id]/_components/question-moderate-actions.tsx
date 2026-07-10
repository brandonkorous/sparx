'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { moderateQuestionAction } from '../../../review-actions';

// Lifecycle/moderation controls for a Q&A question, teleported into the
// detail frame's header (drawer/modal chrome or the full-page shell) via the
// shared header slot — parity with TemplateStatusBar. Errors surface as a
// toast: the header bar has no room for inline error text.
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
          toast.error(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {status !== 'rejected' && (
        <Tooltip content="Reject">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reject"
            disabled={pending}
            onClick={() => decide('rejected')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {status !== 'published' && (
        <Button
          variant="solid"
          color="module"
          size="sm"
          disabled={pending}
          onClick={() => decide('published')}
        >
          Publish
        </Button>
      )}
    </div>
  );
}
