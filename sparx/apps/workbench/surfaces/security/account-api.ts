// Talking to the console's own account routes (app/api/account/*).
//
// These replace the shared Better Auth CLIENT for everything on the Security
// surface. Unlike the Piggles console, this origin DOES mount a Better Auth
// handler, so the client would work -- the reasons for going through our own
// routes anyway are set out in app/api/account/shared.ts, and the short version
// is that one of them (which device you are on) cannot be answered in the
// browser without shipping the session token to JS, and that a Security surface
// which speaks a different transport in each console is the drift
// check:console-parity exists to catch.
//
// The server's own message is preferred over the caller's fallback wherever it
// sent one: it separates a wrong current password from a new one that is too
// short, which is the most specific true thing available.

import { productName } from '../../lib/product';

interface ErrorBody {
  error?: string | null;
}

async function send<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/account/${path}`, { credentials: 'same-origin', ...init });
  } catch {
    // A genuinely unreachable server -- offline, or the console restarting.
    // This is the one case where "could not reach" is the true sentence.
    throw new Error(`Could not reach ${productName()}. Check your connection and try again.`);
  }

  const payload = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) throw new Error(payload?.error ?? fallback);
  return payload as T;
}

export function accountGet<T>(path: string, fallback: string): Promise<T> {
  return send<T>(path, { method: 'GET' }, fallback);
}

export function accountPost<T>(path: string, body: unknown, fallback: string): Promise<T> {
  return send<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    fallback
  );
}
