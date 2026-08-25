import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@wizeworks/auth';

// Internal, service-to-service password reset for a staff account.
//
// Better Auth lives in THIS process, and an auth instance can only see the
// logins of its own product — so a reset for somebody with an account here has
// to be performed here. The operator console runs on api-rest, which has no
// Better Auth of its own, so it POSTs to this route with the shared internal
// secret and lets us do it.
//
// This route exists because the operator console used to send every reset to one
// hardcoded app. A person with an account here was mailed a link into a product
// they are not a customer of — and once logins were split by brand it stopped
// even finding them, while still reporting success, because an unknown address
// is a deliberate silent no-op and looks identical to asking the wrong instance.
//
// Fail-closed: no secret configured → 401. Reachable in-cluster only, never from
// a browser. We never reveal whether an address has an account, so a clean run
// always answers { sent: true }.

export const dynamic = 'force-dynamic';

const TOKEN_HEADER = 'x-sparx-internal-provision-token';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** The caller must hold the shared internal secret. Returns the refusal to send
 *  back, or null when the request may proceed. */
function refuseUnauthorized(request: Request): NextResponse | null {
  const expected = process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!expected) {
    return NextResponse.json(
      { code: 'DISABLED', message: 'Internal secret is not configured.' },
      { status: 401 }
    );
  }
  const provided = request.headers.get(TOKEN_HEADER);
  if (!provided || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid token.' }, { status: 401 });
  }
  return null;
}

async function readEmail(request: Request): Promise<string | NextResponse> {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'Invalid JSON.' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json(
      { code: 'INVALID_INPUT', message: 'An email is required.' },
      { status: 400 }
    );
  }
  return email;
}

export async function POST(request: Request): Promise<Response> {
  const refusal = refuseUnauthorized(request);
  if (refusal) return refusal;

  const email = await readEmail(request);
  if (typeof email !== 'string') return email;

  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
    return NextResponse.json({ sent: true });
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        severity: 'ERROR',
        source: 'account.user-password-reset',
        message: 'requestPasswordReset failed',
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      }) + '\n'
    );
    return NextResponse.json(
      { code: 'RESET_FAILED', message: 'Could not send the reset email.' },
      { status: 500 }
    );
  }
}
