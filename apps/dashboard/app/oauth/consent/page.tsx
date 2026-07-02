import * as React from 'react';
import { redirect } from 'next/navigation';
import { Alert, Heading, Stack, Text, Wordmark } from '@sparx/ui';
import {
  getSession,
  grantableScopesForRole,
  capBusinessScopes,
  MCP_SCOPE_CATALOG,
  type StaffRole,
} from '@sparx/auth';
import {
  parseAuthorizeParams,
  validateAuthorizeRequest,
  authorizeParamsRecord,
  consentReturnPath,
} from './_lib/consent';
import { ConsentForm } from './_components/consent-form';

// The MCP OAuth consent screen (docs/07 §5). Standalone route (outside the
// dashboard shell) that ALL /mcp/authorize traffic is funnelled through by the
// server.ts guard hook. The user reviews who is connecting + where tokens go,
// then picks exactly which scopes to grant.
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-300)] p-4">
      <div className="w-full max-w-xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-100)] p-6 shadow-sm sm:p-8">
        <Stack gap={6}>
          <Wordmark />
          {children}
        </Stack>
      </div>
    </main>
  );
}

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = parseAuthorizeParams(sp);
  const queryError = one(sp.error);

  const session = await getSession();
  if (!session) {
    // Preserve the full authorize request across sign-in.
    redirect(`/sign-in?callbackURL=${encodeURIComponent(consentReturnPath(params))}`);
  }

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    return (
      <Shell>
        <Stack gap={3}>
          <Heading level={2}>Can’t complete this connection</Heading>
          <Alert color="danger" title="Authorization blocked">
            {validation.error}
          </Alert>
          <Text size="sm" variant="muted">
            Close this window and start the connection again from your assistant.
          </Text>
        </Stack>
      </Shell>
    );
  }

  const client = validation.client;
  const role = session.user.role as StaffRole;
  const grantable = new Set<string>(grantableScopesForRole(role));
  const catalog = MCP_SCOPE_CATALOG.filter((s) => grantable.has(s.scope));
  const requested = params.scope.split(' ').filter(Boolean);
  const defaultSelected = capBusinessScopes(requested, role);

  const rawName = client.name?.trim();
  const clientName = rawName?.length ? rawName : 'An AI assistant';
  let redirectHost = params.redirectUri;
  try {
    redirectHost = new URL(params.redirectUri).host;
  } catch {
    /* validated above; keep raw as a fallback */
  }

  if (catalog.length === 0) {
    return (
      <Shell>
        <Stack gap={3}>
          <Heading level={2}>Connect {clientName}</Heading>
          <Alert color="warning" title="Your role can’t grant MCP access">
            Your account role ({role}) has no MCP permissions to grant. Ask an owner or admin to
            connect this assistant.
          </Alert>
        </Stack>
      </Shell>
    );
  }

  return (
    <Shell>
      <Stack gap={2}>
        <Heading level={2}>Connect {clientName}</Heading>
        <Text variant="muted">
          {clientName} is requesting access to your sparx workspace through the MCP server. Choose
          exactly what it can do — you can revoke this anytime in AI Integrations.
        </Text>
      </Stack>

      <Alert
        color="warning"
        variant="soft"
        title="This grants an external app live access to your data"
      >
        <Text size="sm">
          Access tokens will be delivered to <strong>{redirectHost}</strong>. Only continue if you
          started this connection yourself.
        </Text>
      </Alert>

      {queryError ? <Alert color="danger">{queryError}</Alert> : null}

      <Stack gap={1}>
        <Text size="sm" weight="medium">
          Signed in as
        </Text>
        <Text size="sm" variant="muted">
          {session.user.email} · {role}
        </Text>
      </Stack>

      <ConsentForm
        params={authorizeParamsRecord(params)}
        catalog={catalog}
        defaultSelected={defaultSelected}
      />
    </Shell>
  );
}
