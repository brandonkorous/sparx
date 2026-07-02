// Customer-auth service — the surface api-rest's public account routes call.
// Each function runs inside `tenantStore.run(tenantId, …)` so the tenant-scoping
// adapter (tenant-adapter.ts) scopes every Better Auth op to that tenant, then
// delegates to `auth.api.*`. Better Auth owns identity / credential / session /
// reset; the per-site membership (docs/58) is resolved separately via
// ensureMembership. See docs/27 v2.

import { tenantStore } from '@sparx/db';
import { z } from 'zod';

import { getCustomerAuth } from './server';
import { CustomerAuthError } from './errors';

export interface CustomerAuthContext {
  tenantId: string;
}

/** Optional request metadata forwarded to Better Auth (recorded on the session
 *  for audit/security). */
export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthOutcome {
  /** The Better Auth customer user id (the tenant-wide identity). */
  userId: string;
  email: string;
  name: string;
  /** Set-Cookie header value(s) Better Auth emitted — the route relays them. */
  setCookies: string[];
  /** True when the USER already existed before this call. Combined with a freshly
   *  created membership it yields the docs/58 D6 `recognized` signal. */
  userPreexisted: boolean;
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

// ─── input validation (normalises email before Better Auth sees it) ─────────

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(200);

const RegisterInput = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
});
const LoginInput = z.object({ email: emailSchema, password: z.string().min(1).max(200) });
const ForgotInput = z.object({ email: emailSchema });
const ResetInput = z.object({ token: z.string().min(1).max(512), password: passwordSchema });

// ─── helpers ────────────────────────────────────────────────────────────────

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new CustomerAuthError(
      'INVALID_INPUT',
      result.error.issues[0]?.message ?? 'Invalid input.'
    );
  }
  return result.data;
}

/** Better Auth requires a non-null name; fall back to the email local-part. */
function displayName(input: { firstName?: string; lastName?: string; email: string }): string {
  const full = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  if (full.length > 0) return full;
  const local = input.email.split('@')[0];
  return local && local.length > 0 ? local : input.email;
}

function metaHeaders(meta: SessionMeta): Headers {
  const h = new Headers();
  if (meta.ipAddress) h.set('x-forwarded-for', meta.ipAddress);
  if (meta.userAgent) h.set('user-agent', meta.userAgent);
  return h;
}

/** Extract Set-Cookie(s) from a Better Auth `asResponse` Response. */
function getSetCookies(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

interface AuthUserBody {
  user?: { id?: string; email?: string; name?: string | null };
}
interface AuthErrorBody {
  code?: string;
  message?: string;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function outcomeFromBody(
  body: AuthUserBody | null,
  res: Response,
  userPreexisted: boolean
): AuthOutcome {
  const user = body?.user;
  if (!user?.id || !user.email) {
    throw new CustomerAuthError('INVALID_INPUT', 'Authentication response was malformed.');
  }
  return {
    userId: user.id,
    email: user.email,
    name: user.name ?? user.email,
    setCookies: getSetCookies(res),
    userPreexisted,
  };
}

function isEmailExists(status: number, body: AuthErrorBody | null): boolean {
  if (body?.code === 'USER_ALREADY_EXISTS') return true;
  return status === 422 && /exist/i.test(body?.message ?? '');
}

// ─── sign in ─────────────────────────────────────────────────────────────────

/** Authenticate email + password. Returns null on any credential failure (the
 *  route surfaces one generic message). */
export function signInCustomer(
  ctx: CustomerAuthContext,
  rawInput: unknown,
  meta: SessionMeta = {}
): Promise<AuthOutcome | null> {
  const input = parse(LoginInput, rawInput);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    const res = await auth.api.signInEmail({
      body: { email: input.email, password: input.password },
      headers: metaHeaders(meta),
      asResponse: true,
    });
    if (!res.ok) return null;
    return outcomeFromBody(await readJson<AuthUserBody>(res), res, true);
  });
}

// ─── sign up ─────────────────────────────────────────────────────────────────

