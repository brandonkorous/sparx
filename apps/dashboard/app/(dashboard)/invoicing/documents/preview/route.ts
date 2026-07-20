// Live-preview proxy — same reason as the `[id]/print` route: the api-rest
// `…/documents/preview` endpoint requires the dashboard's internal signed JWT, so
// the browser can't call it directly. This server route forwards the editor's
// unsaved draft and streams the branded print-HTML back for an <iframe srcDoc>.
//
// POST because the body is the whole in-progress document. Nothing is written —
// the endpoint upstream is read-only and never touches the database.

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const draft: unknown = await request.json().catch(() => ({}));
  const res = await api.postRaw('/v1/invoicing/documents/preview', draft);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/html; charset=utf-8',
      // Re-fetched on every edit; caching it would show a stale document.
      'cache-control': 'no-store',
    },
  });
}
