// The header notice — what Piggles is announcing above every page right now.
//
// Authored by WizeWorks staff in the admin console, stored in
// `platform_announcements`, served by api-rest. It is here rather than in a
// layout because all three Piggles surfaces ask the same question and must get
// the same answer: a notice that ran on the marketing site but not on the
// sign-up screen is a promise made and then not repeated at the moment somebody
// acts on it.
//
// SERVER ONLY. Every caller is a server component in a layout, which is what
// keeps this a single cached fetch per render rather than a request from every
// visitor's browser.

/** A notice, as the public endpoint returns it. Deliberately NOT the operator's
 *  shape: the window, the switch and the audit fields are how a notice is
 *  MANAGED, and none of them mean anything once it is on screen. */
export interface HeaderNotice {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
  /** A silica color name — the bar resolves its own ink from it. */
  tone: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  dismissible: boolean;
}

export type NoticeSurface = 'marketing' | 'account' | 'console';

/**
 * Where api-rest is, from inside a Piggles pod.
 *
 * Same posture as `originOf` in product.ts, and for the same reason: a laptop
 * that configures nothing must talk to the laptop. There is no production
 * fallback host here, though — api-rest is reached in-cluster by service name,
 * which is not something this package can guess. If the variable is missing in
 * production the fetch below fails and the page renders with no bar, which is
 * the correct failure: a marketing site must not go down because an
 * announcement service did.
 */
function apiOrigin(): string {
  const configured = process.env.PIGGLES_API_REST_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3100';
}

/**
 * The one notice for this surface, or null.
 *
 * NEVER THROWS. A layout calls this, so an exception here would take out every
 * page of the site — and the thing it failed to fetch is a banner. Any failure
 * (unreachable, slow, malformed) resolves to "nothing to announce", which is
 * also the answer nine days out of ten.
 *
 * Cached for a minute at the framework layer, matching the endpoint's own
 * `cache-control`. Switching a notice off in the console is therefore felt while
 * the operator is still looking at the screen, without a marketing page under
 * load asking the database on every render.
 */
export async function fetchHeaderNotice(surface: NoticeSurface): Promise<HeaderNotice | null> {
  try {
    const url = `${apiOrigin()}/v1/public/announcements?brand=piggles&surface=${surface}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const announcement = (body as { data?: { announcement?: HeaderNotice | null } })?.data
      ?.announcement;
    return announcement ?? null;
  } catch {
    return null;
  }
}
