'use client';

// The notifications table: where each goes, what triggers it, when it was set up,
// and how it is going. People scan down a column: "which are paused", "what's newest".

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  eventLabel,
  formatDateTime,
  webhookState,
  type WebhookSubscription,
} from './webhooks-data';

type OpenWebhook = (
  webhook: WebhookSubscription,
  event: { shiftKey: boolean; altKey: boolean }
) => void;

/** The first couple of event names, then "+N more", so a webhook on everything
 *  does not wrap to four lines. */
function eventsSummary(events: string[]): string {
  if (events.length === 0) return 'No events chosen';
  const names = events.map(eventLabel);
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} · +${String(names.length - 2)} more`;
}

function WebhookRow({ webhook, onOpen }: { webhook: WebhookSubscription; onOpen: OpenWebhook }) {
  const state = webhookState(webhook.active, webhook.health);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(webhook, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(webhook, event);
      }}
    >
      <td>
        <span className="block max-w-72 truncate font-medium">{webhook.name}</span>
        <span className="block max-w-72 truncate font-mono text-sm">{webhook.url}</span>
      </td>
      <td className="hidden max-w-64 truncate @xl:table-cell">{eventsSummary(webhook.events)}</td>
      <td className="hidden text-sm whitespace-nowrap @4xl:table-cell" data-label="Set up">
        {formatDateTime(webhook.createdAt)}
      </td>
      <td>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function WebhooksTable({
  rows,
  onOpen,
}: {
  rows: WebhookSubscription[];
  onOpen: OpenWebhook;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Where it goes</th>
          <th className="hidden @xl:table-cell">What triggers it</th>
          <th className="hidden @4xl:table-cell">Set up</th>
          <th>How it is going</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((webhook) => (
          <WebhookRow key={webhook.id} webhook={webhook} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
