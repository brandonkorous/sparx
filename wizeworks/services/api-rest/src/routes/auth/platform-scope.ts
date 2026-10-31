// What every `/auth/<brand>/*` route shares: which brand the path names, the
// request's headers as a fetch `Headers`, its JSON body, and the session it
// carries.
//
// The routes that live beside the auth handler under `/platform` answer an app
// SERVER, never a browser (the apps' public proxy refuses that segment), and
// act as the person whose session cookie the server forwarded. The business
// they act on is always the session's, never one named in the request.

import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registeredAuthBrands, resolveSession, type SparxSession } from '@wizeworks/auth';
import { normalizeBrandKey } from '@wizeworks/brand-core';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';

/** Never forwarded either way: they describe one connection, not the message. */
export const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'host',
]);

export function requestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else if (typeof value === 'string') headers.set(key, value);
  }
  return headers;
}

/** A parsed JSON body as a plain record; anything else reads as empty. */
export function jsonBody(request: FastifyRequest): Record<string, unknown> {
  const body = request.body;
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** The brand in the path, if this process serves it. */
export function servedBrand(request: FastifyRequest): string | null {
  const raw = (request.params as { brand?: string }).brand;
  if (!raw) return null;
  const brand = normalizeBrandKey(raw);
  return registeredAuthBrands().includes(brand) ? brand : null;
}

/** The brand, and the session the forwarded cookie carries; null when there is
 *  none. The brand is known to be served: the plugin's hook refused it first. */
export async function platformSession(
  request: FastifyRequest
): Promise<{ brand: string; session: SparxSession } | null> {
  const brand = servedBrand(request)!;
  const session = await runAsBrand(brand, () => resolveSession(requestHeaders(request)));
  return session ? { brand, session } : null;
}

// How a new business found the platform: the denormalized source and the
// first and last attribution snapshots, kept whole for a later recompute
// (docs/80 §8.3). Sign-up sends it, and so does the first page after a Google
// sign-up, which loses it on the provider's redirect.
const Text = (max: number) => z.string().max(max).nullable();
const Snapshot = z.object({
  source: Text(255),
  medium: Text(255),
  campaign: Text(255),
  term: Text(255),
  content: Text(255),
  channel: z.string().max(50),
  referrer: Text(2048),
  landingPath: Text(2048),
  clickIds: z.record(z.string(), z.string().max(512)),
  capturedAt: z.string().max(40),
});
export const AcquisitionBody = z.object({
  channel: Text(50),
  source: Text(255),
  campaign: Text(255),
  firstTouch: Snapshot.nullable(),
  lastTouch: Snapshot.nullable(),
});
