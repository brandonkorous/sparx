// Reading real mail (docs/144 §5.3) — headers, encodings, and MIME bodies.
//
// PURE, and hand-written rather than pulled from a dependency, for the same
// reason `@wizeworks/scheduling` hand-writes its iCal and CalDAV XML parsers: the
// subset the platform needs is small and stable, the general libraries are
// large and carry their own transitive surface, and a parser we own is a parser
// we can fix on a Tuesday.
//
// THE GOVERNING RULE HERE IS "NEVER LOSE THE MESSAGE". Real mail arrives with
// mislabelled charsets, boundaries that never close, headers folded in ways the
// RFC does not sanction, and bodies that claim base64 and are not. Every
// function below degrades to the least-wrong answer instead of throwing —
// because the alternative is dropping a customer's reply on the floor over a
// malformed Content-Type, and a slightly mangled body is recoverable by a human
// reading it while a discarded message is not.

/** Headers, lower-cased names → every value that appeared under that name. */
export type HeaderMap = Map<string, string[]>;

/* ── Transfer encodings ─────────────────────────────────────────────────── */

/** Gmail's flavour of base64: `-`/`_` for `+`/`/`, padding optional. */
export function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

/**
 * Quoted-printable (RFC 2045 §6.7) — the encoding a plain-text email from
 * Outlook actually arrives in.
 *
 * Soft line breaks (a trailing `=`) join the line to the next one; `=XX` is a
 * hex byte. Decoded through a byte buffer rather than per-character, because a
 * multi-byte UTF-8 character arrives as several `=XX` escapes and decoding them
 * one at a time produces mojibake.
 */
export function decodeQuotedPrintable(value: string, charset = 'utf-8'): string {
  const joined = value.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i += 1) {
    const char = joined[i];
    if (char === '=' && i + 2 < joined.length) {
      const hex = joined.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    // Anything else is literal. A stray `=` that is not a valid escape stays a
    // `=` — some senders emit them and dropping the character is worse.
    for (const byte of Buffer.from(char ?? '', 'utf8')) bytes.push(byte);
  }
  return decodeBytes(Buffer.from(bytes), charset);
}

/** Bytes → text in the declared charset, falling back to UTF-8 and then to
 *  latin1 (which cannot fail) rather than throwing on an unknown label. */
export function decodeBytes(buffer: Buffer, charset: string): string {
  const label = charset.trim().toLowerCase().replace(/^"|"$/g, '');
  if (label === '' || label === 'utf-8' || label === 'utf8' || label === 'us-ascii') {
    return buffer.toString('utf8');
  }
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

/**
 * RFC 2047 encoded words — `=?utf-8?B?SGVsbG8=?=` in a Subject or a display
 * name.
 *
 * Adjacent encoded words separated only by whitespace are joined without it,
 * per §6.2: that whitespace is an artifact of folding, and leaving it in splits
 * a multi-byte character across two words into visible garbage.
 */
export function decodeEncodedWords(value: string): string {
  // Collapse the folding whitespace BETWEEN adjacent encoded words first, so a
  // character whose bytes were split across two words rejoins cleanly.
  return value
    .replace(/\?=[ \t]+=\?/g, '?==?')
    .replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (_match, charset: string, encoding: string, text: string) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            return decodeBytes(Buffer.from(text, 'base64'), charset);
          }
          // Q encoding is quoted-printable with `_` meaning a space.
          return decodeQuotedPrintable(text.replace(/_/g, ' '), charset);
        } catch {
          return text;
        }
      }
    );
}

/* ── Headers ────────────────────────────────────────────────────────────── */

/**
 * Parse a header block into a map.
 *
 * Continuation lines (starting with space or tab) belong to the header above —
 * that is "folding", and a References chain or a long Subject arrives folded
 * almost every time. A line with no colon and no leading whitespace is junk
 * from a broken sender and is skipped rather than fataled.
 */
export function parseHeaderBlock(raw: string): HeaderMap {
  const headers: HeaderMap = new Map();
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let currentName: string | null = null;
  let currentValue = '';

  const flush = (): void => {
    if (currentName === null) return;
    const list = headers.get(currentName) ?? [];
    list.push(currentValue.trim());
    headers.set(currentName, list);
    currentName = null;
    currentValue = '';
  };

  for (const line of lines) {
    if (line === '') break; // blank line ends the header block
    if (/^[ \t]/.test(line) && currentName !== null) {
      currentValue += ` ${line.trim()}`;
      continue;
    }
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    flush();
    currentName = line.slice(0, colon).trim().toLowerCase();
    currentValue = line.slice(colon + 1).trim();
  }
  flush();
  return headers;
}

/** The first value of a header, decoded, or null. */
export function header(headers: HeaderMap, name: string): string | null {
  const value = headers.get(name.toLowerCase())?.[0];
  return value === undefined ? null : decodeEncodedWords(value);
}

/**
 * The bare addresses out of a `To`/`Cc`/`From` header.
 *
 * Deliberately forgiving. Real headers carry display names with commas inside
 * quotes (`"Reed, Dana" <dana@…>`), group syntax, and bare addresses with no
 * angle brackets at all. We want the addresses and nothing else, so the
 * angle-bracket form wins where present and anything that looks like an address
 * is taken otherwise. Order is preserved; duplicates and empties are dropped.
 */
