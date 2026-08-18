import {
  Badge,
  statusLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@wizeworks/ui';
import type { OperatorEmailEvent } from '@wizeworks/operator';
import { formatDateTime } from '@/lib/format';
import { emailEventTone } from '@/lib/support';

// The tenant's email delivery log — Mailgun webhook events + our own
// accepted/failed markers, newest first. Read-only; each event's tone reads at a
// glance (delivered/opened green, bounced/failed red).
export function EmailLogTable({ events }: { events: OperatorEmailEvent[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Recipient</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e) => (
          <TableRow key={e.id}>
            <TableCell>
              <Text size="sm" variant="muted">
                {formatDateTime(e.occurredAt)}
              </Text>
            </TableCell>
            <TableCell>
              <Text size="sm">{e.recipient}</Text>
              {e.messageId ? (
                <Text size="xs" variant="muted" className="font-mono">
                  {e.messageId}
                </Text>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge color={emailEventTone(e.type)} variant="soft">
                {statusLabel(e.type)}
              </Badge>
            </TableCell>
            <TableCell>
              <Stack gap={0}>
                {e.reason ? <Text size="sm">{e.reason}</Text> : null}
                {e.broadcastId ? (
                  <Text size="xs" variant="muted">
                    Broadcast
                  </Text>
                ) : e.automationKey ? (
                  <Text size="xs" variant="muted">
                    Automation · {e.automationKey}
                  </Text>
                ) : null}
                {!e.reason && !e.broadcastId && !e.automationKey ? (
                  <Text size="sm" variant="muted">
                    —
                  </Text>
                ) : null}
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
