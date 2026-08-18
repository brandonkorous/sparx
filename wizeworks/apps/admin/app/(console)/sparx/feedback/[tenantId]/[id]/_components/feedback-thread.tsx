import { Badge, Card, Heading, Stack, Text } from '@wizeworks/ui';
import type { OperatorFeedbackDetail } from '@wizeworks/operator';
import { formatDateTime } from '@/lib/format';
import { firstText } from '@/lib/feedback';

// The conversation: the original submission (row 0) followed by the reply thread
// in time order. Staff messages are visually distinct from the submitter's (a
// module-tinted left rule + a Staff badge) so the exchange reads at a glance.
export function FeedbackThread({ feedback }: { feedback: OperatorFeedbackDetail }) {
  const submitter = firstText(feedback.submitterName, feedback.submitterEmail, 'Submitter');
  return (
    <Card>
      <Stack gap={4}>
        <Heading level={3}>Conversation</Heading>

        <Bubble author={submitter} at={feedback.createdAt} kind="user">
          {feedback.body}
        </Bubble>

        {feedback.messages.map((m) => (
          <Bubble
            key={m.id}
            author={m.authorName}
            at={m.createdAt}
            kind={m.authorKind === 'staff' ? 'staff' : 'user'}
          >
            {m.body}
          </Bubble>
        ))}
      </Stack>
    </Card>
  );
}

function Bubble({
  author,
  at,
  kind,
  children,
}: {
  author: string;
  at: string;
  kind: 'staff' | 'user';
  children: string;
}) {
  const isStaff = kind === 'staff';
  return (
    <div className={isStaff ? 'border-module border-l-2 pl-4' : 'border-base-300 border-l-2 pl-4'}>
      <Stack gap={1}>
        <Stack direction="row" align="center" gap={2} className="flex-wrap">
          <Text size="sm" className="font-medium">
            {author}
          </Text>
          {isStaff ? (
            <Badge color="module" variant="soft" size="sm">
              Staff
            </Badge>
          ) : null}
          <Text size="xs" variant="muted">
            {formatDateTime(at)}
          </Text>
        </Stack>
        <Text size="sm" className="whitespace-pre-wrap">
          {children}
        </Text>
      </Stack>
    </div>
  );
}
