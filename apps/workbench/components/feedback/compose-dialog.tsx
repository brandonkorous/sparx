'use client';

// The send box — the one part of feedback that is a modal.
//
// It earns it on all five tests: nothing is lost (the draft is parked, see
// compose.tsx), there is no durable thing to return to until it has been SENT
// (at which point the thread is a pane), it needs seconds, and — the test that
// actually decides it here — it leaves the workspace untouched. A pane opened
// from the toolbar would either hide the thing being described or split the
// layout for a thirty-second note.
//
// Reading and replying are the opposite: those are places you return to, so
// they are panes (platform.feedback.list / .thread).

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@wizeworks/silicaui-react';
import type { FeedbackContextPayload } from '../../lib/api/feedback';
import { FeedbackCompose } from './compose';
import type { ComposeState } from './provider';
import { productName } from '../../lib/product';

export function FeedbackComposeDialog({
  state,
  onClose,
  buildContext,
}: {
  state: ComposeState;
  onClose: () => void;
  buildContext: () => FeedbackContextPayload;
}) {
  return (
    <Dialog
      open={state.open}
      onOpenChange={(next) => {
        // No discard confirmation: the draft outlives the dialog, so closing is
        // "later", not "throw it away". A confirm here would be asking people to
        // approve a loss that isn't going to happen.
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle>Send feedback</DialogTitle>
        <DialogDescription>
          Goes straight to the people building {productName()} — a problem, an idea, or a question.
          A real person reads every message, and the reply lands in Your feedback.
        </DialogDescription>

        {/* Keyed on the open flag so each session of the dialog re-reads the
            parked draft and re-captures context. Not keyed on anything finer:
            re-mounting mid-edit would throw away what is being typed. */}
        <FeedbackCompose
          key={String(state.open)}
          source={state.source}
          initialCategory={state.category}
          sentiment={state.sentiment}
          prefill={state.prefill}
          buildContext={buildContext}
          onSubmitted={onClose}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
