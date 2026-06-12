// Print proxy — the api-rest `…/pdf` route requires the dashboard's internal
// signed JWT (the browser can't call api-rest directly), so this server route
// handler fetches the branded print-HTML server-side and streams it back. Opened
// in a new tab from the document editor; the browser's Print → PDF takes it from
// there (docs/87 §10). `?snapshotId=` prints a frozen record instead of the live
// document.

import { api } from '@/lib/api-rest-client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await ctx.params;
  const snapshotId = new URL(request.url).searchParams.get('snapshotId');
  const path = snapshotId
    ? `/v1/invoicing/documents/${id}/snapshots/${snapshotId}/pdf`
    : `/v1/invoicing/documents/${id}/pdf`;

  const res = await api.getRaw(path);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/html; charset=utf-8',
    },
  });
}
