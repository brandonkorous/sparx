import Link from 'next/link';
import {
  Badge,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type { OperatorFeedbackItem } from '@wizeworks/operator';
import { formatRelative } from '@/lib/format';
import { categoryLabel, feedbackStatusLabel, feedbackStatusTone, firstText } from '@/lib/feedback';
import { CategoryIcon } from './category-icon';

// The cross-tenant feedback inbox. Row → submission detail. Status resolves its
// tone through the curated feedback dictionary; an unread dot marks submissions
// updated since a submitter last replied. `assigneeNames` resolves the bare
// wize_admin operator id (api-rest can't) to a display name.
export function FeedbackTable({
  submissions,
  assigneeNames,
}: {
  submissions: OperatorFeedbackItem[];
  assigneeNames: Record<string, string>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feedback</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead className="text-right">Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((s) => (
          <TableRow key={`${s.tenantId}:${s.id}`}>
            <TableCell>
              <Stack direction="row" align="start" gap={2}>
                <span className="mt-0.5">
                  <CategoryIcon category={s.category} />
                </span>
                <Stack gap={0}>
                  <Link
                    href={`/sparx/feedback/${s.tenantId}/${s.id}`}
                    className="text-base-content font-medium hover:underline"
                  >
                    {firstText(s.subject, s.excerpt, categoryLabel(s.category))}
                  </Link>
                  <Text size="xs" variant="muted">
                    {firstText(s.submitterName, s.submitterEmail, 'Unknown submitter')}
                    {s.messageCount > 0 ? ` · ${s.messageCount} replies` : ''}
                  </Text>
                </Stack>
              </Stack>
            </TableCell>
            <TableCell>
              <Link
                href={`/sparx/tenants/${s.tenantId}`}
                className="text-module text-sm hover:underline"
              >
                {s.tenantName}
              </Link>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {s.module ?? '—'}
              </Text>
            </TableCell>
            <TableCell>
              <Stack direction="row" align="center" gap={2}>
                {s.userUnread ? (
                  <span
                    className="bg-module h-2 w-2 shrink-0 rounded-full"
                    aria-label="Unread by submitter"
                  />
                ) : null}
                <Badge color={feedbackStatusTone(s.status)} variant="soft">
                  {feedbackStatusLabel(s.status)}
                </Badge>
              </Stack>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {s.assigneeStaffId ? (assigneeNames[s.assigneeStaffId] ?? 'Assigned') : '—'}
              </Text>
            </TableCell>
            <TableCell className="text-right">
              <Text size="sm" variant="muted">
                {formatRelative(s.createdAt)}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
