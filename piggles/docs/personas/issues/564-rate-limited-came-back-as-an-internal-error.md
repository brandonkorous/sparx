# 564 — "Rate limited" came back as "an internal error occurred"

**Status:** fixed and proven
**Severity:** high
**Found by:** reading the headers on the 500s from [563](563-one-screen-asked-the-api-675-times-and-took-the-console-down.md)
**Surface:** `wizeworks/services/api-rest/src/plugins/rate-limit.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_verify_capability_in_code_not_docs]] · [[feedback_a_promise_in_copy_is_a_contract]]

## What it said

```
HTTP/1.1 500 Internal Server Error
x-ratelimit-limit: 600
x-ratelimit-remaining: 0
x-ratelimit-reset: 50
retry-after: 50

{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An internal error occurred."}}
```

The headers name the problem and the remedy exactly. The body says the server
broke. **The machine-readable half was right and the human-readable half was a
lie**, on every rate-limited request the platform has ever served.

Downstream, the console rendered what a 500 means:

> **Could not load your counts**
> This is a problem reaching the server.

A shop owner reads that and checks her wifi. The answer was "wait fifty seconds".

## The cause

`@fastify/rate-limit` does not build an error and attach the body to it. It
**throws whatever `errorResponseBuilder` returns**:

```js
throw params.errorResponseBuilder(req, respCtx); // index.js:333
```

Its own default builder returns an `Error` carrying `statusCode = 429`, which is
the only thing the error handler can read. This builder returned the envelope as
a **plain object**:

```ts
errorResponseBuilder: (request, context) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message: `Rate limit of …`, … },
}),
```

No prototype, no `statusCode`. So in `createErrorsPlugin` every branch missed:

| check                                    | result                 |
| ---------------------------------------- | ---------------------- |
| `err instanceof ApiError`                | no                     |
| `err instanceof ZodError`                | no                     |
| `err.statusCode === 400` / `401` / `429` | `undefined`, so no     |
| `err.code.startsWith('FST_ERR_')`        | no                     |
| **fallthrough**                          | **500 INTERNAL_ERROR** |

The plugin's own comment stated the assumption that was wrong:

> _Fastify throws FastifyError with statusCode 429; our errors plugin catches
> that._

It does not. It throws the return value. A comment asserting a behavior is not
the behavior ([[feedback_verify_capability_in_code_not_docs]], now wrong eight
times), and the handler already had a correct 429 branch that could never fire.

## A wrong status is not cosmetic here

**500 means "our bug, safe to retry", and well-behaved clients do retry it.**
Retrying drains the bucket further, which produces more 500s. 429 with
`Retry-After` is the one answer that makes a client back off, so returning 500
actively defeated the thing the limiter exists to do.

## Who saw it

One global limit and ten per-route limits, all through the same builder. Seven
of the ten are on a tenant's **public** site, where the person hitting them is
not the shop owner but her customer:

| route                                  | limit   | who is on the other end                      |
| -------------------------------------- | ------- | -------------------------------------------- |
| `public/account.ts`                    | 10/min  | a shopper signing in or resetting a password |
| `public/forms.ts`                      | 30/min  | a customer using the contact form            |
| `public/forms-upload.ts`               | 20/min  | a customer attaching a file                  |
| `public/careers.ts`                    | 6/min   | someone applying for a job                   |
| `public/deliver.ts`, `public/tools.ts` | 10/min  | a lead magnet download                       |
| `public/site-analytics.ts`             | 120/min | the site itself                              |
| `public/sms-inbound.ts`                | 300/min | the SMS provider                             |
| global                                 | 600/min | every console, every tenant site             |

A shopper who mistypes their password three times was told the site had an
internal error.

## The fix

The builder returns an `ApiError`, which is what the error handler's **first**
branch matches, and `STATUS_BY_CODE.RATE_LIMITED` is already 429. The envelope,
the code, the details and the status all come out of one object:

```ts
errorResponseBuilder: (_request, context) =>
  new ApiError('RATE_LIMITED', `Rate limit of … exceeded.`, {
    retry_after_seconds: Math.ceil(context.ttl / 1000),
  }),
```

## Proven

4 guards in `rate-limit.test.ts`, exercising the real plugin behind the real
error handler, because the defect lived in the seam between them and either half
read correctly alone.

**Proven red** by restoring the plain-object builder:

|                                                  |                                                  |
| ------------------------------------------------ | ------------------------------------------------ |
| "is a 429, not a 500"                            | `expected 500 to be 429`                         |
| "says it was rate limited, and how long to wait" | `expected 'INTERNAL_ERROR' to be 'RATE_LIMITED'` |
| "still carries the retry-after header"           | stayed green (the header was never the problem)  |
| "never limits /health"                           | stayed green                                     |

## Still open

The console's own copy. Its error state says "This is a problem reaching the
server", which is right for a network fault and wrong for a 429 that now arrives
with a `retry_after_seconds`. Telling her "you are going faster than we allow,
try again in a minute" is a separate change to every list surface, and it is
worth making now that the API finally says so.

**The API must be restarted to pick this up** — it is a plugin, registered at
boot.
