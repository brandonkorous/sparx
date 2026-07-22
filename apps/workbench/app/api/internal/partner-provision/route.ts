import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { provisionInvitedOwner, SignUpError } from '@sparx/auth';

// Internal, service-to-service provisioning of an operator-approved partner's
// account (docs/114 §B.2). Better Auth lives in this workbench process
// (app/api/auth/[...all]), so api-rest — which runs the operator approval —
// cannot mint the tenant + owner login itself. It POSTs here instead,
// authenticated with the shared internal secret (SPARX_INTERNAL_JWT_SECRET,
// already shared workbench↔api-rest), and we run the Better Auth provisioning +
// set-password invite.
//
// Fail-closed: no secret configured → 401 (a forgotten secret must never silently
// allow provisioning). Only reachable in-cluster (ClusterIP), never from a browser.
export const dynamic = 'force-dynamic';

const TOKEN_HEADER = 'x-sparx-internal-provision-token';

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

interface ProvisionBody {
  email?: unknown;
  name?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.SPARX_INTERNAL_JWT_SECRET;
  if (!expected) {
    return NextResponse.json(
      { code: 'DISABLED', message: 'Internal provisioning secret is not configured.' },
      { status: 401 }
    );
  }
  const provided = request.headers.get(TOKEN_HEADER);
  if (!provided || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid token.' }, { status: 401 });
  }

  let body: ProvisionBody;
  try {
    body = (await request.json()) as ProvisionBody;
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: 'Invalid JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const name = typeof body.name === 'string' ? body.name : '';
  if (!email) {
    return NextResponse.json(
      { code: 'INVALID_INPUT', message: 'An email is required.' },
      { status: 400 }
    );
  }

  try {
    const result = await provisionInvitedOwner({ email, name });
    return NextResponse.json({
      tenantId: result.tenantId,
      userId: result.userId,
      slug: result.slug,
    });
  } catch (err) {
    if (err instanceof SignUpError) {
      // EMAIL_TAKEN → 409 so the caller can surface "already has an account";
      // other SignUpErrors (INVALID_INPUT / SLUG_TAKEN) → 400/409 respectively.
      const status = err.code === 'EMAIL_TAKEN' ? 409 : err.code === 'SLUG_TAKEN' ? 409 : 400;
      return NextResponse.json({ code: err.code, message: err.message }, { status });
    }
    process.stderr.write(
      JSON.stringify({
        severity: 'ERROR',
        source: 'workbench.partner-provision',
        message: 'provisionInvitedOwner failed',
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
      }) + '\n'
    );
    return NextResponse.json(
      { code: 'PROVISION_FAILED', message: 'Could not provision the account.' },
      { status: 500 }
    );
  }
}
