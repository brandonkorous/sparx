// AI Integrations settings — issue, list, and revoke scoped API keys for the MCP
// transport (mcp.sparx.works), plus the OAuth-connected assistants. Both are on
// the sitewide list substrate ([[list-substrate]]): the API-key list is a
// `SelectionList` (table/cards) honoring the user's `defaultListView`; the OAuth
// connections are a fixed table above it. Server component fetches both; the
// IssueKeyForm + revoke actions live in ./_components.

import { KeyRound } from 'lucide-react';
import { Badge, Container, EmptyState, Heading, PageHeader, Stack } from '@sparx/ui';

import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { listApiKeysForCurrentTenant, listMcpConnectionsForCurrentTenant } from './actions';
import { IssueKeyForm } from './_components/issue-key-form';
import { KeysList } from './_components/keys-list';
import { ConnectionsList } from './_components/connections-list';

export const dynamic = 'force-dynamic';

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AiIntegrationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [prefs, keys, connections] = await Promise.all([
    getUserPreferences(),
    listApiKeysForCurrentTenant(),
    listMcpConnectionsForCurrentTenant(),
  ]);

  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';
  // Active keys first, revoked ones sink to the bottom of the single list.
  const sortedKeys = [...keys].sort((a, b) => (a.revokedAt ? 1 : 0) - (b.revokedAt ? 1 : 0));
  const activeCount = keys.filter((k) => !k.revokedAt).length;

  return (
    <Container size="xl">
      <Stack gap={8} className="py-10">
        <PageHeader
          icon={<KeyRound className="h-5 w-5" />}
          title="AI Integrations"
          badge={
            <Badge color="neutral">
              {activeCount} active key{activeCount === 1 ? '' : 's'}
            </Badge>
          }
          description="Connect Claude, ChatGPT, or Copilot to your live data over MCP. Assistants connect via OAuth (recommended) — you approve exactly what they can do — or with a scoped API key. Revoke either anytime."
          actions={<IssueKeyForm />}
        />

        <Stack gap={3}>
          <Heading level={2}>Connected assistants</Heading>
          {connections.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No assistants connected yet"
              description="Add sparx as a connector in Claude, ChatGPT, or Copilot and approve the scopes — the connection appears here."
            />
          ) : (
            <ConnectionsList connections={connections} />
          )}
        </Stack>

        <Stack gap={3}>
          <Heading level={2}>API keys</Heading>
          <ListToolbar enableViewToggle searchable={false} />
          {keys.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No API keys yet"
              description="Issue a scoped key to connect an assistant or integration that can’t use OAuth."
              action={<IssueKeyForm />}
            />
          ) : (
            <KeysList keys={sortedKeys} view={view} />
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
