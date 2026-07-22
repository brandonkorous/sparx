import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { auth } from '@sparx/auth';

// Internal, service-to-service password reset for a staff user. Better Auth lives
// in this workbench process (app/api/auth/[...all]), so api-rest — which runs the
// operator console's user actions — cannot trigger a reset itself. It POSTs here
// instead, authenticated with the shared internal secret (SPARX_INTERNAL_JWT_SECRET,
// already shared workbench↔api-rest), and we call auth.api.requestPasswordReset —
// which publishes the `password-reset` email via the sendResetPassword callback
// (packages/auth/src/server.ts), exactly as the self-service forgot-password flow.
//
// Fail-closed: no secret configured → 401. Only reachable in-cluster (ClusterIP),
// never from a browser. We never reveal whether the email exists — a reset request
// for an unknown email is a silent no-op (Better Auth's own behavior), and we
// always return { sent: true } on a clean run.
export const dynamic = 'force-dynamic';

const TOKEN_HEADER = 'x-sparx-internal-provision-token';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

interface ResetBody {
  email?: unknown;
}

export async function POST(request: Request): Promise<Response> {
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

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
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

  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
    return NextResponse.json({ sent: true });
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        severity: 'ERROR',
        source: 'workbench.user-password-reset',
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
