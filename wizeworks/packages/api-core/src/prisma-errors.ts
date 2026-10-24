// Prisma errors that are not bugs in the route: the database is out of
// connections, or the request carried bytes Postgres will not store.
// Matched by name and code, not instanceof, so a second Prisma copy still matches.

/** Pool and reachability codes: P1001 unreachable, P2024 pool timeout, P2028 no transaction, P2037 too many connections. */
const UNAVAILABLE_CODES = new Set(['P1001', 'P2024', 'P2028', 'P2037']);

/** Seconds a client should wait before it retries a 503. */
export const RETRY_AFTER_SECONDS = 2;

export interface PrismaErrorReply {
  status: 400 | 503;
  code: 'SERVICE_UNAVAILABLE' | 'VALIDATION_ERROR';
  message: string;
}

interface PrismaLike {
  name?: unknown;
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  meta?: { code?: unknown };
}

function isPrismaError(err: unknown): err is PrismaLike {
  if (!err || typeof err !== 'object') return false;
  const name = (err as PrismaLike).name;
  return typeof name === 'string' && name.startsWith('PrismaClient');
}

function prismaCode(err: PrismaLike): string | undefined {
  if (typeof err.code === 'string') return err.code;
  return typeof err.errorCode === 'string' ? err.errorCode : undefined;
}

/** Postgres 22021: a NUL or invalid UTF-8 byte reached a text column. */
function isBadByteSequence(err: PrismaLike): boolean {
  if (err.meta?.code === '22021') return true;
  return typeof err.message === 'string' && err.message.includes('code: "22021"');
}

/** The reply for a Prisma error that is not a route bug, or null for any other error. */
export function prismaErrorReply(err: unknown): PrismaErrorReply | null {
  if (!isPrismaError(err)) return null;
  const code = prismaCode(err);
  if (code && UNAVAILABLE_CODES.has(code)) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is busy. Try again shortly.',
    };
  }
  if (isBadByteSequence(err)) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request has invalid characters.',
    };
  }
  return null;
}
