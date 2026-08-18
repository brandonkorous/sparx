// Same-origin proxy to api-rest for browser-side marketplace calls (cart +
// checkout). The client cart/checkout helpers call `/api/sparx/...`; this handler
// forwards to api-rest server-side, relaying the request body, query string, and
// the cart-ownership header in both directions.
//
// Why a proxy instead of calling api-rest directly from the browser: api-rest
// has no CORS, so a cross-origin browser fetch would be blocked. Routing through
// the marketplace's own origin keeps it first-party. Mirrors wizeworks/apps/site's proxy;
// sparx.market is a single host (no per-tenant cookie), but the same transport
// shape keeps the client helpers identical.

import { type NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// Request headers we forward upstream (hop-by-hop + host headers are dropped).
const FORWARD_REQUEST_HEADERS = ['content-type', 'x-cart-token', 'authorization', 'cookie'];

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  const search = request.nextUrl.search;
  const target = `${API_BASE}/${path.map(encodeURIComponent).join('/')}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;

  const upstream = await fetch(target, {
    method,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
    cache: 'no-store',
  });

  const resHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) resHeaders.set('content-type', contentType);
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) resHeaders.set('set-cookie', setCookie);

  const payload = await upstream.arrayBuffer();
  return new NextResponse(payload, { status: upstream.status, headers: resHeaders });
}

interface Ctx {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