export function parseAddressList(value: string | null | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (candidate: string): void => {
    const address = candidate.trim().toLowerCase();
    if (address === '' || !address.includes('@') || seen.has(address)) return;
    seen.add(address);
    out.push(address);
  };

  const bracketed = value.match(/<([^<>]+)>/g);
  if (bracketed) {
    for (const match of bracketed) push(match.slice(1, -1));
  }
  // Bare addresses too: a header may mix `<a@b>` and `c@d` in one line.
  const bare = value.replace(/<[^<>]*>/g, ' ').replace(/"[^"]*"/g, ' ');
  for (const token of bare.split(/[,;\s]+/)) push(token);
  return out;
}

/** The single address a `From` header names, or null. */
export function parseSingleAddress(value: string | null | undefined): string | null {
  return parseAddressList(value)[0] ?? null;
}

/** A parameter off a structured header: `text/html; charset="utf-8"`. */
export function headerParam(value: string | null | undefined, name: string): string | null {
  if (!value) return null;
  const match = new RegExp(`;\\s*${name}\\s*=\\s*("([^"]*)"|([^;\\s]+))`, 'i').exec(value);
  return match ? (match[2] ?? match[3] ?? null) : null;
}

/* ── Bodies ─────────────────────────────────────────────────────────────── */

export interface ParsedBody {
  html: string | null;
  text: string | null;
}

export interface ParsedRawMessage extends ParsedBody {
  headers: HeaderMap;
}

/**
 * A whole RFC 822 message: headers, then whichever body parts are readable.
 *
 * Handles the three shapes that account for essentially all real mail —
 * single-part, `multipart/alternative` (text + HTML of the same message), and
 * `multipart/mixed` (a message with attachments). Nested multiparts recurse.
 * Attachments are SKIPPED, not parsed: this table stores what was said, and a
 * 4MB PDF in a text column helps nobody.
 */
export function parseRawMessage(raw: string): ParsedRawMessage {
  const normalized = raw.replace(/\r\n/g, '\n');
  const split = normalized.indexOf('\n\n');
  const headerText = split === -1 ? normalized : normalized.slice(0, split);
  const body = split === -1 ? '' : normalized.slice(split + 2);
  const headers = parseHeaderBlock(headerText);
  return { headers, ...parseBody(body, headers) };
}

/** The readable parts of one MIME entity, given its own headers. */
export function parseBody(body: string, headers: HeaderMap): ParsedBody {
  const contentType = headers.get('content-type')?.[0] ?? 'text/plain';
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? 'text/plain';
  const charset = headerParam(contentType, 'charset') ?? 'utf-8';
  const encoding = (headers.get('content-transfer-encoding')?.[0] ?? '7bit').trim().toLowerCase();

  if (mediaType.startsWith('multipart/')) {
    const boundary = headerParam(contentType, 'boundary');
    if (!boundary) return { html: null, text: null };
    return mergeParts(
      splitMultipart(body, boundary).map((part) => {
        const partSplit = part.indexOf('\n\n');
        const partHeaders = parseHeaderBlock(partSplit === -1 ? part : part.slice(0, partSplit));
        // An attachment is a part with a filename or an `attachment`
        // disposition. Skipped whole — including the recursion, so a forwarded
        // .eml does not smuggle its body into this message's text.
        const disposition = partHeaders.get('content-disposition')?.[0] ?? '';
        if (/attachment/i.test(disposition) || headerParam(disposition, 'filename')) {
          return { html: null, text: null };
        }
        const partBody = partSplit === -1 ? '' : part.slice(partSplit + 2);
        return parseBody(partBody, partHeaders);
      })
    );
  }

  if (mediaType !== 'text/plain' && mediaType !== 'text/html') return { html: null, text: null };

  const decoded = decodeTransfer(body, encoding, charset);
  return mediaType === 'text/html' ? { html: decoded, text: null } : { html: null, text: decoded };
}

function decodeTransfer(body: string, encoding: string, charset: string): string {
  if (encoding === 'base64') {
    return decodeBytes(Buffer.from(body.replace(/\s+/g, ''), 'base64'), charset);
  }
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(body, charset);
  return decodeBytes(Buffer.from(body, 'binary'), charset);
}

/**
 * Split a multipart body on its boundary.
 *
 * The preamble before the first boundary and the epilogue after the closing
 * `--boundary--` are discarded (they are commentary for non-MIME clients). A
 * body whose closing boundary never arrives — truncated in transit, which does
 * happen — still yields every complete part before the truncation.
 */
export function splitMultipart(body: string, boundary: string): string[] {
  const marker = `--${boundary}`;
  const parts: string[] = [];
  const lines = body.split('\n');
  let current: string[] | null = null;
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === marker) {
      if (current) parts.push(current.join('\n'));
      current = [];
      continue;
    }
    if (trimmed === `${marker}--`) {
      if (current) parts.push(current.join('\n'));
      current = null;
      break;
    }
    if (current) current.push(line);
  }
  if (current) parts.push(current.join('\n'));
  return parts;
}

/** Fold several parsed parts into one body, first readable value winning per
 *  half — which is what `multipart/alternative` means. */
function mergeParts(parts: ParsedBody[]): ParsedBody {
  let html: string | null = null;
  let text: string | null = null;
  for (const part of parts) {
    html ??= part.html;
    text ??= part.text;
  }
  return { html, text };
}
