import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getSession } from '@wizeworks/auth';

// The caller's own account security, answered on this origin.
//
// ── WHY THESE ROUTES EXIST HERE, WHERE THE AUTH CLIENT ALREADY WORKS ────────
//
// The Piggles console has no choice about this: it mounts no Better Auth handler
// (getpiggles.com is the auth authority), so the shared auth CLIENT -- which
// addresses /api/auth/* on whatever origin it is running on -- fell through to
// the catch-all page route and answered every Security call with a 143KB HTML
// document and a 200. See piggles/apps/workbench/app/api/account/shared.ts.
//
// The workbench DOES mount that handler (app/api/auth/[...all]/route.ts), so
// nothing here is load-bearing in the same way. Two things still argue for it:
//
//   • ONE OF THESE ANSWERS SOMETHING THE BROWSER CANNOT WORK OUT. Which device
//     row is the one you are sitting at is decided by the signed session cookie,
//     which is httpOnly. The surface used to get at it by asking the auth client
//     for its own session and comparing tokens -- which means shipping the live
//     session token into JS to draw a "This device" badge. ./sessions marks the
//     row server-side instead, and the token stays where it belongs.
//
//   • THE TWO CONSOLES ARE ONE CONSOLE UNDER TWO BRANDS. A Security surface that
//     speaks a different transport in each is exactly the drift check:console-
//     parity exists to catch, and it is how a fix lands in one console and not
//     the other. The surface calls the same paths in both; only the reason they
//     are unavoidable differs.
//
// ── AND WHY THIS IS NOT "MOUNTING AUTH TWICE" ───────────────────────────────
//
// Not one verb behind these routes can create a session. Every one REQUIRES a
// session and acts inside it, on the caller's own account: list the devices you
// are signed in on, end one of them, change your own password knowing the old
// one, enrol your own authenticator app. There is no sign-in, no sign-up, no
// callback, no credential minted -- all of that stays at /api/auth.
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
 * sends a 307 to /sign-in, which fetch follows to an HTML page -- so a signed-out
 * tab would report a parse failure instead of saying it had been signed out.
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
