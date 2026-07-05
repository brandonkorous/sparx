import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureSeedOperator } from '@sparx/operator-auth';
import { INTERNAL_OPERATOR_TOKEN_HEADER } from '@sparx/operator';

// One-time, idempotent seed of operator #1 (docs/apps/admin/build-plan.md §2
// D10). Token-gated by the same internal secret as the api-rest seam and
// fail-closed (no token configured → 401), so it is safe to leave mounted:
// re-running only re-asserts capabilities, never resets a password. Hit it once
// after deploy (with OPERATOR_BOOTSTRAP_PASSWORD set) to provision
// brandon@wize.works.
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.SPARX_INTERNAL_OPERATOR_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { code: 'DISABLED', message: 'Operator token is not configured.' },
      { status: 401 }
    );
  }
  const provided = request.headers.get(INTERNAL_OPERATOR_TOKEN_HEADER);
  if (!provided || !constantTimeEqual(provided, expected)) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid token.' }, { status: 401 });
  }

  const result = await ensureSeedOperator();
  return NextResponse.json({ ok: true, result });
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
