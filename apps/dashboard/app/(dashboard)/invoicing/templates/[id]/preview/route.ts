// Template preview proxy — the api-rest `…/preview` route renders the template's
// DRAFT tree to print-HTML against sample data (or a real document via
// `?documentId=`), and requires the dashboard's internal signed JWT. This route
// handler fetches it server-side and streams the HTML back for a new-tab preview
// (docs/87 §10).

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params;
  const documentId = new URL(request.url).searchParams.get('documentId');
  const path = documentId
    ? `/v1/invoicing/templates/${id}/preview?documentId=${encodeURIComponent(documentId)}`
    : `/v1/invoicing/templates/${id}/preview`;

  const res = await api.getRaw(path);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/html; charset=utf-8',
    },
  });
}
