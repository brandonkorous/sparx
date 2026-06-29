'use client';

import * as React from 'react';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useConfirm,
} from '@sparx/ui';
import { FeedbackCompose } from './feedback-compose';
import { FeedbackHistory } from './feedback-history';
import type { FeedbackModalState, FeedbackTab } from './feedback-provider';
import type { FeedbackContextPayload } from '../../_shell/feedback-types';

// The compose + history modal (docs/112 §3/§9). Opened from anywhere via the
// provider. Two tabs: Send (a fresh submission) and Your feedback (history +
// threads). Closing with an unsaved message confirms first — the platform's
// confirm-on-discard convention.
export function FeedbackModal({
  state,
  onClose,
  onTabChange,
  buildContext,
}: {
  state: FeedbackModalState;
  onClose: () => void;
  onTabChange: (tab: FeedbackTab) => void;
  buildContext: () => FeedbackContextPayload;
}) {
  const confirm = useConfirm();
  const composeDirty = React.useRef(false);

  const handleClose = React.useCallback(async () => {
    if (state.tab === 'send' && composeDirty.current) {
      const ok = await confirm({
        title: 'Discard feedback?',
        description: 'Your message hasn’t been sent yet. Discard it?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      });
      if (!ok) return;
    }
    composeDirty.current = false;
    onClose();
  }, [state.tab, confirm, onClose]);

  return (
    <Modal
      open={state.open}
      onOpenChange={(open) => {
        if (!open) void handleClose();
      }}
    >
      <ModalContent size="lg" mobileSheet>
        <ModalHeader>
          <ModalTitle>Feedback</ModalTitle>
          <ModalDescription>
            Send the sparx team a suggestion, a problem, or a question — we read every one.
          </ModalDescription>
        </ModalHeader>

        <Tabs value={state.tab} onValueChange={(v) => onTabChange(v as FeedbackTab)}>
          <TabsList>
            <TabsTrigger value="send">Send</TabsTrigger>
            <TabsTrigger value="history">Your feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-4">
            <FeedbackCompose
              key={`${state.open}-${state.source}-${state.sentiment ?? ''}`}
              source={state.source}
              initialCategory={state.category}
              sentiment={state.sentiment}
              buildContext={buildContext}
              onDirtyChange={(d) => {
                composeDirty.current = d;
              }}
              onSubmitted={() => {
                composeDirty.current = false;
                onTabChange('history');
              }}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <FeedbackHistory
              initialThreadId={state.threadId}
              onCompose={() => onTabChange('send')}
            />
          </TabsContent>
        </Tabs>
      </ModalContent>
    </Modal>
  );
}
