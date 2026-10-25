// The Prisma pool size for this process, and the DATABASE_URL that carries it.
// The database is a 35-slot B1ms shared by ~10 processes with no pooler, so an
// unset limit must be small: Prisma's own default grew with the node's CPUs.
// This module imports nothing, so it can be tested without a database.

/** The pool a process gets when nothing sets `DB_CONNECTION_LIMIT` or the URL. */
export const DEFAULT_CONNECTION_LIMIT = 2;

export interface ConnectionLimit {
  limit: number;
  source: 'url' | 'env' | 'default';
}

type Env = Record<string, string | undefined>;

/** The pool size, and where it came from: the URL wins, then the env var, then 2. */
export function connectionLimit(env: Env): ConnectionLimit {
  return poolFor(env.DATABASE_URL, env.DB_CONNECTION_LIMIT, DEFAULT_CONNECTION_LIMIT);
}

/** Any client's pool: the URL's own connection_limit, then `limit` if a positive integer, then `fallback`. */
export function poolFor(
  url: string | undefined,
  limit: string | undefined,
  fallback: number
): ConnectionLimit {
  const fromUrl = urlLimit(url);
  if (fromUrl !== null) return { limit: fromUrl, source: 'url' };
  const explicit = Number(limit?.trim());
  if (Number.isInteger(explicit) && explicit > 0) return { limit: explicit, source: 'env' };
  return { limit: fallback, source: 'default' };
}

function urlLimit(url: string | undefined): number | null {
  const match = url ? /[?&]connection_limit=(\d+)/.exec(url) : null;
  const n = match ? Number(match[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `url` with `connection_limit` added; string work only, so a password stays byte-for-byte. */
export function withConnectionLimit(url: string, limit: number): string {
  if (/[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${limit}`;
}

/** The URL Prisma should open, or undefined when there is no DATABASE_URL. */
export function connectionUrl(env: Env): string | undefined {
  const raw = env.DATABASE_URL;
  if (!raw) return undefined;
  return withConnectionLimit(raw, connectionLimit(env).limit);
}
