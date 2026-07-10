'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SkipForward, X } from 'lucide-react';

import { toast, useConfirm } from '@sparx/ui';
import { Button, Tooltip } from '@wizeworks/silicaui-react';

import {
  cancelSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipNextOccurrenceAction,
} from '../../../subscription-actions';

// Lifecycle controls for a subscription, teleported into the detail frame's
// header (drawer/modal chrome or the full-page shell) via the shared header
// slot — parity with TemplateStatusBar. Errors surface as a toast: the header
// bar has no room for inline error text.
export function SubscriptionActionsBar({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function onPause() {
    startTransition(async () => {
      const result = await pauseSubscriptionAction({ subscriptionId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onResume() {
    startTransition(async () => {
      const result = await resumeSubscriptionAction({ subscriptionId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  function onSkip() {
    void (async () => {
      const ok = await confirm({
        title: 'Skip next occurrence?',
        description:
          'The schedule advances by one interval. The customer is not charged for the skipped occurrence.',
        confirmLabel: 'Skip next',
        tone: 'warning',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await skipNextOccurrenceAction({ subscriptionId });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  function onCancel() {
    void (async () => {
      const ok = await confirm({
        title: 'Cancel subscription?',
        description:
          'Default is to honor the current period and stop renewing after. Toggle the option in code to cancel immediately.',
        confirmLabel: 'Cancel at period end',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const result = await cancelSubscriptionAction({
          subscriptionId,
          atPeriodEnd: true,
        });
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
      {(status === 'active' || status === 'trialing') && (
        <Tooltip content="Skip next occurrence">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Skip next occurrence"
            disabled={pending}
            onClick={onSkip}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {status !== 'cancelled' && (
        <Tooltip content="Cancel">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cancel"
            disabled={pending}
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {status === 'active' || status === 'trialing' ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={onPause}>
          Pause
        </Button>
      ) : status === 'paused' ? (
        <Button variant="solid" color="module" size="sm" disabled={pending} onClick={onResume}>
          Resume
        </Button>
      ) : null}
    </div>
  );
}
