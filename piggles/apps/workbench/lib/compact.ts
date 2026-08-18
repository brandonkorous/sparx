// Which presentation a window gets, decided BEFORE React runs.
//
// The viewport is a client fact, so the server has to be told rather than ask:
// from a cookie this browser's last load left behind, and on a first visit from
// the request's own mobile hints.

/** Written by the console on every load, read back by the server on the next. */
export const COMPACT_COOKIE = 'piggles_compact';

/**
 * 64rem is the line. Below it a dock is not cramped, it is pointless: two panes
 * at 500px show nothing useful, and the tab strip eats the height the work
 * needs. A tablet in portrait gets the stack, which is the right answer.
 */
export const COMPACT_QUERY = '(max-width: 63.999rem)';

interface CompactHint {
  /** `piggles_compact`, if this browser has been here before. */
  cookie: string | undefined;
  /** `Sec-CH-UA-Mobile` — Chromium states it outright. */
  chMobile: string | null;
  userAgent: string | null;
}

/**
 * The server's answer for `isCompact`, and what the client hydrates against.
 *
 * The cookie wins: it is this browser's OWN last measurement, so it covers the
 * narrow desktop window that no request header describes. The hints only ever
 * carry a first visit, where a wrong guess costs the one swap this exists to
 * remove everywhere else.
 */
export function guessCompact({ cookie, chMobile, userAgent }: CompactHint): boolean {
  if (cookie === '1') return true;
  if (cookie === '0') return false;
  if (chMobile === '?1') return true;
  if (chMobile === '?0') return false;
  return /Android|iPhone|iPod|IEMobile|Opera Mini|Mobile Safari/i.test(userAgent ?? '');
}
