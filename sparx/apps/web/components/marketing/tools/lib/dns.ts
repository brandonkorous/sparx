/**
 * DNS-over-HTTPS TXT lookups for the deliverability checker. Google's public
 * resolver (dns.google) supports CORS, so SPF/DKIM/DMARC records can be checked
 * straight from the browser with no backend. TXT data comes back quoted and
 * sometimes split into multiple strings — we unquote and join.
 */
export interface TxtLookup {
  name: string;
  records: string[];
  error?: string;
}

interface DohAnswer {
  data?: string;
}
interface DohResponse {
  Answer?: DohAnswer[];
}

function cleanTxt(data: string): string {
  // dns.google returns e.g. "\"v=spf1 include:_spf.google.com ~all\"" and may
  // join long records as "\"part1\" \"part2\"".
  return data.replace(/"\s+"/g, '').replace(/^"|"$/g, '').trim();
}

export async function lookupTxt(name: string): Promise<TxtLookup> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { accept: 'application/dns-json' } }
    );
    if (!res.ok) return { name, records: [], error: `Lookup failed (${res.status})` };
    const json = (await res.json()) as DohResponse;
    const records = (json.Answer ?? []).map((a) => cleanTxt(a.data ?? '')).filter(Boolean);
    return { name, records };
  } catch {
    return { name, records: [], error: 'Network error — could not reach the DNS resolver.' };
  }
}

/** Normalize a user-entered domain (strip protocol, path, leading www). */
export function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '');
}
