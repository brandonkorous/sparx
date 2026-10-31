// The consent route takes only a real answer, and leaves the write to api-rest.
//
// Where the answer is written (the person's HOME business, sparx persona issue
// 122) is api-rest's rule now, and tested there:
// wizeworks/services/api-rest/src/routes/auth/platform-business.test.ts. What
// stays here is the part that is this route's: a value that is not a boolean is
// a malformed request, never a "no", and a signed-out caller is told so.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted with the mock: `vi.mock` runs before this file's own top level.
const { platformRequest, PlatformRequestError } = vi.hoisted(() => {
  class PlatformRequestError extends Error {
    constructor(
      readonly path: string,
      readonly status: number | null,
      readonly body: Record<string, unknown> = {}
    ) {
      super(path);
    }
  }
  return { platformRequest: vi.fn(), PlatformRequestError };
});

vi.mock('@wizeworks/auth-client-server', () => ({ platformRequest, PlatformRequestError }));

const { POST } = await import('./route');

function answer(analytics: unknown): Request {
  return new Request('http://localhost:3011/api/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analytics }),
  });
}

describe('POST /api/consent', () => {
  beforeEach(() => {
    // In braces: a function returned from beforeEach is run as teardown, and
    // `mockReset()` returns the mock, which would then be called once more.
    platformRequest.mockReset();
  });

  it('sends a real answer to api-rest', async () => {
    platformRequest.mockResolvedValue({ consent: { analytics: false, at: '' } });

    const response = await POST(answer(false));

    expect(response.status).toBe(200);
    expect(platformRequest).toHaveBeenCalledWith(
      'consent',
      expect.objectContaining({ body: { analytics: false } })
    );
  });

  it('refuses a value that is not a boolean, and records nothing', async () => {
    const response = await POST(answer('no'));

    expect(response.status).toBe(400);
    expect(platformRequest).not.toHaveBeenCalled();
  });

  it('tells a signed-out caller so', async () => {
    platformRequest.mockRejectedValue(new PlatformRequestError('/platform/consent', 401));

    const response = await POST(answer(true));

    expect(response.status).toBe(401);
  });
});
