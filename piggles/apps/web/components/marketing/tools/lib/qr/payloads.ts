// Strings phones recognize as something other than text. Each format has its own
// escaping rule, and getting it wrong yields a code that scans and then does
// nothing, which looks like a broken phone rather than a broken code.

export function wifiPayload(opts: {
  ssid: string;
  password: string;
  security: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}): string {
  // Semicolons, colons, commas and backslashes are separators in this format and
  // have to be escaped. A café Wi-Fi password with a semicolon in it is exactly
  // the sort of thing that silently truncates.
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  const parts = [`T:${opts.security}`, `S:${esc(opts.ssid)}`];
  if (opts.security !== 'nopass') parts.push(`P:${esc(opts.password)}`);
  if (opts.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export function smsPayload(number: string, message: string): string {
  return message ? `SMSTO:${number}:${message}` : `SMSTO:${number}`;
}

export function emailPayload(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  return `mailto:${to}${query ? `?${query}` : ''}`;
}

export function telPayload(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

export function geoPayload(lat: string, lng: string): string {
  return `geo:${lat},${lng}`;
}
