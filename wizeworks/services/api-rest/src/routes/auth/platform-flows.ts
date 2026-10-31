// The sign-in flows that need more than Better Auth's own endpoints:
//
//   POST /auth/<brand>/platform/sign-up                    → a new business and its owner
//   POST /auth/<brand>/platform/verification-email         → send the confirm link again
//   GET  /auth/<brand>/platform/invitations/:id            → the invitation, to show it
//   POST /auth/<brand>/platform/invitations/:id/accept     → join the business
//   GET  /auth/<brand>/platform/mcp-consent?<oauth query>  → who is asking, for what
//   POST /auth/<brand>/platform/mcp-consent                → the person's answer
//   GET  /auth/<brand>/platform/mcp-discovery/:kind        → the OAuth discovery document
//
// Each ran in the brand's app on its own Better Auth instance until the apps
// came off the database (docs/154). A step that writes a session (sign-up signs
// the new owner in, joining a business switches to it) answers with the new
// cookies as `cookies`, already shaped for the app to set: the app's own
// responses are where the browser gets them.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  approvedScope,
  auth,
  authEmailsCanLeave,
  authPrisma,
  brandAuthHandler,
  getInvitationDetail,
  invitationMatchesUserBrand,
  publishAuthEmail,
  readMcpConsentRequest,
  sessionCookiesFromSetCookie,
  signUpMerchant,
  SignUpError,
  submitMcpConsent,
  type SignUpAcquisition,
  type StaffRole,
} from '@wizeworks/auth';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';
import { clientIpFromChain } from '@wizeworks/client-ip';
import { appOrigin } from '@wizeworks/links/server';

import { writeConsent } from '../../lib/user-consent.js';
import { AcquisitionBody, platformSession, requestHeaders, servedBrand } from './platform-scope.js';

/** A path inside the brand's own sign-in host: one slash, never two, and never
 *  a scheme, so a link can never be turned into an open redirect. */
const InternalPath = z
  .string()
  .max(2048)
  .regex(/^\/(?!\/)[^\s\\]*$/);

const SignUpBody = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(8).max(256),
  name: z.string().trim().min(1).max(120),
  acquisition: AcquisitionBody.nullable().optional(),
  /** The analytics answer from the sign-up form, recorded as consent. */
  analytics: z.boolean().optional(),
  /** The zone the business's site address is minted in, as the brand declares
   *  it. Omitted, the brand's configured zone. */
  zoneDomain: z
    .string()
    .max(253)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/)
    .optional(),
});
const VerificationBody = z.object({ callbackURL: InternalPath.optional() });
const InvitationParams = z.object({ id: z.string().min(1).max(200) });
const ConsentAnswer = z.object({
  oauthQuery: z.string().max(8192),
  accept: z.boolean(),
  scopes: z.array(z.string().max(200)).max(200).optional(),
});
const DiscoveryParams = z.object({ kind: z.enum(['oauth', 'openid']) });

/** A Better Auth error's own sentence when it has one, else the fallback. */
function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'body' in err) {
    const body = (err as { body?: { message?: string } }).body;
    if (body?.message) return body.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function noStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store, private');
}

async function signedIn(request: FastifyRequest, reply: FastifyReply) {
  noStore(reply);
  const found = await platformSession(request);
  if (!found) await reply.code(401).send({ error: 'unauthenticated' });
  return found;
}

