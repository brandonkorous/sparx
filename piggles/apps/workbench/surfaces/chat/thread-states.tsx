'use client';

// What a conversation pane shows before it has a conversation to show: none
// asked for, still loading, or not loadable. Moved out of thread.tsx (sparx
// persona issue 234) unchanged.

import { Card, Loading } from '@wizeworks/silicaui-react';

import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';

export function NoConversation() {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        reason="missing"
        title="No conversation to show"
        description="Open a conversation from the inbox to see it here."
      />
    </Card>
  );
}

export function ConversationLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loading size="sm" />
    </div>
  );
}

/** `error` and `noun`, so a conversation that is NOT THERE reads as gone rather
 *  than as a server that cannot be reached. [[feedback_one_outcome_two_causes]] */
export function ConversationLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={`${PANE_SHELL} p-2`}>
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          title="Could not load this conversation"
          error={error}
          noun="conversation"
          description="This is a problem reaching the server. The conversation itself is unaffected."
          onRetry={onRetry}
        />
      </Card>
    </div>
  );
}
