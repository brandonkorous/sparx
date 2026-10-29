import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP, jwt, magicLink, oneTap, organization, twoFactor } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { socialProviderConfigured } from './social-providers';
import { passkey } from '@better-auth/passkey';
import { accountOrigin, mcpResourceUrl as brandMcpResourceUrl } from '@wizeworks/links/server';
import { currentPlatformBrand, platformBrandIdentity } from '@wizeworks/brand-core';
import { authPrisma } from './prisma';
import { brandScopedAuthPrisma } from './brand-scoped-prisma';
import { publishAuthEmail } from './email-events';
import { finalizeOAuthSignup, provisionTenantForOAuth } from './oauth-provisioning';
import { MCP_ALL_OAUTH_SCOPES } from './mcp-scopes';
import { authOwnedColumns } from './auth-owned-columns';
import { keepAccountsOnEmailProof } from './credential-retention';
import { legacyMcpEndpoints } from './legacy-mcp-endpoints';
import { ac, roles } from './org-roles';
import { redactingLogger } from './redacting-logger';
import { isPasswordStep } from './sign-in-step';
import { startingBusinessFor } from './starting-business';

/**
 * Which brand an organization belongs to.
 *
 * The organization id IS the tenant id (the tenant model is the Better Auth
 * organization), and `tenants` is the non-RLS dispatch row, so this reads on the
 * plain client with no tenant context — the same reason a Stripe webhook can
 * resolve a tenant before any context is set.
 *
 * Falls back to the column's own default, which is what every tenant
 * provisioned before the second brand existed carries. That is the safe
 * direction: it is the answer this code gave for its whole life.
 */
async function tenantPlatformBrandForOrg(organizationId: string): Promise<string> {
  const row = await authPrisma.tenant.findUnique({
    where: { id: organizationId },
    select: { platformBrand: true },
  });
  return row?.platformBrand ?? 'sparx';
}

// sparx Better Auth server instance. One per process — same caching strategy
// as @wizeworks/db's prisma client so dev HMR does not leak adapters.
//
// Schema dependencies (wizeworks/packages/db/prisma/schema.prisma):
//   - User has sparx extensions `tenantId` + `role` exposed via additionalFields
//   - Session / Account / Verification shapes match Better Auth's expectations
//
// The organization plugin (docs/16 §2, docs/114 Part A) is enabled below — the
// tenant IS the org, with `members`/`invitations` tables + `session.activeOrganizationId`
// (migration 20261002000000_organizations_and_teams). A user can belong to many
// orgs (team members + consultants); the active org drives the JWT `tid`/`role`,
// resolved in session.ts. `User.tenantId` remains the default (home) membership.

declare global {
  var __sparxAuth: ReturnType<typeof createAuth> | undefined;
}