const platformFlowRoutes: FastifyPluginAsync = (app) => {
  // A new business and its owner, then the owner signed in. The brand comes
  // from the path, so the account is made under the product it was asked of,
  // and the business's site lands in that brand's own zone.
  app.post('/auth/:brand/platform/sign-up', async (request, reply) => {
    noStore(reply);
    const brand = servedBrand(request)!;
    const body = SignUpBody.parse(request.body);
    const headers = requestHeaders(request);
    let account: { userId: string; tenantId: string };
    try {
      account = await runAsBrand(brand, () =>
        signUpMerchant({
          email: body.email,
          password: body.password,
          name: body.name,
          ipAddress: clientIpFromChain(headers.get('x-forwarded-for')),
          userAgent: headers.get('user-agent'),
          // Shape-checked above. `channel` is read as any short string, not the
          // attribution package's list: a list copied here would drift, and a
          // channel added there would then refuse a real sign-up.
          acquisition: (body.acquisition ?? null) as SignUpAcquisition | null,
          platformBrand: brand,
          zoneDomain: body.zoneDomain,
        })
      );
    } catch (err) {
      if (err instanceof SignUpError) {
        return reply
          .code(err.code === 'EMAIL_TAKEN' ? 409 : 400)
          .send({ error: err.code, message: err.message });
      }
      throw err;
    }

    // Best-effort: the account exists, and failing the sign-up over the answer
    // would throw away what just succeeded. A miss re-asks on the way in.
    if (body.analytics !== undefined) {
      await writeConsent(account.userId, account.tenantId, body.analytics).catch((err: unknown) =>
        request.log.error(
          { err, userId: account.userId },
          'sign-up: recording the analytics answer failed'
        )
      );
    }

    try {
      const signedIn = await runAsBrand(brand, () =>
        auth.api.signInEmail({
          body: { email: body.email, password: body.password },
          headers,
          returnHeaders: true,
        })
      );
      return reply.send({
        ok: true,
        userId: account.userId,
        signedIn: true,
        cookies: sessionCookiesFromSetCookie(signedIn.headers.getSetCookie()),
      });
    } catch (err) {
      request.log.warn({ err, userId: account.userId }, 'sign-up: signing the new owner in failed');
      return reply.send({ ok: true, userId: account.userId, signedIn: false, cookies: [] });
    }
  });

  // Always to the signed-in person's own address: a link sent wherever the
  // request said would be a way to mail anyone a link from us.
  app.post('/auth/:brand/platform/verification-email', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { callbackURL } = VerificationBody.parse(request.body ?? {});
    const { user } = found.session;
    if (user.emailVerified) return reply.send({ ok: true, email: user.email });
    if (!authEmailsCanLeave()) {
      return reply.code(503).send({
        error: 'Email cannot be sent from here right now, so no link went. Nothing changed.',
      });
    }
    try {
      await runAsBrand(found.brand, () =>
        auth.api.sendVerificationEmail({
          body: { email: user.email, callbackURL: callbackURL ?? '/verify-email' },
        })
      );
      return reply.send({ ok: true, email: user.email });
    } catch (err) {
      request.log.warn({ err }, 'verification email did not send');
      return reply
        .code(502)
        .send({ error: 'The link didn’t send. Nothing changed. Try again in a minute.' });
    }
  });

  // Anyone holding the link may see who invited them and to what, which is
  // what the email already said. An invitation from another brand's business
  // reads as missing: each brand's people are its own.
  app.get('/auth/:brand/platform/invitations/:id', async (request, reply) => {
    noStore(reply);
    const brand = servedBrand(request)!;
    const { id } = InvitationParams.parse(request.params);
    const [invite, owner] = await Promise.all([
      getInvitationDetail(id),
      authPrisma.invitation.findUnique({
        where: { id },
        select: { organization: { select: { platformBrand: true } } },
      }),
    ]);
    if (!invite || owner?.organization.platformBrand !== brand) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return reply.send({ invitation: { ...invite, expiresAt: invite.expiresAt.toISOString() } });
  });

  app.post('/auth/:brand/platform/invitations/:id/accept', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const { id } = InvitationParams.parse(request.params);
    if (!(await invitationMatchesUserBrand(id, found.session.user.id))) {
      return reply.code(403).send({
        error:
          'That invitation was sent from somewhere else and cannot be accepted with this account. Ask whoever invited you to send it again.',
      });
    }
    const headers = requestHeaders(request);
    const setCookies: string[] = [];
    let organizationId: string | null = null;
    try {
      const accepted = await runAsBrand(found.brand, () =>
        auth.api.acceptInvitation({ body: { invitationId: id }, headers, returnHeaders: true })
      );
      setCookies.push(...accepted.headers.getSetCookie());
      const result = accepted.response as {
        member?: { organizationId?: string };
        invitation?: { organizationId?: string };
      } | null;
      organizationId = result?.member?.organizationId ?? result?.invitation?.organizationId ?? null;
    } catch (err) {
      return reply
        .code(400)
        .send({ error: errorMessage(err, 'We could not accept that invitation.') });
    }

    if (organizationId) {
      // Tell whoever sent it. Never fatal: the person has joined either way.
      try {
        const invitation = await authPrisma.invitation.findUnique({
          where: { id },
          select: {
            email: true,
            organizationId: true,
            organization: { select: { name: true, platformBrand: true } },
            inviter: { select: { name: true, email: true } },
          },
        });
        if (invitation?.inviter?.email) {
          await publishAuthEmail({
            tenantId: invitation.organizationId,
            actorId: null,
            template: 'invitation-accepted',
            to: invitation.inviter.email,
            props: {
              inviterName: invitation.inviter.name ?? undefined,
              inviteeEmail: invitation.email,
              orgName: invitation.organization.name,
              dashboardUrl: appOrigin(invitation.organization.platformBrand),
            },
          });
        }
      } catch (err) {
        request.log.warn({ err, invitationId: id }, 'invitation accepted, inviter not told');
      }
      // Land them in the business they just joined. Never fatal either.
      try {
        const switched = await runAsBrand(found.brand, () =>
          auth.api.setActiveOrganization({ body: { organizationId }, headers, returnHeaders: true })
        );
        setCookies.push(...switched.headers.getSetCookie());
      } catch (err) {
        request.log.warn({ err, organizationId }, 'invitation accepted, business not switched');
      }
    }
    return reply.send({ ok: true, cookies: sessionCookiesFromSetCookie(setCookies) });
  });

  // The signed query Better Auth sent the person here with is checked here,
  // because only this process holds the secret it was signed with.
  app.get('/auth/:brand/platform/mcp-consent', async (request, reply) => {
    noStore(reply);
    const brand = servedBrand(request)!;
    const search = new URL(request.url, 'http://internal').searchParams;
    const read = await runAsBrand(brand, () => readMcpConsentRequest(search));
    if (!read.ok) return reply.send({ ok: false, error: read.error });
    const { client, redirectUri, requestedScopes, oauthQuery } = read.request;
    return reply.send({
      ok: true,
      request: { clientName: client.name, redirectUri, requestedScopes, oauthQuery },
    });
  });

  // The person's answer. The scopes granted are cut to what their role may
  // give, here, whatever the form sent: the screen is a request, not the rule.
  app.post('/auth/:brand/platform/mcp-consent', async (request, reply) => {
    const found = await signedIn(request, reply);
    if (!found) return reply;
    const body = ConsentAnswer.parse(request.body);
    const read = await runAsBrand(found.brand, () =>
      readMcpConsentRequest(new URLSearchParams(body.oauthQuery))
    );
    if (!read.ok) return reply.code(400).send({ error: read.error });
    let scope: string | undefined;
    if (body.accept) {
      scope = approvedScope(
        read.request.requestedScopes,
        body.scopes ?? [],
        found.session.user.role as StaffRole
      );
      if (!scope) return reply.code(400).send({ error: 'Choose at least one thing it can do.' });
    }
    try {
      const next = await runAsBrand(found.brand, () =>
        submitMcpConsent({
          oauthQuery: body.oauthQuery,
          accept: body.accept,
          scope,
          headers: requestHeaders(request),
        })
      );
      return reply.send({ next });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : '';
      return reply.code(502).send({
        error: message
          ? `This connection could not be completed: ${message}. Start again from your assistant.`
          : 'This connection could not be completed. Start again from your assistant.',
      });
    }
  });

  // The documents an assistant reads to find out how to connect. They describe
  // the brand's sign-in host, so they are built against its base URL.
  app.get('/auth/:brand/platform/mcp-discovery/:kind', async (request, reply) => {
    const brand = servedBrand(request)!;
    const { kind } = DiscoveryParams.parse(request.params);
    const document = await runAsBrand(brand, async () => {
      const path =
        kind === 'openid'
          ? '/.well-known/openid-configuration'
          : '/.well-known/oauth-authorization-server';
      const req = new Request(new URL(path, brandAuthHandler(brand).baseURL));
      return kind === 'openid'
        ? auth.api.getOpenIdConfig({ request: req })
        : auth.api.getOAuthServerConfig({ request: req });
    });
    reply.header('cache-control', 'public, max-age=3600');
    return reply.send(document);
  });

  return Promise.resolve();
};

export default platformFlowRoutes;
