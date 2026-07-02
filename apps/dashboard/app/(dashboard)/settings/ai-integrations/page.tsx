// AI Integrations settings — issue, list, and revoke scoped API keys for
// the MCP transport (mcp.sparx.works). Server component fetches the list;
// the client-side IssueKeyForm + RevokeKeyButton live in ./_components.

import { KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { listApiKeysForCurrentTenant, listMcpConnectionsForCurrentTenant } from './actions';
import { IssueKeyForm } from './_components/issue-key-form';
import { ApiKeyRow } from './_components/api-key-row';
import { ConnectionRow } from './_components/connection-row';

export const dynamic = 'force-dynamic';

export default async function AiIntegrationsPage() {
  const [keys, connections] = await Promise.all([
    listApiKeysForCurrentTenant(),
    listMcpConnectionsForCurrentTenant(),
  ]);
  const live = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<KeyRound className="h-5 w-5" />}
          title="AI Integrations"
          description="Connect Claude, ChatGPT, or Copilot to your live data over MCP. Assistants connect via OAuth (recommended) — you approve exactly what they can do — or with a scoped API key. Revoke either anytime."
          actions={<IssueKeyForm />}
        />

        <Card>
          <CardHeader>
            <CardTitle>Connected assistants ({connections.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {connections.length === 0 ? (
              <Text size="sm" variant="muted">
                No assistants connected via OAuth yet. Add sparx as a connector in Claude, ChatGPT,
                or Copilot and approve the scopes — the connection appears here.
              </Text>
            ) : (
              <Stack gap={2}>
                {connections.map((c) => (
                  <ConnectionRow key={c.clientId} connection={c} />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active keys ({live.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {live.length === 0 ? (
              <Text size="sm" variant="muted">
                No active keys yet. Use “Issue key” above to create one.
              </Text>
            ) : (
              <Stack gap={2}>
                {live.map((k) => (
                  <ApiKeyRow key={k.id} apiKey={k} />
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {revoked.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revoked ({revoked.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={2}>
                {revoked.map((k) => (
                  <ApiKeyRow key={k.id} apiKey={k} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
