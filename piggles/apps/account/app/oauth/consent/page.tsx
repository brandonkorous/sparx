import * as React from 'react';
import { redirect } from 'next/navigation';
import { Alert, Text } from '@wizeworks/silicaui-react';
import { Logo } from '@piggles/brand/react';
import { AppearanceControl } from '@/components/appearance-control';
import { APP_BY_ID, MODULE_TO_APP, moduleTerm } from '@piggles/config';
import {
  getSession,
  grantableScopesForRole,
  capBusinessScopes,
  MCP_SCOPE_CATALOG,
  type StaffRole,
} from '@wizeworks/auth';
import {
  parseAuthorizeParams,
  validateAuthorizeRequest,
  authorizeParamsRecord,
  consentReturnPath,
} from './_lib/consent';
import { ConsentForm } from './_components/consent-form';

// "Do you want to let this app in?" — the MCP OAuth consent screen (docs/07 §5).
//
// Every /mcp/authorize request is funnelled here by the guard hook in
// @wizeworks/auth. The person reviews who is asking and where their access will be
// sent, then chooses exactly what it may do.
//
// It lives in the ACCOUNT app because this is the only Piggles app that mounts
// Better Auth — see lib/mcp-oauth-metadata.ts for the full reasoning. The
// practical consequence is visible right here: an unauthenticated visitor gets
// redirected to `/sign-in`, and this is the only Piggles app where that page
// exists.
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '');

/** Piggles' name for the app a permission belongs to, so the groups read as the
 *  things people actually use — Bookings, Customers, Stock — instead of the
 *  platform's module keys. Falls through rather than rendering a blank when a
 *  module arrives that the lexicon has not been taught yet. */
function appLabel(module: string): string {
  const appId = MODULE_TO_APP[module];
  const app = appId ? APP_BY_ID[appId] : undefined;
  return app?.label ?? moduleTerm(module) ?? module;
}

// Outer chrome only. The card is a viewport-bounded flex column so the form can
// pin its footer around a scrolling middle — the Allow action must be on screen
// no matter how many permissions render.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-base-200 grid min-h-dvh place-items-center p-4 sm:p-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-5">
        {/* The mark centred, with the appearance control pulled to the right of
            the same row — this screen is a single centred card, so a separate
            header row for one chrome control would be a second bar for nothing. */}
        <div className="flex w-full items-center justify-center">
          <Logo className="h-10 w-auto" title="Piggles" />
          <span className="ml-auto">
            <AppearanceControl />
          </span>
        </div>
        <div className="bg-base-100 border-base-300 flex max-h-[calc(100dvh-7rem)] w-full flex-col overflow-hidden rounded-xl border">
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
    // Carry the whole authorize request across sign-in, so somebody who has to
    // log in first does not have to start the connection again from their app.
    redirect(`/sign-in?callbackURL=${encodeURIComponent(consentReturnPath(params))}`);
  }

  const validation = await validateAuthorizeRequest(params);
  if (!validation.ok) {
    return (
      <Shell>
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">We stopped this connection</h1>
          <Alert color="danger" variant="soft" role="alert">
            {validation.error}
          </Alert>
          <Text className="text-sm">
            Nothing has been shared. Close this window and start again from the app you were using.
          </Text>
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
  const clientName = rawName?.length ? rawName : 'An assistant';
  let redirectHost = params.redirectUri;
  try {
    redirectHost = new URL(params.redirectUri).host;
  } catch {
    /* validated above; keep the raw value as a fallback */
  }

  if (catalog.length === 0) {
    return (
      <Shell>
        <div className="flex flex-col gap-3 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h1>
          <Alert color="warning" variant="soft" role="alert">
            Your account cannot give an app access to this business. Ask whoever owns it to make the
            connection.
          </Alert>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Pinned: who is asking, and the one warning that matters, both stay in
          view while the permission list scrolls underneath. */}
      <div className="border-base-300 flex shrink-0 flex-col gap-3 border-b p-6 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Connect {clientName}</h1>
          <Text className="text-sm">
            {clientName} wants to work in your business on your behalf. Choose exactly what it can
            do — you can take it back any time from AI connections.
          </Text>
        </div>

        {/* The security sentence, and the reason it names the host: the one thing
            a person can actually check is whether the destination looks like the
            app they just used. */}
        <Alert color="warning" variant="soft" className="text-sm">
          This gives an outside app live access to your business. Its access is sent to{' '}
          <strong>{redirectHost}</strong> — only continue if you started this yourself.
        </Alert>

        {queryError ? (
          <Alert color="danger" variant="soft" role="alert">
            {queryError}
          </Alert>
        ) : null}

        <Text className="text-sm">
          Signed in as <strong>{session.user.email}</strong>
        </Text>
      </div>

      <ConsentForm
        params={authorizeParamsRecord(params)}
        catalog={catalog}
        defaultSelected={defaultSelected}
        groupLabel={appLabel}
      />
    </Shell>
  );
}
