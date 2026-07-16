import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCapability } from '@sparx/operator-auth/next';
import { listOperators, logOperatorAction } from '@sparx/operator-auth';
import { Badge, Card, Heading, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorFeedbackDetail } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate } from '@/lib/format';
import {
  categoryLabel,
  feedbackStatusLabel,
  feedbackStatusTone,
  firstText,
  sentimentLabel,
  sentimentTone,
} from '@/lib/feedback';
import { CategoryIcon } from '../../_components/category-icon';
import { TriageControls } from './_components/triage-controls';
import { ReplyComposer } from './_components/reply-composer';
import { ContextPanel } from './_components/context-panel';
import { FeedbackThread } from './_components/feedback-thread';

function titleOf(feedback: OperatorFeedbackDetail): string {
  if (feedback.subject) return feedback.subject;
  const line = feedback.body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ?? categoryLabel(feedback.category);
}

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const operator = await requireCapability('feedback:respond');
  const { tenantId, id } = await params;

  let feedback: OperatorFeedbackDetail | null = null;
  let error: string | null = null;
  try {
    feedback = await operatorApi().getFeedback(tenantId, id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'feedback:respond',
      action: 'feedback.detail.view',
      targetTenantId: tenantId,
      diff: { submissionId: id },
    });
  } catch {
    // best-effort audit
  }

  const backLink = (
    <Link href="/sparx/feedback" className="text-base-content text-sm hover:underline">
      ← All feedback
    </Link>
  );

  if (!feedback) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'Feedback unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const operators = await listOperators().catch(() => []);

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <CategoryIcon category={feedback.category} className="text-base-content h-5 w-5" />
          <Heading level={1}>{titleOf(feedback)}</Heading>
          <Badge color={feedbackStatusTone(feedback.status)} variant="soft">
            {feedbackStatusLabel(feedback.status)}
          </Badge>
          {feedback.sentiment != null ? (
            <Badge color={sentimentTone(feedback.sentiment)} variant="soft">
              {sentimentLabel(feedback.sentiment)}
            </Badge>
          ) : null}
        </Stack>
        <Text variant="muted">
          {categoryLabel(feedback.category)} ·{' '}
          <Link
            href={`/sparx/tenants/${feedback.tenantId}`}
            className="text-module hover:underline"
          >
            {feedback.tenantName}
          </Link>{' '}
          · {firstText(feedback.submitterName, feedback.submitterEmail, 'Unknown submitter')} ·
          Submitted {formatDate(feedback.createdAt)}
        </Text>
      </Stack>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Stack gap={4}>
            <FeedbackThread feedback={feedback} />
            <Card>
              <Stack gap={3}>
                <Heading level={3}>Reply</Heading>
                <ReplyComposer
                  tenantId={tenantId}
                  submissionId={id}
                  currentStatus={feedback.status}
                  hasEmail={Boolean(feedback.submitterEmail)}
                />
              </Stack>
            </Card>
          </Stack>
        </div>
        <div>
          <Stack gap={4}>
            <Card>
              <Stack gap={3}>
                <Heading level={3}>Triage</Heading>
                <TriageControls
                  tenantId={tenantId}
                  submissionId={id}
                  currentStatus={feedback.status}
                  currentAssigneeId={feedback.assigneeStaffId}
                  currentTags={feedback.internalTags}
                  operators={operators}
                />
              </Stack>
            </Card>
            <ContextPanel
              context={feedback.context}
              attachmentAssetIds={feedback.attachmentAssetIds}
            />
          </Stack>
        </div>
      </div>
    </Stack>
  );
}
