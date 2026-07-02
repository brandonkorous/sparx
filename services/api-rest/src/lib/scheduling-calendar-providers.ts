// Provider REST calls for Layer-3 calendar sync (docs/79 §8.3) — Google Calendar
// API + Microsoft Graph. These hit FIXED provider hosts (googleapis.com /
// graph.microsoft.com), so unlike the iCal/CalDAV paths there is no user-supplied
// URL and no SSRF surface; the access token (Bearer) is the only secret on the wire.
//
// Busy import re-fetches the whole window each sync (push only signals "something
// changed") and the pure parsers (@sparx/scheduling) turn the provider JSON into
// the engine's Interval[] — so the existing availability merge blocks sparx slots.
// Pagination loops are capped so a runaway feed can't spin forever.

import { randomUUID } from 'node:crypto';
import {
  googleItemsFrom,
  googleNextPageTokenFrom,
  microsoftNextLinkFrom,
  microsoftValueFrom,
  parseGoogleBusy,
  parseMicrosoftBusy,
  type BusyWindow,
  type Interval,
} from '@sparx/scheduling';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_PAGES = 20;
const GCAL = 'https://www.googleapis.com/calendar/v3';
const GRAPH = 'https://graph.microsoft.com/v1.0';

interface AuthedInit {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

async function authedJson(
  url: string,
  accessToken: string,
  init: AuthedInit = {}
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      body: init.body,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const json: unknown = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) {
      // 410 GONE (Google) / 404 (Graph subscription) are signalled to the caller.
      const o = (json ?? {}) as { error?: { message?: string } | string };
      const msg =
        typeof o.error === 'object'
          ? o.error?.message
          : typeof o.error === 'string'
            ? o.error
            : undefined;
      const err = new Error(`Calendar API ${res.status}: ${msg ?? res.statusText}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ── Google Calendar ──────────────────────────────────────────────────────────

/** Pull a Google calendar's busy intervals over the window (paged, full-window). */
export async function fetchGoogleBusy(
  accessToken: string,
  calendarId: string,
  window: BusyWindow
): Promise<Interval[]> {
  const cal = encodeURIComponent(calendarId || 'primary');
  const base = new URLSearchParams({
    timeMin: new Date(window.windowStart).toISOString(),
    timeMax: new Date(window.windowEnd).toISOString(),
    singleEvents: 'true',
    showDeleted: 'false',
    maxResults: '2500',
  });
  const out: Interval[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams(base);
    if (pageToken) params.set('pageToken', pageToken);
    const json = await authedJson(
      `${GCAL}/calendars/${cal}/events?${params.toString()}`,
      accessToken
    );
    out.push(...parseGoogleBusy(googleItemsFrom(json), window));
    pageToken = googleNextPageTokenFrom(json);
    if (!pageToken) break;
  }
  return out;
}

/** Idempotently import (create-or-update by iCalUID) a sparx booking as a Google
 *  event — the outbound push that beats the feed's 12–24h cache lag. */
export async function importGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: Record<string, unknown>
): Promise<void> {
  const cal = encodeURIComponent(calendarId || 'primary');
  await authedJson(`${GCAL}/calendars/${cal}/events/import`, accessToken, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export interface WatchChannel {
  channelId: string;
  resourceId: string | null;
  expiresAtMs: number | null;
}

/** Register a Google watch-channel so changes push to our webhook. `address` must
 *  be an HTTPS host verified in Search Console (docs/79 §8.5). `token` is echoed on
 *  every push (our signed {tenant,connection}). */
export async function registerGoogleWatch(
  accessToken: string,
  calendarId: string,
  address: string,
  token: string
): Promise<WatchChannel> {
  const cal = encodeURIComponent(calendarId || 'primary');
  const channelId = randomUUID();
  const json = (await authedJson(`${GCAL}/calendars/${cal}/events/watch`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ id: channelId, type: 'web_hook', address, token }),
  })) as { resourceId?: string; expiration?: string };
  const exp = json.expiration ? Number(json.expiration) : NaN;
  return {
    channelId,
    resourceId: json.resourceId ?? null,
    expiresAtMs: Number.isFinite(exp) ? exp : null,
  };
}

/** Stop a Google watch-channel (best-effort on disconnect). */
export async function stopGoogleChannel(
  accessToken: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  await authedJson(`${GCAL}/channels/stop`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ id: channelId, resourceId }),
  });
}

// ── Microsoft Graph ──────────────────────────────────────────────────────────

/** Pull the signed-in user's busy intervals over the window (paged calendarView,
 *  UTC-normalized via the Prefer header). */
export async function fetchMicrosoftBusy(
  accessToken: string,
  window: BusyWindow
): Promise<Interval[]> {
  const params = new URLSearchParams({
    startDateTime: new Date(window.windowStart).toISOString(),
    endDateTime: new Date(window.windowEnd).toISOString(),
    $select: 'subject,start,end,showAs,isCancelled',
    $top: '200',
  });
  let url: string | null = `${GRAPH}/me/calendarView?${params.toString()}`;
  const headers = { Prefer: 'outlook.timezone="UTC"' };
  const out: Interval[] = [];
  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const json = await authedJson(url, accessToken, { headers });
    out.push(...parseMicrosoftBusy(microsoftValueFrom(json), window));
    url = microsoftNextLinkFrom(json);
  }
  return out;
}

export interface GraphSubscription {
  subscriptionId: string;
  expiresAtMs: number | null;
}

/** Create a Graph change-notification subscription on the user's events. Microsoft
 *  validates by POSTing a `validationToken` to `notificationUrl` (the webhook echoes
 *  it). `clientState` is our signed {tenant,connection}, returned on every notice. */
export async function createMicrosoftSubscription(
  accessToken: string,
  notificationUrl: string,
  clientState: string,
  expiresAtMs: number
): Promise<GraphSubscription> {
  const json = (await authedJson(`${GRAPH}/subscriptions`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      changeType: 'created,updated,deleted',
      notificationUrl,
      resource: 'me/events',
      expirationDateTime: new Date(expiresAtMs).toISOString(),
      clientState,
    }),
  })) as { id?: string; expirationDateTime?: string };
  const exp = json.expirationDateTime ? Date.parse(json.expirationDateTime) : NaN;
  return {
    subscriptionId: json.id ?? '',
    expiresAtMs: Number.isFinite(exp) ? exp : expiresAtMs,
  };
}

/** Extend a Graph subscription before it expires (Graph caps calendar subs at ~3d). */
export async function renewMicrosoftSubscription(
  accessToken: string,
  subscriptionId: string,
  expiresAtMs: number
): Promise<number> {
  const json = (await authedJson(
    `${GRAPH}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ expirationDateTime: new Date(expiresAtMs).toISOString() }),
    }
  )) as { expirationDateTime?: string };
  const exp = json.expirationDateTime ? Date.parse(json.expirationDateTime) : NaN;
  return Number.isFinite(exp) ? exp : expiresAtMs;
}

export async function deleteMicrosoftSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  await authedJson(`${GRAPH}/subscriptions/${encodeURIComponent(subscriptionId)}`, accessToken, {
    method: 'DELETE',
  });
}
