// The Better Auth client's pool. It is a second PrismaClient in every process that
// loads @wizeworks/auth, so it gets its own small budget: AUTH_DB_CONNECTION_LIMIT,
// default 1; a connection_limit already in the URL wins (WW-1, SI-1).

import { poolFor, withConnectionLimit } from '@wizeworks/db/connection-limit';

export const AUTH_DEFAULT_CONNECTION_LIMIT = 1;

/** `url` with the auth pool's connection_limit applied. */
export function authConnectionUrl(url: string, env: Record<string, string | undefined>): string {
  const pool = poolFor(url, env.AUTH_DB_CONNECTION_LIMIT, AUTH_DEFAULT_CONNECTION_LIMIT);
  return withConnectionLimit(url, pool.limit);
}
