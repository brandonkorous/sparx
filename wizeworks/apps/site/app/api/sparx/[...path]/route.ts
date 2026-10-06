// Same-origin proxy to api-rest for browser-side calls (cart, checkout,
// account). The storefront's client code calls `/api/sparx/...`; this handler
// forwards to api-rest server-side, relaying the request body, query string,
// the cart-ownership header, and cookies in both directions.
//
// Why a proxy instead of calling api-rest directly from the browser:
//   • api-rest has no CORS — a cross-origin browser fetch would be blocked.
//   • The customer session is an httpOnly cookie. Routing through the
//     storefront's own origin makes it first-party, so it's set and sent
//     without SameSite=None gymnastics across tenant custom domains.

import { type NextRequest, NextResponse } from 'next/server';

import {
  isGatewayStatus,
  RETRY_AFTER_SECONDS,
  unreachableEnvelope,
} from '../../../../lib/shop-reach';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// Request headers we forward upstream (hop-by-hop + host headers are dropped).
// x-forwarded-for / x-real-ip carry the real client IP (set by Caddy) through to
// api-rest, whose `trustProxy` reads it — so per-IP rate limits (e.g. the public
// forms endpoint, docs/115) bucket by visitor, not by this proxy pod's IP.
//
// user-agent is forwarded for the SAME reason the IP is: session attribution
// (docs/128) recomputes the visitor hash — sha(salt:day:tenant:ip:UA) — in the
// checkout-complete handler and matches it against the pageview beacon's hash.
// The beacon hits api-rest directly (real browser UA); without forwarding the UA
// here, checkout would recompute against this proxy's fetch UA and never match,
// silently zeroing attribution. It is also the honest UA for api-rest's bot drop.
const FORWARD_REQUEST_HEADERS = [
  'content-type',
  'x-cart-token',
  'authorization',
  'cookie',
  'x-forwarded-for',
  'x-real-ip',
  'user-agent',
];

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
  // Read as raw bytes, NOT text: a binary body (a form-attachment PDF/image PUT,
  // docs/115 Part D) decoded as UTF-8 and re-encoded would be corrupted. An
  // ArrayBuffer round-trips both JSON and binary faithfully.
  const body = hasBody ? await request.arrayBuffer() : undefined;

  // api-rest restarting, mid rolling deploy, or briefly unreachable makes this
  // fetch THROW. Left uncaught, Next answered a bare 500 with no body, and the
  // site read that as "nobody is signed in" and sent a trade buyer with a valid
  // session to the sign-in page (sparx persona issue 086). The request never got
  // an answer, so the proxy says exactly that: 503, try again, in the envelope
  // every client already reads.
  let upstream: Response;
  let payload: ArrayBuffer;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      ...(body && body.byteLength > 0 ? { body } : {}),
      redirect: 'manual',
      cache: 'no-store',
    });
    payload = await upstream.arrayBuffer();
  } catch (err) {
    console.warn(
      `[api/sparx] could not reach api-rest for ${method} /${path.join('/')}: ${(err as Error).message}`
    );
    return unreachable();
  }

  // A load balancer or ingress in front of api-rest answers its own HTML error
  // page when nothing behind it is up. That is the same "no answer", so it gets
  // the same reply. api-rest's OWN 503 is JSON and carries its own words, so it
  // is relayed as written.
  const contentType = upstream.headers.get('content-type');
  if (isGatewayStatus(upstream.status) && !contentType?.includes('json')) {
    console.warn(
      `[api/sparx] api-rest gateway answered ${upstream.status} for ${method} /${path.join('/')}`
    );
    return unreachable();
  }

  // Relay the response, preserving Set-Cookie so login/cart cookies reach the
  // browser as first-party cookies on the storefront origin.
  const resHeaders = new Headers();
  if (contentType) resHeaders.set('content-type', contentType);
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) resHeaders.set('set-cookie', setCookie);

  return new NextResponse(payload, { status: upstream.status, headers: resHeaders });
}

/** "Could not reach the shop, try again": 503 with the shared envelope, whose
 *  `SHOP_UNREACHABLE` code is how a client tells a blip from a real refusal. */
function unreachable(): NextResponse {
  return NextResponse.json(unreachableEnvelope(), {
    status: 503,
    headers: {
      'retry-after': String(RETRY_AFTER_SECONDS),
      'cache-control': 'no-store',
    },
  });
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
