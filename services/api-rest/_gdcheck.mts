// TEMP diagnostic — loads .env via the `dotenv` PACKAGE (exactly how the server
// parses it, unlike Node's native --env-file which can keep a trailing \r from
// Windows CRLF). Inspects the key/secret for hidden contamination (no value
// chars printed), then hits the documented prod call. Read-only. Deleted after.
import 'dotenv/config';

const key = process.env.GODADDY_API_KEY_OTE ?? '';
const secret = process.env.GODADDY_API_SECRET_OTE ?? '';

function inspect(name: string, v: string): void {
  const lastCode = v.length ? v.charCodeAt(v.length - 1) : -1;
  console.log(
    `${name}: rawLen=${v.length} trimLen=${v.trim().length} lastCharCode=${lastCode} ` +
      `endsCR=${lastCode === 13} endsSpace=${lastCode === 32} ` +
      `startsQuote=${v[0] === '"' || v[0] === "'"} hasColon=${v.includes(':')} ` +
      `hasWhitespace=${/\s/.test(v)}`
  );
}
inspect('key   ', key);
inspect('secret', secret);

async function probe(label: string, base: string, k: string, s: string): Promise<void> {
  const url = `${base}/v1/domains/available?domain=example.guru`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `sso-key ${k}:${s}`, Accept: 'application/json' },
    });
    const body = await res.text();
    console.log(`${label}\n   HTTP ${res.status}  ${body.slice(0, 220)}`);
  } catch (e) {
    console.log(`${label}  fetch error: ${e instanceof Error ? e.message : e}`);
  }
}

console.log('\n--- PROD, values as parsed ---');
await probe('prod (raw)', 'https://api.godaddy.com', key, secret);
console.log('\n--- PROD, values trimmed ---');
await probe('prod (trim)', 'https://api.godaddy.com', key.trim(), secret.trim());
