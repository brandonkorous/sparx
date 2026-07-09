'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Flag, Trash2, X } from 'lucide-react';

import { Button, Dialog, DialogContent, DialogTitle, Textarea } from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import { deleteReviewAction, moderateReviewAction } from '../../../review-actions';

type Status = 'pending' | 'approved' | 'rejected' | 'flagged';

export function ModerateActions({ reviewId, status }: { reviewId: string; status: Status }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectNote, setRejectNote] = React.useState('');

  function moderate(next: Status, tone: 'danger' | 'warning' = 'warning') {
    void (async () => {
      const ok = await confirm({
        title: `Mark review as ${next}?`,
        description:
          next === 'approved'
            ? 'Approving publishes the review on the storefront immediately.'
            : next === 'flagged'
              ? 'Flagged reviews stay in the queue and surface in the alerts strip.'
              : '',
        confirmLabel: next.charAt(0).toUpperCase() + next.slice(1),
        tone,
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await moderateReviewAction({ reviewId, status: next });
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  function onRejectSubmit() {
    const note = rejectNote.trim();
    if (!note) return;
    setRejectOpen(false);
    setRejectNote('');
    startTransition(async () => {
      const result = await moderateReviewAction({
        reviewId,
        status: 'rejected',
        moderationNote: note,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onRejectCancel() {
    setRejectOpen(false);
    setRejectNote('');
  }

  function onDelete() {
    void (async () => {
      const ok = await confirm({
        title: 'Delete review?',
        description: 'Soft-deletes the review. It will not appear in any storefront or report.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await deleteReviewAction(reviewId);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.push('/commerce/reviews');
        router.refresh();
      });
    })();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-row gap-2">
        {status !== 'approved' && (
          <Button color="module" disabled={pending} onClick={() => moderate('approved')}>
            <Check className="h-4 w-4" />
            Approve
          </Button>
        )}
        {status !== 'flagged' && (
          <Button variant="outline" disabled={pending} onClick={() => moderate('flagged')}>
            <Flag className="h-4 w-4" />
            Flag
          </Button>
        )}
        {status !== 'rejected' && (
          <Button variant="ghost" disabled={pending} onClick={() => setRejectOpen(true)}>
            <X className="h-4 w-4" />
            Reject
          </Button>
        )}
        <Button variant="ghost" disabled={pending} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
      {error && (
        <p className="text-danger text-xs" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open) onRejectCancel();
        }}
      >
        <DialogContent>
          <div>
            <DialogTitle>Reject review?</DialogTitle>
          </div>
          <div className="flex flex-col gap-3 px-6 pb-2">
            <p className="text-base-content/70 text-sm">
              Rejected reviews are hidden from the storefront and the customer.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Moderation note (internal)</label>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejecting this review…"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={onRejectCancel}>
              Cancel
            </Button>
            <Button
              color="danger"
              disabled={pending || !rejectNote.trim()}
              onClick={onRejectSubmit}
            >
              {pending ? 'Rejecting…' : 'Reject review'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
