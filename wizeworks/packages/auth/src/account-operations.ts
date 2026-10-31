// What a signed-in person can do to their OWN account, as one table.
//
// These ran as route handlers in each console (`app/api/account/*`,
// `app/api/businesses`), byte-identical between the two brands. They run in
// api-rest now (`/auth/<brand>/account/<op>`), so the consoles hold no auth
// instance. The table is the allowlist: an operation exists because a row
// here names it, never because a handler exposed a surface wholesale.
//
// Not one operation can create a session. Each REQUIRES one and acts inside
// it, on the caller's own account.
//
// Called inside the request's brand scope (`runAsBrand`), so `auth` is that
// brand's instance.

import { auth } from './server';
import { listMyMemberships } from './organizations';

/** What an operation answers: an HTTP status and a JSON body. */
export interface AccountOperationResult {
  status: number;
  body: unknown;
}

type Body = Record<string, unknown>;
type Run = (headers: Headers, body: Body) => Promise<unknown>;

const SIGNED_OUT = 'You have been signed out. Sign in again to change your security settings.';

/** A request the caller got wrong, answered with its own status and message. */
class OperationRefused extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: { message: string }
  ) {
    super(body.message);
  }
}

/** A password field that is absent, empty, or not a string means "this account
 *  has none", which the two-factor plugin allows. Never invent one. */
function optionalPassword(body: Body): { password?: string } {
  const value = body.password;
  return typeof value === 'string' && value !== '' ? { password: value } : {};
}

function text(body: Body, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

async function sessionToken(headers: Headers): Promise<string | null> {
  const current = await auth.api.getSession({ headers });
  return (current as { session?: { token?: string } } | null)?.session?.token ?? null;
}

/** The person's own businesses, in the shape the console's switcher reads. */
export interface AccountBusiness {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/** The two facts the Security surface needs to draw its forms. */
export interface SignInMethods {
  hasPassword: boolean;
  twoFactorEnabled: boolean;
}

const OPERATIONS: Record<string, Run> = {
  'POST password': (headers, body) =>
    auth.api.changePassword({
      body: {
        currentPassword: text(body, 'currentPassword'),
        newPassword: text(body, 'newPassword'),
        revokeOtherSessions: body.revokeOtherSessions !== false,
      },
      headers,
    }),

  'GET sessions': async (headers) => {
    const [rows, token] = await Promise.all([
      auth.api.listSessions({ headers }),
      sessionToken(headers),
    ]);
    return (rows ?? []).map((row) => ({ ...row, current: row.token === token }));
  },

  'POST sessions': (headers, body) => {
    if (body.all === true) return auth.api.revokeOtherSessions({ headers });
    const token = body.token;
    if (typeof token !== 'string' || token === '') {
      return Promise.reject(new OperationRefused(400, { message: 'A device token is required.' }));
    }
    return auth.api.revokeSession({ body: { token }, headers });
  },

  'GET sign-in-methods': async (headers): Promise<SignInMethods> => {
    const [rows, session] = await Promise.all([
      auth.api.listUserAccounts({ headers }),
      auth.api.getSession({ headers }),
    ]);
    const user = (session as { user?: { twoFactorEnabled?: boolean } } | null)?.user;
    return {
      hasPassword: (rows ?? []).some((row) => row.providerId === 'credential'),
      twoFactorEnabled: user?.twoFactorEnabled === true,
    };
  },

  'POST two-factor': (headers, body) => {
    // The issuer the authenticator app shows. A console on another origin sends
    // its brand's name, since it is baked into the QR code at enrollment.
    const issuer = text(body, 'issuer');
    return auth.api.enableTwoFactor({
      body: { method: 'totp' as const, ...optionalPassword(body), ...(issuer ? { issuer } : {}) },
      headers,
    });
  },

  'POST two-factor/verify': (headers, body) =>
    auth.api.verifyTOTP({ body: { code: text(body, 'code') }, headers }),

  'POST two-factor/disable': (headers, body) =>
    auth.api.disableTwoFactor({ body: optionalPassword(body), headers }),

  'POST two-factor/backup-codes': (headers, body) =>
    auth.api.generateBackupCodes({ body: optionalPassword(body), headers }),

  'GET businesses': async (headers): Promise<AccountBusiness[]> => {
    const session = await auth.api.getSession({ headers });
    const userId = session?.user.id;
    if (!userId) return [];
    const memberships = await listMyMemberships(userId);
    return memberships.map((m) => ({
      id: m.organizationId,
      name: m.name,
      slug: m.slug,
      role: m.role,
    }));
  },

  'POST businesses': async (headers, body) => {
    const organizationId = text(body, 'organizationId');
    if (!organizationId) {
      throw new OperationRefused(400, { message: 'organizationId is required' });
    }
    try {
      await auth.api.setActiveOrganization({ body: { organizationId }, headers });
    } catch {
      // Not a member, or the membership was removed: the same answer either way.
      throw new OperationRefused(403, { message: 'not a member of that business' });
    }
    return { ok: true };
  },
};

/** Whether `method path` names an operation. */
export function isAccountOperation(method: string, path: string): boolean {
  return `${method.toUpperCase()} ${path}` in OPERATIONS;
}

/** Better Auth throws rather than returning an error, and its message is the
 *  most specific true thing available: it separates a wrong current password
 *  from a new one that is too short. Surface it rather than a generic line. */
function describe(error: unknown): AccountOperationResult {
  const candidate = error as { statusCode?: unknown; body?: { message?: unknown } } | null;
  const status = typeof candidate?.statusCode === 'number' ? candidate.statusCode : 500;
  const message = typeof candidate?.body?.message === 'string' ? candidate.body.message : '';
  return { status, body: { error: message || null } };
}

/**
 * Run one operation as the person these headers sign in.
 *
 * No session answers 401 with a sentence the console shows as-is. An unknown
 * operation answers 404.
 */
export async function runAccountOperation(
  method: string,
  path: string,
  headers: Headers,
  body: Body
): Promise<AccountOperationResult> {
  const run = OPERATIONS[`${method.toUpperCase()} ${path}`];
  if (!run) return { status: 404, body: { error: 'not_found' } };
  if (!(await auth.api.getSession({ headers }))) {
    return { status: 401, body: { error: SIGNED_OUT } };
  }
  try {
    const value = await run(headers, body);
    return { status: 200, body: value ?? { ok: true } };
  } catch (error) {
    return describe(error);
  }
}
