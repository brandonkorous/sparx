import * as React from 'react';
import { redirect } from 'next/navigation';
import { Alert, Text } from '@wizeworks/silicaui-react';
import { Wordmark } from '@sparx/brand/react';
import {
  CONSENT_ERROR_PARAM,
  getSession,
  grantableScopesForRole,
  capBusinessScopes,
  MCP_SCOPE_CATALOG,
  readMcpConsentRequest,
  toSearchParams,
  type StaffRole,
} from '@wizeworks/auth';
import { ConsentForm } from './_components/consent-form';

// The MCP OAuth consent screen (docs/07 §5). A standalone route outside the
// workbench dock: the MCP provider in @wizeworks/auth sends every authorization
// that needs a person here, with the request signed (`loginPage` and
// `consentPage` are both this page). The operator reviews who is connecting +
// where tokens go, then picks exactly which scopes to grant. Styled as a workbench pane on the
// recessed canvas so it reads as part of the app, not a separate site.
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

// Outer chrome only. The card is a viewport-bounded flex column so a caller can
// pin a header + a sticky footer around a scrollable middle — the consent screen
// needs its Authorize action on screen no matter how many scopes render, and the
// full owner catalog (25 scopes / 12 modules) far overflows a laptop viewport.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-base-200 grid min-h-dvh place-items-center p-4 sm:p-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-5">
        <Wordmark size={56} aria-label="sparx" />
        <div className="bg-base-100 border-base-300 flex max-h-[calc(100dvh-7rem)] w-full flex-col overflow-hidden rounded-xl border">
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = toSearchParams(await searchParams);
  const queryError = sp.get(CONSENT_ERROR_PARAM) ?? '';

  // The signature first: an expired or hand-made link fails the same way
  // whether or not anybody is signed in, and nobody should sign in for nothing.
  const read = await readMcpConsentRequest(sp);
  if (!read.ok) {
    return (
      <Shell>
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Can’t complete this connection</h1>
          <Alert color="danger" variant="soft" role="alert">
            {read.error}
          </Alert>
          <Text className="text-sm">
            Close this window and start the connection again from your assistant.
          </Text>
        </div>
      </Shell>
    );
  }

  const session = await getSession();
  if (!session) {
    // Preserve the full authorize request across sign-in.
    sp.delete(CONSENT_ERROR_PARAM);
    redirect(`/sign-in?callbackURL=${encodeURIComponent(`/oauth/consent?${sp.toString()}`)}`);
  }

  const { client, redirectUri, requestedScopes, oauthQuery } = read.request;
  const role = session.user.role as StaffRole;
  // Only what the client asked for AND this role may give: the provider refuses
  // to approve a scope that was not in the signed request.
  const grantable = new Set<string>(grantableScopesForRole(role));
  const catalog = MCP_SCOPE_CATALOG.filter(
    (s) => grantable.has(s.scope) && requestedScopes.includes(s.scope)
  );
  const defaultSelected = capBusinessScopes(requestedScopes, role);

  const rawName = client.name?.trim();
  const clientName = rawName?.length ? rawName : 'An AI assistant';
  let redirectHost = redirectUri;
  try {
    redirectHost = new URL(redirectUri).host;
  } catch {
    /* validated above; keep raw as a fallback */
  }

  if (catalog.length === 0) {
    return (
      <Shell>
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h1>
          <Alert color="warning" role="alert">
            Your account role ({role}) has no MCP permissions to grant. Ask an owner or admin to
            connect this assistant.
          </Alert>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Pinned header — the connection's identity + the security warning stay in
          view while the scope list below scrolls. */}
      <div className="border-base-300 flex shrink-0 flex-col gap-3 border-b p-6 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h1>
          <Text className="text-sm">
            {clientName} wants to act in your sparx workspace through the MCP server. Choose exactly
            what it can do: revoke anytime in AI Connections.
          </Text>
        </div>

        <Alert color="warning" className="text-sm">
          Grants an external app live access to your data. Access tokens are delivered to{' '}
          <strong>{redirectHost}</strong>. Only continue if you started this connection yourself.
        </Alert>

        {queryError ? (
          <Alert color="danger" variant="soft" role="alert">
            {queryError}
          </Alert>
        ) : null}

        <Text className="text-sm">
          Signed in as <strong>{session.user.email}</strong> · {role}
        </Text>
      </div>

      <ConsentForm oauthQuery={oauthQuery} catalog={catalog} defaultSelected={defaultSelected} />
    </Shell>
  );
}
