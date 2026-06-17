// Print proxy — the api-rest `…/document` route requires the dashboard's internal
// signed JWT (the browser can't call api-rest directly), so this server route
// handler fetches the branded PO print-HTML server-side and streams it back.
// Opened in a new tab from the PO detail; the browser's Print → PDF takes it from
// there (docs/100 P3b, mirrors invoicing's print proxy).

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params;
  const res = await api.getRaw(`/v1/inventory/purchase-orders/${id}/document`);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/html; charset=utf-8',
    },
  });
}
