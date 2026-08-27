import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSession } from '@wizeworks/auth';

// The caller's own account security, answered on this origin.
//
// ── WHY THESE ROUTES HAVE TO EXIST ──────────────────────────────────────────
//
// Same reason as ../businesses/route.ts, and found the same way. The shared auth
// CLIENT talks to /api/auth/* on whatever origin it is running on. The console
// mounts no Better Auth handler and never will -- getpiggles.com is the auth
// authority, and a second thing on a second domain that can mint sessions is
// exactly what the three-domain split exists to prevent.
//
// So every call the Security surface made -- the device list, changing a
// password, all four steps of turning two-step verification on -- fell through
// to the catch-all page route and came back as a 143KB HTML document with a 200.
// Better Auth's client could not parse it and reported the only thing it could:
// a problem reaching the sign-in service. The service was never reached at all.
//
// ── AND WHY THIS IS NOT "MOUNTING AUTH ANYWAY" ──────────────────────────────
//
// Not one verb behind these routes can create a session. Every one REQUIRES a
// session and acts inside it, on the caller's own account: list the devices you
// are signed in on, end one of them, change your own password knowing the old
// one, enrol your own authenticator app. There is no sign-in, no sign-up, no
// callback, no credential minted. The authority to say WHO YOU ARE stays on
// getpiggles; this only lets you look after the account you are already in.
//
// The allowlist is the file tree: an operation exists here because somebody
// added a route for it, never because a handler exposed a surface wholesale.

export const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

const SIGNED_OUT = 'You have been signed out. Sign in again to change your security settings.';

/** Better Auth throws rather than returning an error, and its message is the
 *  most specific true thing available -- it separates a wrong current password
 *  from a new one that is too short. Surface it rather than a generic line. */
function describe(error: unknown): { status: number; message: string } {
  const candidate = error as { statusCode?: unknown; body?: { message?: unknown } } | null;
  const status = typeof candidate?.statusCode === 'number' ? candidate.statusCode : 500;
  const message = typeof candidate?.body?.message === 'string' ? candidate.body.message : '';
  return { status, message };
}

/**
 * Run one account operation as the caller and answer as JSON.
 *
 * A missing session answers 401 rather than redirecting: `requireSession()`
 * sends a 307 to /sign-in, which fetch follows to an HTML page -- reproducing
 * the exact failure these routes exist to end.
 */
export async function relay(run: (h: Headers) => Promise<unknown>): Promise<NextResponse> {
  if (!(await getSession())) {
    return NextResponse.json({ error: SIGNED_OUT }, { status: 401, headers: NO_STORE });
  }
  try {
    const value = await run(await headers());
    return NextResponse.json(value ?? { ok: true }, { headers: NO_STORE });
  } catch (error) {
    const { status, message } = describe(error);
    return NextResponse.json({ error: message || null }, { status, headers: NO_STORE });
  }
}

/** Parse a JSON body without throwing on an empty or malformed one. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const payload: unknown = await request.json().catch(() => null);
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

/** A password field that is absent, empty, or not a string means "this account
 *  has none" -- which the server plugin allows. Never invent one. */
export function optionalPassword(body: Record<string, unknown>): { password?: string } {
  const value = body.password;
  return typeof value === 'string' && value !== '' ? { password: value } : {};
}
