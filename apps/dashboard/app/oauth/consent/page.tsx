import * as React from 'react';
import { redirect } from 'next/navigation';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/ui';
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
    <main className="bg-base-300 flex min-h-dvh items-center justify-center p-4">
      <div className="border-base-300 bg-base-100 w-full max-w-xl rounded-xl border p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6">
          <Wordmark />
          {children}
        </div>
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
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Can’t complete this connection</h2>
          <Alert color="danger" variant="soft">
            <AlertCircle />
            <AlertContent>
              <AlertTitle>Authorization blocked</AlertTitle>
              <AlertDescription>{validation.error}</AlertDescription>
            </AlertContent>
          </Alert>
          <p className="text-base-content text-sm">
            Close this window and start the connection again from your assistant.
          </p>
        </div>
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
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h2>
          <Alert color="warning" variant="soft">
            <AlertTriangle />
            <AlertContent>
              <AlertTitle>Your role can’t grant MCP access</AlertTitle>
              <AlertDescription>
                Your account role ({role}) has no MCP permissions to grant. Ask an owner or admin to
                connect this assistant.
              </AlertDescription>
            </AlertContent>
          </Alert>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h2>
        <p className="text-base-content">
          {clientName} is requesting access to your sparx workspace through the MCP server. Choose
          exactly what it can do — you can revoke this anytime in AI Integrations.
        </p>
      </div>

      <Alert color="warning" variant="soft">
        <AlertTriangle />
        <AlertContent>
          <AlertTitle>This grants an external app live access to your data</AlertTitle>
          <AlertDescription>
            Access tokens will be delivered to <strong>{redirectHost}</strong>. Only continue if you
            started this connection yourself.
          </AlertDescription>
        </AlertContent>
      </Alert>

      {queryError ? (
        <Alert color="danger" variant="soft">
          <AlertCircle />
          {queryError}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Signed in as</p>
        <p className="text-base-content text-sm">
          {session.user.email} · {role}
        </p>
      </div>

      <ConsentForm
        params={authorizeParamsRecord(params)}
        catalog={catalog}
        defaultSelected={defaultSelected}
      />
    </Shell>
  );
}
