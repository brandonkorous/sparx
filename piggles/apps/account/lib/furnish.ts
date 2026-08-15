import 'server-only';

// Handing a finished signup to the platform to be FURNISHED.
//
// Onboarding owns the questions and the naming. It does not own switching the
// apps on, stamping the trade's setup, or filling the account with something to
// look at — that is one platform operation with a load-bearing internal order,
// and it lives in api-rest (POST /internal/tenant/furnish).
//
// ── WHY NOT DO IT HERE, WHICH IS WHAT THIS APP USED TO DO ───────────────────
//
// It used to publish `module.activated` straight to the broker from this app,
// on the reasoning that it was "the same event on the same bus". It is not the
// same bus. `module.activated` travels on TWO, reaching two different process
// spaces: the Pub/Sub topic (the automation-worker, elsewhere) and api-rest's
// IN-PROCESS platform bus — and the in-process one carries every subscriber that
// matters here. The CRM's pipeline, segments and SLA policies. Commerce's tax,
// shipping and site-commerce defaults. Scheduling's defaults. The default
// transactional emails. Finance's accounts. The saved-view presets. Invoicing's
// config.
//
// Publishing to the broker alone set the flags, put a message on a topic, and
// seeded NONE of it — with nothing anywhere reporting a failure, because nothing
// failed. Every Piggles business created this way arrived with fifteen apps
// switched on and no pipeline in any of them — the exact outcome the old
// lib/activate-modules.ts was written to prevent, reached by the mechanism it
// chose. Only a process with those consumers registered can announce on both
// buses, so the announcing belongs there and this app asks for it. That file is
// gone; do not bring back a local publish in its place.
//
// The blast radius of the secret is why it is its own: this call writes module
// flags, config presets, a site template and hundreds of rows into ONE named
// tenant.

const FURNISH_PATH = '/internal/tenant/furnish';
const FURNISH_TOKEN_HEADER = 'X-sparx-Internal-Furnish-Token';

/** How long to wait. Furnishing is a real body of work — module baselines, the
 *  trade's presets, a site template, hundreds of sample rows — and the person is
 *  watching a "Setting things up" button while it runs. Long enough to finish on
 *  a cold process, short enough that a hung dependency does not strand somebody
 *  mid-signup with no way forward. */
const FURNISH_TIMEOUT_MS = 120_000;

export interface FurnishRequest {
  tenantId: string;
  /** The trade — both the starter slug and the sample-pack key. Null when the
   *  person did not pick one, which the platform reads as "use the generic set"
   *  rather than guessing a vertical for them. */
  industry: string | null;
}

/**
 * Ask api-rest to furnish the tenant. Resolves when it is genuinely done.
 *
 * Throws on anything other than success, and the caller is expected to SHOW that
 * rather than swallow it. A business that lands in an empty workspace is the
 * failure this whole path exists to prevent, so failing visibly — with a retry
 * that is safe, because every step of furnishing is idempotent — beats redirecting
 * somebody into the exact state we were trying to avoid.
 */
export async function furnishTenant({ tenantId, industry }: FurnishRequest): Promise<void> {
  const base = process.env.PIGGLES_API_REST_URL;
  const token = process.env.SPARX_INTERNAL_FURNISH_TOKEN;

  if (!base || !token) {
    throw new Error(
      'Cannot furnish: PIGGLES_API_REST_URL and SPARX_INTERNAL_FURNISH_TOKEN must both be set.'
    );
  }

  const response = await fetch(`${base.replace(/\/$/, '')}${FURNISH_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [FURNISH_TOKEN_HEADER]: token,
    },
    body: JSON.stringify({
      tenantId,
      industry,
      // `modules` is deliberately omitted, which the platform reads as EVERY
      // module. Piggles is one flat price with every app included (RULE #2), so
      // there is no subset to send — and sending the ticked rail groups here is
      // precisely how an unticked app becomes a 404 on a screen that promised
      // otherwise.
      //
      // `blueprintKey` is omitted too: which of the platform's site templates a
      // given trade should get is an unmade product decision, and picking one
      // here would be inventing it. Until it is made the site stays as signup
      // left it rather than wearing a template nobody chose.
      billPerModule: false,
    }),
    signal: AbortSignal.timeout(FURNISH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Furnish failed: ${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 500)}` : ''}`
    );
  }
}