function createAuth() {
  // Google OAuth is opt-in via env — the provider is only registered when both
  // creds are present, so the social button stays inert until the OAuth app +
  // Secret Manager values exist. Redirect URI in Google Console:
  // `${BETTER_AUTH_URL}/api/auth/callback/google`.
  // Asked through the shared capability query, not re-tested here — the screens
  // that draw a "Continue with Google" button ask the SAME function, so a
  // deployment can never register the provider and hide the button, or hide the
  // provider and offer one that cannot work (./social-providers).
  const googleReady = socialProviderConfigured('google');
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

  // The product name this auth instance presents as. It is NOT decoration:
  // `appName` feeds the passkey prompt ("Save a passkey for …"), which a Piggles
  // customer must not see saying "sparx".
  //
  // A PARAMETER, never a brand conditional — the deployment declares who it is
  // (piggles/CLAUDE.md RULE #0). Defaults to sparx, which is what every existing
  // deployment means.
  const appName = process.env.BETTER_AUTH_APP_NAME ?? 'sparx';

  const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';

  return betterAuth({
    appName,
    // Warn and up, emails masked: a failed sign-in logged the address (./redacting-logger).
    logger: redactingLogger,
    baseURL,
    // The jwt() plugin's own `/token` turns a browser session into a bearer JWT.
    // An OAuth provider must not offer that side door (the provider's
    // `/oauth2/token` is the only token endpoint), so it is switched off.
    disabledPaths: ['/token'],
    secret: process.env.BETTER_AUTH_SECRET,
    // The BRAND-SCOPED client, never the bare one. Both products mount this
    // instance against one `users` table, and every user lookup in the system —
    // core sign-in, magic link, email OTP, Google account-linking, the
    // organization plugin, OIDC/MCP — goes through this single adapter. Scoping
    // the client underneath it is what stops one brand's credential
    // authenticating on the other. See brand-scoped-prisma.ts.
    database: prismaAdapter(brandScopedAuthPrisma, { provider: 'postgresql' }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
      // ── A RESET ENDS EVERY OTHER SESSION ──────────────────────────────────
      //
      // This was UNSET, which better-auth reads as `false`, and the asymmetry is
      // what makes it a defect rather than a preference: the IN-CONSOLE password
      // change already passes `revokeOtherSessions` defaulted to TRUE (both
      // workbenches, `app/api/account/password/route.ts`). So the product had
      // decided what changing a password means — and the one path that exists
      // for "somebody else knows my password", the emailed reset, was the path
      // that left them signed in.
      //
      // The blast radius is the session window, and it is long: `expiresIn` is
      // 30 days below with `updateAge` of one day, so the row slides forward
      // every time it is used. A stolen session that keeps being used never
      // expires on its own, and the owner's one self-service remedy did nothing
      // to it. [[feedback_a_fix_leaves_its_neighbour_behind]]
      //
      // Nothing is lost by the person doing the reset: better-auth's
      // `/reset-password` mints no session, and this form sends them to
      // /sign-in either way.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Publish an `email.send` Pub/Sub event — email-worker pulls it,
        // renders via @wizeworks/email, and relays through the active provider.
        // No direct send here so signin/reset latency is decoupled from
        // Postal availability. See CLAUDE.md → "Outbound email".
        //
        // tenantId is added at runtime via `additionalFields` above but
        // Better Auth's User typing doesn't surface custom fields in the
        // callback signature; cast through unknown to read it.
        const extras = user as unknown as { tenantId?: string };
        await publishAuthEmail({
          tenantId: extras.tenantId ?? '',
          actorId: user.id,
          template: 'password-reset',
          to: user.email,
          props: {
            name: user.name ?? undefined,
            resetUrl: url,
            expiresInMinutes: 60,
          },
        });
      },
      // A password RESET completed — send the account owner a security confirmation
      // (fires on the reset-token flow; an in-session /change-password is separate and
      // has no better-auth callback). Non-blocking: it only enqueues an event.
      onPasswordReset: async ({ user }) => {
        const extras = user as unknown as { tenantId?: string };
        await publishAuthEmail({
          tenantId: extras.tenantId ?? '',
          actorId: user.id,
          template: 'password-changed',
          to: user.email,
          props: { name: user.name ?? undefined },
        });
      },
    },

    // Verify-but-don't-block (docs: auth pages redesign Slice 2). We keep
    // `requireEmailVerification: false` above so a fresh signup is auto-signed-in
    // and lands in onboarding immediately (the "live in 5 minutes" goal). The
    // verification email is still sent (triggered explicitly after signUpMerchant,
    // since our signup bypasses Better Auth's own signUpEmail), a notice with a
    // "Send the link again" button nudges at the top of each console (sparx
    // persona issue 157), and sensitive actions gate on `emailVerified`. Same platform
    // path as password-reset: publish `email.send`, email-worker renders + relays.
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const extras = user as unknown as { tenantId?: string };
        await publishAuthEmail({
          tenantId: extras.tenantId ?? '',
          actorId: user.id,
          template: 'email-verification',
          to: user.email,
          props: {
            name: user.name ?? undefined,
            verifyUrl: url,
            expiresInMinutes: 60,
          },
        });
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    user: {
      additionalFields: {
        tenantId: {
          type: 'string',
          required: true,
          input: false,
        },
        role: {
          type: 'string',
          required: false,
          defaultValue: 'editor',
          input: false,
        },
        // Which product this login belongs to. Declared here so the value is
        // SELECTED on reads — the session carries it, which is what lets an
        // invitation check that the person accepting belongs to the brand that
        // owns the tenant.
        //
        // `input: false` for the same reason as the two above: it is never
        // accepted from a client payload. It is not `required`, because the
        // guarantee lives one layer down — brand-scoped-prisma.ts stamps it on
        // every create, so a payload that omits it still lands correctly, and a
        // payload that could contradict it never reaches the database.
        platformBrand: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },

    ...(googleReady && googleId && googleSecret
      ? {
          socialProviders: {
            google: { clientId: googleId, clientSecret: googleSecret },
          },
        }
      : {}),

    account: {
      // Encrypt OAuth provider tokens (Google access/refresh/id) at rest via
      // symmetric AES with BETTER_AUTH_SECRET. Without this Better Auth stores
      // them PLAINTEXT in accounts.access_token/refresh_token/id_token — a DB
      // leak would hand an attacker live Google credentials for every linked
      // user. Backward-compatible: the read path (isLikelyEncrypted guard)
      // returns any pre-existing plaintext token verbatim, so already-linked
      // accounts keep working and only new writes are encrypted.
      encryptOAuthTokens: true,
      // Link a Google sign-in to an existing user when the verified email
      // matches — so an email/password user who later clicks "Continue with
      // Google" lands on their existing tenant instead of spawning a duplicate.
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    databaseHooks: {
      // Signing in by magic link or emailed code keeps a Google link but drops
      // a password set before the email was proven (./credential-retention).
      account: {
        delete: { before: keepAccountsOnEmailProof },
      },
      user: {
        create: {
          // OAuth signups: Better Auth creates the user itself, but
          // `User.tenantId` is required — mint a tenant here and inject the id.
          // (Our email/password path uses signUpMerchant directly and never
          // hits this hook; account-LINKING fires `account.create`, not
          // `user.create`, so this only runs for genuinely new social users.)
          before: async (user) => {
            const extras = user as unknown as { tenantId?: string };
            if (extras.tenantId) return;
            const email = (user as { email?: string }).email;
            if (!email) return;
            const name = (user as { name?: string | null }).name ?? null;
            const tenantId = await provisionTenantForOAuth({ email, name });
            return { data: { ...user, tenantId, role: 'owner' } };
          },
          after: async (user) => {
            const u = user as unknown as {
              id: string;
              tenantId?: string;
              email?: string;
              name?: string | null;
            };
            if (!u.tenantId || !u.email) return;
            await finalizeOAuthSignup({
              userId: u.id,
              tenantId: u.tenantId,
              email: u.email,
              name: u.name ?? null,
            });
          },
        },
        update: {
          // Two-step verification was turned on or off — send the owner a security
          // notice. `twoFactorEnabled` flips ONLY via internalAdapter.updateUser,
          // which the twoFactor plugin calls in exactly two places: the enable
          // COMPLETION (`/two-factor/verify-totp`, first success after enrolment,
          // when `verified` was still false) and `/two-factor/disable`. A 2FA
          // challenge at LOGIN re-runs verify-totp but never calls updateUser (the
          // row is already verified), so path-gating here is exact — there is no
          // login/enable ambiguity and no other user update reaches these paths.
          //
          // The db hook's `context` is better-auth's endpoint context (stored in
          // the request ALS), so `context.path` is the plugin-relative endpoint
          // path, and `updated` is the full user row. Best-effort + non-blocking:
          // a notification must never fail (and thus roll back) a settings change.
          after: async (updated, context) => {
            try {
              const path = (context as { path?: string } | null)?.path;
              const isDisable = path === '/two-factor/disable';
              // `/two-factor/enable` only updates the user when the server is set
              // to skip verification (ours is not) — listed for forward safety.
              const isEnable = path === '/two-factor/verify-totp' || path === '/two-factor/enable';
              if (!isDisable && !isEnable) return;
              const u = updated as unknown as {
                id: string;
                email?: string;
                name?: string | null;
                tenantId?: string;
              };
              if (!u.email) return;
              const base = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3001').replace(
                /\/$/,
                ''
              );
              await publishAuthEmail({
                tenantId: u.tenantId ?? '',
                actorId: u.id,
                template: 'two-factor-changed',
                to: u.email,
                props: {
                  enabled: !isDisable,
                  name: u.name ?? undefined,
                  secureUrl: `${base}/settings/security`,
                },
              });
            } catch {
              // swallow — never block a security-settings change on a notification
            }
          },
        },
      },
      session: {
        create: {
          // Which business the new session opens in. Someone who joined a team
          // and never set up a business of their own opens in that team, not in
          // the empty workspace sign-up made for them (starting-business.ts,
          // persona issue 124). Best-effort: a failed read opens at home, as
          // before, and never costs anyone their sign-in.
          before: async (session) => {
            const s = session as unknown as {
              userId: string;
              activeOrganizationId?: string | null;
            };
            if (s.activeOrganizationId) return;
            try {
              const organizationId = await startingBusinessFor(s.userId);
              if (organizationId) {
                return { data: { ...session, activeOrganizationId: organizationId } };
              }
            } catch {
              // Open at home.
            }
          },
          // Alert on a sign-in from a device we haven't seen for this user — "new
          // device" = the first session that carries this user agent. Best-effort +
          // non-blocking: a notification failure must never affect sign-in. `create`
          // fires on a genuine sign-in, NOT on the 5-min cookie refresh (that's
          // `session.update`), so this doesn't email on every request.
          after: async (session, context) => {
            const s = session as unknown as {
              id: string;
              userId: string;
              ipAddress?: string;
              userAgent?: string;
            };

            // ── WHEN THIS PERSON LAST SIGNED IN ─────────────────────────────
            //
            // `users.last_login_at` has existed since the very first migration
            // (20260527000000_init) and NOTHING has ever written it: 0 of 76 users
            // on the development database carry a value, four months in. Six
            // screens across three apps read it, and every one of them renders the
            // empty column as a statement — the console's teammate pane says "Has
            // not signed in yet", the staff console says "Never". The account owner
            // read that about herself while signed in (issue 853).
            //
            // This is the hook that already knows: `create` fires on a genuine
            // sign-in and NOT on the 5-minute cookie refresh, which is why the
            // new-device email below rides it rather than emailing every request.
            //
            // ── BUT A PASSWORD IS NOT A SIGN-IN WHEN 2FA IS ON ───────────────
            //
            // Measured by signing in as a real 2FA account and stopping at the
            // challenge: `session.create` fires at the PASSWORD step, the row does
            // not survive into the sessions table, and the challenge is still on
            // screen. Writing there would put a date under "Last signed in" for
            // somebody who had the password and never got past the second factor —
            // which is a worse sentence than the empty one this set out to fix.
            //
            // So the write is gated the way the two-factor notice four blocks up
            // gates itself, and for the same reason its comment calls exact: the
            // db hook's `context` is better-auth's endpoint context, so
            // `context.path` names the endpoint that created this session.
            //
            // It skips ONE case — the password endpoint for an account that has 2FA
            // switched on — and writes for everything else. That direction matters:
            // an endpoint nobody listed here still records a sign-in, so a new way
            // in (a social provider, a passkey, a magic link) is never silently
            // dropped, and the only thing an incomplete list can cost is the
            // precision of one timestamp. A deny-list that has to be exhaustive to
            // be safe is how a guard goes blind.
            // [[feedback_structural_checks_go_blind]]
            const path = (context as { path?: string } | null)?.path;
            const awaitingSecondFactor =
              isPasswordStep(path) &&
              (await authPrisma.user
                .findUnique({ where: { id: s.userId }, select: { twoFactorEnabled: true } })
                .then((u) => u?.twoFactorEnabled === true)
                .catch(() => false));

            // Best-effort, in its own try/catch, and FIRST — a failed stats write
            // must never cost somebody their sign-in, and it must not be able to
            // take the security email down with it either.
            if (!awaitingSecondFactor) {
              try {
                await authPrisma.user.update({
                  where: { id: s.userId },
                  data: { lastLoginAt: new Date() },
                });
              } catch {
                // swallow — never block a sign-in on a column nobody is waiting for.
                // The READER treats an empty column as "not known" rather than as
                // "never signed in", so a swallowed failure here cannot put the
                // false sentence back (issue 853).
              }
            }

            try {
              if (!s.userAgent) return; // no way to identify the device → skip
              const priorWithSameDevice = await authPrisma.session.count({
                where: { userId: s.userId, userAgent: s.userAgent, id: { not: s.id } },
              });
              if (priorWithSameDevice > 0) return; // known device
              const account = await authPrisma.user.findUnique({
                where: { id: s.userId },
                select: { email: true, name: true, tenantId: true },
              });
              if (!account?.email) return;
              // Empty string (nothing captured) → omit, not render blank.
              const ipAddress = s.ipAddress && s.ipAddress.length > 0 ? s.ipAddress : undefined;
              await publishAuthEmail({
                tenantId: account.tenantId ?? '',
                actorId: s.userId,
                template: 'new-device-signin',
                to: account.email,
                props: {
                  name: account.name ?? undefined,
                  ipAddress,
                  device: s.userAgent, // guaranteed non-empty by the guard above
                },
              });
            } catch {
              // swallow — never block sign-in on a notification
            }
          },
        },
      },
    },

    advanced: {
      database: { generateId: false },
      // The name of the session cookie — `<prefix>.session_token`, and
      // `__Secure-<prefix>.session_token` over HTTPS.
      //
      // A cookie name is USER-VISIBLE. It sits in devtools, in a browser's
      // storage panel, and on the cookie policy page a customer is entitled to
      // read — so a Piggles customer was being shown `better-auth`, which names
      // a library they have never heard of, right beside `sparx_active_property`,
      // which names a company they are not a customer of.
      //
      // A PARAMETER, never a brand conditional, exactly like `appName` above:
      // the deployment declares who it is. Defaulting to Better Auth's own
      // `better-auth` is what keeps every EXISTING session valid — the cookie
      // name is the session's address, so changing it signs everybody out, and
      // that is a thing to do deliberately to one brand rather than by accident
      // to both.
      cookiePrefix: process.env.BETTER_AUTH_COOKIE_PREFIX ?? 'better-auth',
      // Where the client address comes from — for the per-IP rate limit (the
      // brute-force guard on sign-in, and the MCP OAuth rules below) and for the
      // address each session records. Better Auth takes the FIRST value of the
      // first header it finds, and by default that header is X-Forwarded-For,
      // whose first value the client writes: an attacker could send a new
      // address with every password guess and never be limited.
      //
      // X-Client-IP is set by Caddy on every request to the visitor's address
      // as it resolves it (k8s/ingress/Caddyfile, `security_headers`), overwriting
      // anything the client sent. X-Forwarded-For stays as the fallback for the
      // one place that header is absent — a workstation without Caddy, where
      // nobody but the developer can reach the server.
      ipAddress: { ipAddressHeaders: ['x-client-ip', 'x-forwarded-for'] },
    },

    // Throttle the public MCP OAuth surface (docs/07 §5). DCR is unauthenticated
    // so registration is capped hard; authorize/consent/token are per-IP capped
    // to blunt brute force. Better Auth enables rate limiting in production by
    // default; these custom rules apply on top. (Memory storage = per-instance;
    // acceptable at the console's current replica count.)
    rateLimit: {
      customRules: {
        '/oauth2/register': { window: 60, max: 5 },
        '/oauth2/authorize': { window: 60, max: 30 },
        '/oauth2/consent': { window: 60, max: 30 },
        '/oauth2/token': { window: 60, max: 60 },
      },
    },

    plugins: [
      // Signs the MCP access tokens (EdDSA, keys in the `jwks` table). The issuer
      // is this console's ORIGIN, not Better Auth's default of origin + basePath:
      // api-mcp's protected-resource metadata names the origin as the
      // authorization server (mcpAuthServerOrigin), and an MCP client checks the
      // `issuer` in our metadata against exactly that string. The session `/token`
      // endpoint is disabled above and the per-response JWT header is off: this
      // plugin is here for the OAuth provider, nothing else.
      jwt({
        jwt: { issuer: new URL(baseURL).origin },
        disableSettingJwtHeader: true,
      }),
      // MCP OAuth authorization server (docs/07 §5), @better-auth/mcp on the
      // OAuth 2.1 provider. Hardened per OAuth 2.1 by the provider's defaults:
      // PKCE required for public clients, S256 only, hashed tokens and secrets.
      //
      //   • Anonymous Dynamic Client Registration is ON, because that is how
      //     Claude, ChatGPT and other connectors join: they register themselves
      //     with no account. Native clients with loopback callbacks register too
      //     (`infer`), without loosening web redirect rules.
      //   • Login and consent are the SAME page, /oauth/consent. Without a session
      //     it sends the person to sign in and back; with one it shows the
      //     role-capped scope picker and posts to /oauth2/consent. The provider
      //     never mints a code for a client the person has not approved, so the
      //     1.6 `sparx_grant` guard is gone with the plugin it patched.
      //   • The brand's MCP server is the one resource, declared with its scopes
      //     (Prisma cannot store a resource without them) and re-merged at every
      //     boot so a scope added to the catalog reaches the stored row.
      mcp({
        loginPage: '/oauth/consent',
        consentPage: '/oauth/consent',
        resource: mcpResourceUrl(),
        resources: [
          {
            identifier: mcpResourceUrl(),
            name: `${appName} MCP server`,
            allowedScopes: [...MCP_ALL_OAUTH_SCOPES],
          },
        ],
        resourceSeedMode: 'merge',
        scopes: [...MCP_ALL_OAUTH_SCOPES],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultApplicationType: 'infer',
        accessTokenExpiresIn: 60 * 60, // 1h
        refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d (offline_access)
        // Also how long the signed consent link stays valid, and somebody may
        // have to sign in first: 10 minutes, the OAuth ceiling for a code.
        codeExpiresIn: 10 * 60,
      }),
      // The 1.6 `/mcp/*` endpoints, redirected to their 1.7 addresses.
      legacyMcpEndpoints(),
      // Organizations & Teams (docs/114 Part A). The tenant IS the organization,
      // so the plugin's `organization` model maps onto the `tenant` Prisma model
      // (its `logo`/`metadata` fields → tenants.org_logo/org_metadata); `member`,
      // `invitation`, and `session.activeOrganizationId` already match the plugin's
      // default field names (members/invitations tables + the sessions column).
      //
      // We own the tenant lifecycle (signUpMerchant / OAuth provisioning) and mint
      // the owner `member` there, so the plugin NEVER creates or deletes an org —
      // it manages memberships, invitations, and the active-org on the session
      // (setActiveOrganization, which correctly refreshes the 5-min cookie cache).
      organization({
        schema: {
          organization: {
            modelName: 'tenant',
            fields: { logo: 'orgLogo', metadata: 'orgMetadata' },
          },
        },
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
        creatorRole: 'owner',
        membershipLimit: 1000,
        invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
        // Team invitations ride the email bus (docs/114 §A.4): publish an
        // `email.send` event with the `team-invitation` template — email-worker
        // renders + relays it, so invite latency never couples to Postal. Better
        // Auth does not generate the accept URL; we point it at our own
        // /accept-invite page carrying the invitation id.
        async sendInvitationEmail(data) {
          // The organization id IS the tenant id, so the brand is one read away —
          // and it has to be read, because this link is the invitee's whole
          // introduction to the product. Sent against the wrong brand it lands
          // them on another company's sign-in page.
          //
          // `accountOrigin`, not `appOrigin`: an invitee is not signed in yet, so
          // the page has to offer sign-in and sign-up, which live wherever the
          // brand's auth does. The old fallback here was `localhost:3001` — the
          // removed dashboard's port — so every locally-minted invitation pointed
          // at nothing at all.
          const brand = await tenantPlatformBrandForOrg(data.organization.id);
          const acceptUrl = `${accountOrigin(brand)}/accept-invite?invitation=${encodeURIComponent(data.id)}`;
          const inviterName = data.inviter.user.name?.trim() || data.inviter.user.email;
          await publishAuthEmail({
            tenantId: data.organization.id,
            actorId: data.inviter.user.id,
            template: 'team-invitation',
            to: data.email,
            props: {
              inviteeEmail: data.email,
              orgName: data.organization.name,
              inviterName,
              role: data.role,
              acceptUrl,
              expiresInDays: 7,
            },
          });
        },
        ac,
        roles,
      }),
      // Passwordless — a one-time signed link, emailed. Same email bus as
      // password-reset (publish `email.send`, email-worker renders + relays), so
      // link latency never couples to the mail provider. The link lands on
      // /api/auth's verify endpoint, which sets the session and redirects to the
      // client-supplied callbackURL. A first-time email provisions a tenant via
      // the same user.create hook as OAuth.
      magicLink({
        expiresIn: 60 * 15, // 15 minutes
        // Hash the link token before it lands in verifications.value. The token
        // IS a bearer credential — anyone who reads it can complete sign-in — so
        // storing it plaintext (the plugin default) means a DB leak = account
        // takeover. Hashed (one-way) is right here: we only ever compare the
        // presented token, never reveal it.
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          await publishAuthEmail({
            tenantId: '',
            actorId: null,
            template: 'magic-link',
            to: email,
            props: { magicUrl: url, expiresInMinutes: 15 },
          });
        },
      }),
      // Passwordless — a 6-digit code, emailed. Covers sign-in and verifying a new
      // address. The user is waiting on the code, but it still rides the event bus
      // (delivered within a second in practice) so there is one send path, not two.
      emailOTP({
        otpLength: 6,
        expiresIn: 60 * 5, // 5 minutes
        // Hash the code before it lands in verifications.value. The plugin
        // default stores it PLAINTEXT — a DB read would expose every live
        // sign-in code. Hashed (one-way) suffices because we only compare the
        // presented code, never display it back.
        storeOTP: 'hashed',
        sendVerificationOTP: async ({ email, otp }) => {
          await publishAuthEmail({
            tenantId: '',
            actorId: null,
            template: 'login-otp',
            to: email,
            props: { code: otp, expiresInMinutes: 5 },
          });
        },
      }),
      // Google One Tap — the streamlined prompt, not just the button. Only when
      // Google is configured (same env gate as the social provider); the server
      // verifies the Google credential against that same OAuth client.
      ...(googleReady && googleId ? [oneTap({ clientId: googleId })] : []),
      // WebAuthn passkeys (docs/16 §3.5) — phishing-resistant, the strongest
      // factor we offer. rpName is our display name; rpID + expected origin
      // auto-derive from BETTER_AUTH_URL's hostname and the request Origin, so
      // this follows whatever host the app is deployed on (override rpID via
      // PASSKEY_RP_ID only if the auth URL host ever diverges from the app
      // host). The private key never leaves the authenticator; the passkeys
      // table stores only the PUBLIC key + credential id (nothing secret).
      passkey({
        // Shown verbatim in the OS/browser passkey dialog, so it follows the
        // deployment's brand rather than being hardcoded.
        rpName: appName,
        ...(process.env.PASSKEY_RP_ID ? { rpID: process.env.PASSKEY_RP_ID } : {}),
      }),
      // Authenticator-app two-step verification (docs/16 §2.4). The second
      // factor a person can set up on any phone with any authenticator app —
      // the complement to passkeys, which are stronger but need a device that
      // supports them. Sign-in with a password now answers `twoFactorRedirect`
      // instead of a session when this is on; the challenge is completed at
      // /two-factor/verify-totp (or verify-backup-code) before a session
      // exists at all.
      //
      // Three settings here are load-bearing:
      //   • storeBackupCodes: 'encrypted' — the plugin default is PLAIN, which
      //     would leave ten working account-recovery credentials per user
      //     readable in the database. Encrypted (not hashed) because the owner
      //     can re-display their unused codes; a one-way hash forecloses that.
      //   • skipVerificationOnEnable stays FALSE (the default, stated for the
      //     record) — enabling requires typing a code the app actually
      //     generated, so a mis-scanned QR can never lock someone out of their
      //     own business.
      //   • allowPasswordless: true — a Google / magic-link / passkey operator
      //     has no password to re-enter, and without this they could not turn
      //     two-step verification on at all. Password is still demanded from
      //     anyone who HAS one, so this loosens nothing for password accounts.
      twoFactor({
        // The name a person sees in their authenticator app, and it was the
        // literal `'sparx'` — so a Piggles owner turning on two-step
        // verification ended up with another product's name in Google
        // Authenticator forever, since the issuer is baked into the QR at
        // enrollment and cannot be corrected afterwards.
        //
        // The brand this PROCESS serves — each brand's account app is its own
        // deployment mounting its own handler, so that is already the right
        // answer wherever an enrollment actually starts.
        // `/two-factor/enable` also accepts a per-enrollment `issuer` in its
        // body, which is what a console on a different origin sends; neither
        // path needs shared code to branch on brand.
        issuer: platformBrandIdentity(currentPlatformBrand()).name,
        allowPasswordless: true,
        skipVerificationOnEnable: false,
        totpOptions: { digits: 6, period: 30 },
        backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' },
      }),
      // jwks.platformBrand + tenant.email, which sparx fills in itself. Without
      // them Better Auth's schema check refuses every request (./auth-owned-columns).
      authOwnedColumns(),
      // nextCookies() must stay LAST so it can flush Set-Cookie for the
      // plugins registered before it.
      nextCookies(),
    ],
  });
}

