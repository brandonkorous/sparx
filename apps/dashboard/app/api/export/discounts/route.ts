import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api-rest-client';

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString();
  const path = `/v1/export/discounts${search ? `?${search}` : ''}`;
  const upstream = await api.getRaw(path);

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  const ct = upstream.headers.get('content-type');
  const cd = upstream.headers.get('content-disposition');
  if (ct) headers.set('content-type', ct);
  if (cd) headers.set('content-disposition', cd);

  return new NextResponse(body, { status: upstream.status, headers });
}
