// Response envelope mirror.
//
// api-rest always returns one of these shapes (docs/06-api-specification.md
// §3). The client unwraps `success: true` payloads to the inner `data`,
// throws `ApiError` on `success: false`. Keep these types in lockstep with
// wizeworks/services/api-rest/src/lib/envelope.ts — they're duplicated here only so
// this package has no api-rest dependency.

export interface EnvelopeSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface EnvelopeError {
  success: false;
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export type Envelope<T> = EnvelopeSuccess<T> | EnvelopeError;

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string;
  public readonly details: unknown;
  /** The server's Retry-After in seconds, when it sent one (a 503 or 429). */
  public readonly retryAfterSeconds: number | undefined;

  constructor(status: number, body: EnvelopeError, retryAfterSeconds?: number) {
    super(body.error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error.code;
    this.requestId = body.error.request_id;
    this.details = body.error.details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Retry-After as whole seconds; only the delta-seconds form api-rest sends is read. */
export function retryAfterSeconds(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  const seconds = raw === null ? NaN : Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