/**
 * Canonical resource identifier for the MCP server this process authorizes for
 * (the audience its OAuth tokens are for).
 *
 * Per BRAND, and `currentPlatformBrand()` is the right way to ask for the same
 * reason the 2FA issuer above uses it: each brand's authorization server is its
 * own deployment mounting its own Better Auth handler, so the brand is a
 * property of the process, not of the request. Read as one platform-wide value
 * this named mcp.sparx.works for both brands — the address a Piggles token
 * would have claimed to be for.
 */
function mcpResourceUrl(): string {
  return brandMcpResourceUrl(currentPlatformBrand());
}

// Construct the Better Auth server lazily, on first property access — NOT at
// module-evaluation time. Importing `@wizeworks/auth` for a utility (e.g.
// `isModuleEnabled` from ./module-gate) pulls this module in via the barrel;
// eager construction would call betterAuth() — which throws in production when
// BETTER_AUTH_SECRET is unset — and crash workers that never touch auth at all
// (e.g. commerce-indexer reaches here through @wizeworks/commerce → @wizeworks/crm).
// The Proxy is transparent: every `auth.api.*` / `auth.handler` / `auth.$context`
// access resolves against the same cached instance, so consumers are unchanged.
let cachedAuth: ReturnType<typeof createAuth> | undefined = globalThis.__sparxAuth;

function getAuth(): ReturnType<typeof createAuth> {
  if (cachedAuth) return cachedAuth;
  cachedAuth = createAuth();
  // Survive dev HMR without leaking adapters (mirrors @wizeworks/db's prisma client).
  if (process.env.NODE_ENV !== 'production') globalThis.__sparxAuth = cachedAuth;
  return cachedAuth;
}

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get: (_target, prop) => (getAuth() as Record<string | symbol, unknown>)[prop],
  has: (_target, prop) => prop in (getAuth() as object),
});

export type Auth = ReturnType<typeof createAuth>;
