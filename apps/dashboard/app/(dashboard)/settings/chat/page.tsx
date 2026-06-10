// Live Chat settings page (docs/69 A-5) — widget config + quick replies.
// Module-gated: a tenant without chat sees the activation upsell.

import { MessagesSquare } from 'lucide-react';
import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { requireModuleOrUpsell } from '@/components/module-gate';

import { ChatSettingsForm } from './_components/chat-settings-form';
import type { ChatConfig, QuickReplyDto } from './_lib/types';

export const dynamic = 'force-dynamic';

export default async function ChatSettingsPage(): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('chat');
  if (upsell) return <>{upsell}</>;

  const [config, quickReplies] = await Promise.all([
    api.get<ChatConfig>('/v1/chat/settings'),
    api.get<QuickReplyDto[]>('/v1/chat/quick-replies').catch(() => [] as QuickReplyDto[]),
  ]);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<MessagesSquare className="h-5 w-5" />}
          title="Live Chat"
          description="Configure the storefront chat widget, AI behavior, and your team's quick replies."
        />
        <ChatSettingsForm initialConfig={config} initialQuickReplies={quickReplies} />
      </Stack>
    </Container>
  );
}
