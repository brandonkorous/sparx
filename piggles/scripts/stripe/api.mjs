// A zero-dependency Stripe REST client for the provisioner.
//
// The repo's other Stripe script reaches for the `stripe` SDK; this one does not,
// because `piggles/scripts/*` are plain Node files run straight from the repo root
// with no package of their own, and adding one to install a dependency the script
// uses once is more machinery than the job needs.
//
// Stripe's API is form-encoded with brackets for nesting — `metadata[kind]=base`,
// `features[invoice_history][enabled]=true`, `enabled_events[0]=…` — so the only
// thing missing from `fetch` is the encoder below.

const BASE = 'https://api.stripe.com/v1';

/** Flatten a nested value into Stripe's bracket form-encoding. */
export function encode(params, prefix = '', out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') encode(item, `${name}[${i}]`, out);
        else out.append(`${name}[${i}]`, String(item));
      });
    } else if (typeof value === 'object') {
      encode(value, name, out);
    } else {
      out.append(name, String(value));
    }
  }
  return out;
}

/** A Stripe error carrying the `code` callers branch on (`resource_missing`). */
class StripeError extends Error {
  constructor(body, status) {
    super(body?.error?.message ?? `Stripe returned ${status}`);
    this.name = 'StripeError';
    this.code = body?.error?.code;
    this.status = status;
  }
}

export { StripeError };

/** A client bound to one secret key. `get` and `post` are the whole surface. */
export function makeClient(secretKey) {
  async function call(method, path, params = {}) {
    const query = method === 'GET' ? `?${encode(params).toString()}` : '';
    const res = await fetch(`${BASE}${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      ...(method === 'GET' ? {} : { body: encode(params).toString() }),
    });
    const body = await res.json();
    if (!res.ok) throw new StripeError(body, res.status);
    return body;
  }

  return {
    get: (path, params) => call('GET', path, params),
    post: (path, params) => call('POST', path, params),
  };
}
