// AI Integrations settings — issue, list, and revoke scoped API keys for the MCP
// transport (mcp.sparx.works), plus the OAuth-connected assistants. Both are on
// the sitewide list substrate ([[list-substrate]]): the API-key list is a
// `SelectionList` (table/cards) honoring the user's `defaultListView`; the OAuth
// connections are a fixed table above it. Server component fetches both; the
// IssueKeyForm + revoke actions live in ./_components.

import { KeyRound } from 'lucide-react';
import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, EmptyState } from '@wizeworks/silicaui-react';

import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import {
  listApiKeysForCurrentTenant,
  listMcpConnectionsForCurrentTenant,
  getIssuableScopeCatalogForCurrentTenant,
} from './actions';
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
  const [prefs, keys, connections, issuableScopes] = await Promise.all([
    getUserPreferences(),
    listApiKeysForCurrentTenant(),
    listMcpConnectionsForCurrentTenant(),
    getIssuableScopeCatalogForCurrentTenant(),
  ]);

  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';
  // Active keys first, revoked ones sink to the bottom of the single list.
  const sortedKeys = [...keys].sort((a, b) => (a.revokedAt ? 1 : 0) - (b.revokedAt ? 1 : 0));
  const activeCount = keys.filter((k) => !k.revokedAt).length;

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<KeyRound className="h-5 w-5" />}
          title="AI Integrations"
          badge={
            <Badge color="neutral">
              {activeCount} active key{activeCount === 1 ? '' : 's'}
            </Badge>
          }
          description="Connect Claude, ChatGPT, or Copilot to your live data over MCP. Assistants connect via OAuth (recommended) — you approve exactly what they can do — or with a scoped API key. Revoke either anytime."
          className="mb-0"
        />
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Connected assistants</h2>
          {connections.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No assistants connected yet"
              description="Add sparx as a connector in Claude, ChatGPT, or Copilot and approve the scopes — the connection appears here."
            />
          ) : (
            <ConnectionsList connections={connections} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">API keys</h2>
          <ListToolbar
            enableViewToggle
            searchable={false}
            primaryAction={<IssueKeyForm catalog={issuableScopes} />}
          />
          {keys.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No API keys yet"
              description="Issue a scoped key to connect an assistant or integration that can’t use OAuth."
              actions={<IssueKeyForm catalog={issuableScopes} />}
            />
          ) : (
            <KeysList keys={sortedKeys} view={view} />
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
