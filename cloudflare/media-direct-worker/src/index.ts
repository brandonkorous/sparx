/**
 * media-direct — a Cloudflare Worker that guarantees a `200 OK` with a complete
 * body for social-platform image fetchers.
 *
 * ## The problem it replaces
 *
 * Instagram, Threads and Pinterest publish an image by handing THEIR servers an
 * `image_url` to go and fetch. Those fetchers send `Range: bytes=0-` and then
 * REJECT the `206 Partial Content` that Cloudflare answers with for a cacheable
 * object (observed on both HIT and MISS). The image silently drops and the post
 * publishes text-only — no error anywhere in our stack, because as far as
 * api-rest is concerned it served the bytes.
 *
 * On GKE this was solved with `media-direct.sparx.works` as a grey-cloud
 * (DNS-only) hostname, so those fetchers bypassed Cloudflare entirely and landed
 * on the origin, which ignores `Range` and returns a clean 200.
 *
 * That trick is GONE behind a Cloudflare Tunnel: the tunnel only carries proxied
 * hostnames, so there is no non-proxied path to the origin any more. There is no
 * public IP to point a grey-cloud record at.
 *
 * ## What this does instead
 *
 * Rather than routing AROUND the edge, it fixes the behaviour AT the edge.
 * Workers run ahead of the cache lookup, so stripping `Range` here means
 * nothing downstream — cache or origin — ever sees a range to satisfy, and a
 * 206 cannot be produced in the first place.
 *
 * Bind it to `media-direct.sparx.works/*`, keep that hostname pointed at the
 * same tunnel as `media.sparx.works`, and `MEDIA_DIRECT_BASE_URL` in
 * social-worker keeps working unchanged.
 *
 * ## Deliberately NOT done here
 *
 * No `cacheTtl` / `cacheEverything` override. api-rest owns cache semantics
 * per-path — `immutable` on finished variant bytes, but a deliberate 60s while
 * an image is still transcoding. Pinning a TTL here would re-create the exact
 * bug called out in k8s/caddy/Caddyfile: a mid-transcode original cached for a
 * year, and 404s cached at the edge so a variant that was not ready on first
 * fetch stayed permanently broken. Origin `Cache-Control` governs; we only
 * remove the range semantics.
 *
 * Error statuses are passed through untouched. Forcing a 200 onto a 404 would
 * hand the platform an HTML error body as an "image" — a broken post that looks
 * successful is worse than one that fails loudly.
 */

export interface Env {
  /**
   * Optional. When set, the subrequest is re-pointed at this hostname instead
   * of the incoming one — useful if media-direct is ever fronted separately
   * from the origin that actually serves the bytes. Unset (the normal case)
   * means "same URL, minus the range headers".
   */
  ORIGIN_HOST?: string;
}

/**
 * Request headers that can make an upstream answer with something other than a
 * complete 200 body. `Range` is the actual culprit; the conditional headers are
 * stripped too because a `304 Not Modified` is just as unusable to a fetcher
 * that wants bytes, and costs nothing to prevent.
 */
const BODY_SUPPRESSING_HEADERS = [
  'range',
  'if-range',
  'if-none-match',
  'if-modified-since',
] as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Image fetchers only ever GET (some HEAD first to size the object).
    // Anything else reaching this hostname is not a fetcher and has no
    // business writing through it.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: 'GET, HEAD' },
      });
    }

    const headers = new Headers(request.headers);
    for (const h of BODY_SUPPRESSING_HEADERS) headers.delete(h);

    const url = new URL(request.url);
    if (env.ORIGIN_HOST) url.hostname = env.ORIGIN_HOST;

    let response = await fetch(url.toString(), {
      method: request.method,
      headers,
      redirect: 'follow',
    });

    // Defensive second pass. With no `Range` sent, a 206 should be
    // impossible — but this Worker exists precisely because an intermediary
    // produced one unbidden, so it is worth handling rather than trusting.
    // A cache-busting retry is cheap and only ever runs on the anomaly.
    if (response.status === 206 || response.status === 304) {
      const retry = new URL(url.toString());
      retry.searchParams.set('__mdfull', Date.now().toString(36));
      response = await fetch(retry.toString(), {
        method: request.method,
        headers,
        redirect: 'follow',
        cf: { cacheEverything: false },
      });
    }

    // Anything that is not a partial response is already correct — including
    // errors, which must stay errors.
    if (response.status !== 206) {
      return response;
    }

    // Still partial. For the `bytes=0-` these fetchers send, the 206 body IS
    // the complete object, so restating it as a 200 with the range metadata
    // removed is accurate rather than a lie. Guard on that: a 206 for a
    // genuine mid-object range would NOT be the whole file, and quietly
    // relabelling it would corrupt the image.
    const contentRange = response.headers.get('content-range') ?? '';
    const isFullBody = /^bytes 0-\d+\/\d+$/.test(contentRange);
    if (!isFullBody) {
      return new Response('Upstream returned an unexpected partial response', {
        status: 502,
      });
    }

    const out = new Headers(response.headers);
    out.delete('content-range');
    // Tell anything downstream not to try ranging this again.
    out.set('accept-ranges', 'none');

    return new Response(response.body, {
      status: 200,
      statusText: 'OK',
      headers: out,
    });
  },
} satisfies ExportedHandler<Env>;