/**
 * Create a site account. On a fresh email, creates the user + credential +
 * session (userPreexisted: false). If the email already has a login (same tenant
 * or a sister site), falls back to sign-in with the supplied password to prove
 * ownership (userPreexisted: true) — the route's ensureMembership then decides
 * docs/58 D6 recognition. Wrong password on an existing email → EMAIL_TAKEN.
 */
export function signUpCustomer(
  ctx: CustomerAuthContext,
  rawInput: unknown,
  meta: SessionMeta = {}
): Promise<AuthOutcome> {
  const input = parse(RegisterInput, rawInput);
  const name = displayName(input);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    const res = await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name },
      headers: metaHeaders(meta),
      asResponse: true,
    });
    if (res.ok) return outcomeFromBody(await readJson<AuthUserBody>(res), res, false);

    const err = await readJson<AuthErrorBody>(res);
    if (isEmailExists(res.status, err)) {
      const signIn = await signInCustomer(
        ctx,
        { email: input.email, password: input.password },
        meta
      );
      if (!signIn) {
        throw new CustomerAuthError('EMAIL_TAKEN', 'An account with that email already exists.');
      }
      return { ...signIn, userPreexisted: true };
    }
    throw new CustomerAuthError('INVALID_INPUT', err?.message ?? 'Could not create the account.');
  });
}

// ─── session ─────────────────────────────────────────────────────────────────

/** Resolve the session cookie to its Better Auth user, or null. `cookieHeader`
 *  is the raw request Cookie header (name=value; …). RLS scopes the lookup, so a
 *  token from another tenant resolves to null — and the session is additionally
 *  bound to its tenant in-app (below), so isolation does not rest on RLS alone. */
export function getCustomerSession(
  ctx: CustomerAuthContext,
  cookieHeader: string | undefined
): Promise<SessionUser | null> {
  if (!cookieHeader) return Promise.resolve(null);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    const headers = new Headers();
    headers.set('cookie', cookieHeader);
    const res = await auth.api.getSession({ headers });
    if (!res) return null;
    const user = res.user;
    if (!user?.id || !user.email) return null;
    // Defense-in-depth beyond RLS (docs/27 §3): the resolved session MUST belong
    // to the request's tenant. RLS already scopes the DB lookup; this app-layer
    // assertion independently rejects any session returned via a path that skipped
    // the scoped query (the cookieCache-leak class). Fail-closed on mismatch/absent.
    const sessionTenantId = (res.session as { tenantId?: unknown }).tenantId;
    if (sessionTenantId !== ctx.tenantId) return null;
    return { userId: user.id, email: user.email, name: user.name ?? user.email };
  });
}

/** Revoke the session for the cookie. Returns the clear-cookie Set-Cookie(s) the
 *  route relays. Idempotent. */
export function signOutCustomer(
  ctx: CustomerAuthContext,
  cookieHeader: string | undefined
): Promise<string[]> {
  if (!cookieHeader) return Promise.resolve([]);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    const headers = new Headers();
    headers.set('cookie', cookieHeader);
    const res = await auth.api.signOut({ headers, asResponse: true });
    return getSetCookies(res);
  });
}

// ─── password reset ───────────────────────────────────────────────────────────

/** Begin a password reset. Enumeration-safe: Better Auth returns success
 *  regardless, and only sends the email (server.ts sendResetPassword) when the
 *  account exists. */
export function sendCustomerPasswordReset(
  ctx: CustomerAuthContext,
  rawInput: unknown
): Promise<void> {
  const input = parse(ForgotInput, rawInput);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    await auth.api.requestPasswordReset({
      body: { email: input.email, redirectTo: '/account/reset' },
    });
  });
}

/** Consume a reset token and set a new password. Returns false on an invalid /
 *  expired / used token. */
export function resetCustomerPassword(
  ctx: CustomerAuthContext,
  rawInput: unknown
): Promise<boolean> {
  const input = parse(ResetInput, rawInput);
  return tenantStore.run(ctx.tenantId, async () => {
    const auth = getCustomerAuth();
    const res = await auth.api.resetPassword({
      body: { newPassword: input.password, token: input.token },
      asResponse: true,
    });
    return res.ok;
  });
}
