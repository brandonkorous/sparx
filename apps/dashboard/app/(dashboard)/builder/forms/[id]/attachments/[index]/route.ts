// Same-origin download for a form-submission attachment (docs/115 Part D). The
// bytes live in the PRIVATE media bucket and are streamed by api-rest's
// authenticated GET /v1/forms/submissions/:id/attachments/:index. This route
// handler proxies that call server-side (api.getRaw signs the staff session), so
// a plain browser link can download the file without exposing the api-rest token
// or the private storage key. Addressed by index — the key never reaches the client.

import { type NextRequest, NextResponse } from 'next/server';

import { api, type ApiRestError } from '@/lib/api-rest-client';

interface Ctx {
  params: Promise<{ id: string; index: string }>;
}

export async function GET(_request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id, index } = await ctx.params;
  // Guard the path params before they reach the upstream URL.
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{1,2}$/.test(index)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await api.getRaw(
      `/v1/forms/submissions/${encodeURIComponent(id)}/attachments/${encodeURIComponent(index)}`
    );
  } catch (err) {
    const status = (err as ApiRestError).status ?? 502;
    return NextResponse.json({ error: 'Download failed' }, { status });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Not found' }, { status: upstream.status || 404 });
  }

  // Relay the streamed bytes + the download headers api-rest set (content-type,
  // the `attachment` disposition, and length when known).
  const headers = new Headers();
  for (const name of ['content-type', 'content-disposition', 'content-length']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', 'private, no-store');
  return new NextResponse(upstream.body, { status: 200, headers });
}
