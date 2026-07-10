'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Trash2, X } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import { deleteReviewAction, moderateReviewAction } from '../../../review-actions';

type Status = 'pending' | 'approved' | 'rejected' | 'flagged';

// Lifecycle/moderation controls for a review, teleported into the detail
// frame's header (drawer/modal chrome or the full-page shell) via the shared
// header slot — parity with TemplateStatusBar. Errors surface as a toast: the
// header bar has no room for inline error text.
export function ModerateActions({ reviewId, status }: { reviewId: string; status: Status }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
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
          toast.error(result.error.message);
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
        toast.error(result.error.message);
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
          toast.error(result.error.message);
          return;
        }
        router.push('/commerce/reviews');
        router.refresh();
      });
    })();
  }

  return (
    <div className="flex flex-row items-center gap-2">
      {status !== 'flagged' && (
        <Tooltip content="Flag">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Flag"
            disabled={pending}
            onClick={() => moderate('flagged')}
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {status !== 'rejected' && (
        <Tooltip content="Reject">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reject"
            disabled={pending}
            onClick={() => setRejectOpen(true)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      <Tooltip content="Delete">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Delete review"
          disabled={pending}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {status !== 'approved' && (
        <Button
          variant="solid"
          color="module"
          size="sm"
          disabled={pending}
          onClick={() => moderate('approved')}
        >
          Approve
        </Button>
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
              <label className="text-sm" htmlFor="reject-review-note">
                Moderation note (internal)
              </label>
              <Textarea
                id="reject-review-note"
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
