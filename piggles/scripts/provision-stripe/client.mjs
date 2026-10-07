// A zero-dependency Stripe REST client: form-encoding plus GET and POST.

const BASE_URL = 'https://api.stripe.com/v1';

/** Flatten a nested value into Stripe's bracket form-encoding
 *  (`metadata[kind]=base`, `features[invoice_history][enabled]=true`). */
function encode(params, prefix = '', out = new URLSearchParams()) {
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

export function makeClient(secretKey) {
  async function call(method, path, params = {}) {
    const body = encode(params).toString();
    const res = await fetch(`${BASE_URL}${path}${method === 'GET' ? `?${body}` : ''}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/x-www-form-urlencoded' }),
      },
      ...(method === 'GET' ? {} : { body }),
    });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json?.error?.message ?? `Stripe returned ${res.status}`);
      err.code = json?.error?.code;
      throw err;
    }
    return json;
  }
  return { get: (p, q) => call('GET', p, q), post: (p, b) => call('POST', p, b) };
}
