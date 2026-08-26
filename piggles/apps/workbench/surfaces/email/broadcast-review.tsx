'use client';

// A broadcast that has gone out, or is waiting to. Read-only: what was sent, who
// got it, and how it did.

import { useEffect } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { FormSection } from '../../components/form-section';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  useAudiences,
  useBroadcastStats,
  useDesignedEmails,
  useEmailSettings,
  type Broadcast,
} from './broadcasts-data';
import { broadcastErrorMessage, broadcastState, senderDisplay } from './broadcasts-presentation';
import { useCancelBroadcast } from './broadcasts-mutations';
import { StatsGrid, SummaryRow } from './broadcast-stats';
import { BroadcastPreview } from './broadcast-preview';
import { COLUMN, formatWhen, peopleCount } from './broadcast-draft';

export function BroadcastReview({
  ctx,
  broadcast,
  isFetching,
  updatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  broadcast: Broadcast;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const cancel = useCancelBroadcast();

  const audiences = useAudiences();
  const designed = useDesignedEmails();
  const settings = useEmailSettings();

  const isSent = broadcast.status === 'sent' || broadcast.status === 'sending';
  const stats = useBroadcastStats(broadcast.id, isSent);

  const state = broadcastState(broadcast.status);

  useEffect(() => {
    ctx.setTitle(broadcast.name);
  }, [ctx, broadcast.name]);

  const audienceName = audiences.data?.find((a) => a.id === broadcast.segmentId)?.name;
  const emailName = designed.data?.find((e) => e.id === broadcast.builderEmailId)?.name;

  const onCancel = async () => {
    const ok = await confirm({
      title: 'Cancel this scheduled broadcast?',
      description: `“${broadcast.name}” is set to send ${
        broadcast.scheduledAt ? `on ${formatWhen(broadcast.scheduledAt)}` : 'later'
      }. Cancelling stops it going out for good — nobody receives it. You can always start a new broadcast later.`,
      confirmLabel: 'Cancel the send',
      cancelLabel: 'Leave it scheduled',
      color: 'danger',
    });
    if (!ok) return;
    cancel.mutate(broadcast.id, {
      onSuccess: () => {
        toast.add({ title: 'Scheduled send cancelled', type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not cancel this broadcast',
          description: broadcastErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Broadcast actions"
        // Opens and clicks keep arriving for days after a send, and a scheduled
        // broadcast becomes a sent one without anything on screen changing.
        refresh={
          <RefreshButton
            isFetching={isFetching || stats.isFetching}
            updatedAt={updatedAt}
            onRefresh={() => {
              onRefresh();
              void stats.refetch();
            }}
          />
        }
        status={
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        }
        primary={
          broadcast.status === 'scheduled' ? (
            <Button
              size="sm"
              variant="outline"
              color="danger"
              className="ml-auto shrink-0"
              loading={cancel.isPending}
              onClick={() => {
                void onCancel();
              }}
            >
              <Icon glyph={faXmark} className="size-4" aria-hidden />
              Cancel send
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <Text className="text-sm">{broadcast.subject}</Text>

          <StateNotice broadcast={broadcast} />

          <FormSection title="Summary">
            <dl className="grid gap-x-6 gap-y-3 @md:grid-cols-2">
              <SummaryRow label="Who it went to" value={audienceName ?? 'An audience'} />
              <SummaryRow label="What was sent" value={emailName ?? 'A designed email'} />
              <SummaryRow label="From" value={senderDisplay(settings.data)} />
              <SummaryRow
                label={isSent ? 'People reached' : 'Audience'}
                value={broadcast.recipientCount > 0 ? peopleCount(broadcast.recipientCount) : '—'}
              />
              {broadcast.sentAt ? (
                <SummaryRow label="Sent" value={formatWhen(broadcast.sentAt)} />
              ) : broadcast.scheduledAt ? (
                <SummaryRow label="Scheduled for" value={formatWhen(broadcast.scheduledAt)} />
              ) : null}
            </dl>
          </FormSection>

          {/* The subject above is the raw one an owner typed, merge tags and all.
              This is the email as a customer received it. */}
          <FormSection
            title="What was sent"
            description="The email as it arrived, shown for one person out of the audience."
          >
            <BroadcastPreview id={broadcast.id} enabled />
          </FormSection>

          {isSent ? (
            <FormSection
              title="How it did"
              description="Counts update as people open and click over the hours and days after you send."
            >
              {stats.isError ? (
                <Alert color="warning">
                  <AlertContent>
                    <AlertTitle>Couldn’t load the results</AlertTitle>
                    <AlertDescription>
                      We couldn’t reach the engagement figures just now. Try refreshing in a moment.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : stats.isPending || !stats.data ? (
                <Text className="text-sm" role="status">
                  Loading results…
                </Text>
              ) : (
                <StatsGrid stats={stats.data} recipients={broadcast.recipientCount} />
              )}
            </FormSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The one-line story of a broadcast that is not simply sent: waiting, stopped,
 *  or broken. */
function StateNotice({ broadcast }: { broadcast: Broadcast }) {
  if (broadcast.status === 'scheduled' && broadcast.scheduledAt) {
    return (
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>Scheduled to send</AlertTitle>
          <AlertDescription>
            This goes out on {formatWhen(broadcast.scheduledAt)} to everyone in your audience. You
            can cancel it any time before then.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  if (broadcast.status === 'cancelled') {
    return (
      <Alert color="warning">
        <AlertContent>
          <AlertTitle>This send was cancelled</AlertTitle>
          <AlertDescription>
            It never went out. You can start a new broadcast whenever you’re ready.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  if (broadcast.status === 'failed') {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>This broadcast didn’t send</AlertTitle>
          <AlertDescription>
            Something went wrong while sending it. Check your sending address is set up, then try a
            new broadcast.
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  return null;
}
