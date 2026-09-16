# 469 — Every warning a download carried had never once been shown

**Status:** fixed
**Severity:** blocker
**Found by:** a fix to the accounting export not appearing on screen, and asking why
**Surface:** `finance.accounting` and `staff.timesheets`, both consoles · CORS on api-rest
**Filed:** 2026-09-09

## What was wrong

A cross-origin `fetch` can read exactly **seven** response headers:
`Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`,
`Last-Modified`, `Pragma`. Everything else is invisible to JavaScript unless the
server names it in `Access-Control-Expose-Headers`.

api-rest set no `exposedHeaders` at all. Measured in the browser, on the console's
own origin:

```js
[...response.headers.keys()];
// → ["content-length", "content-type"]
```

There is no error. No console warning. No failed request. `headers.get(…)` simply
answers `null`, and every caller's fallback beside it turns that into an answer.

Three shipped that way, in both consoles, for as long as the endpoints have
existed:

| what the browser tried to read     | what it got | what the person was shown                     |
| ---------------------------------- | ----------- | --------------------------------------------- |
| `content-disposition` (accounting) | null        | every export saved as `expenses.csv`          |
| `content-disposition` (timesheets) | null        | every export saved as `hours.csv`             |
| `x-sparx-skipped-rows`             | null → `0`  | _"Every cost in that period is in the file."_ |
| `x-sparx-unpriced-minutes`         | null → `0`  | nothing at all                                |

## The two that matter

**The filename.** Devi downloads August for her accountant, then September. Both
arrive as `expenses.csv`. She cannot tell them apart in her Downloads folder, and
the second one either overwrites the first or lands as `expenses (1).csv`.

**The payroll warning.** The timesheet export carries this sentence:

> _"12h 30m are in the hours column but not the cost column — nobody has a pay
> rate covering them. They still have to be paid."_

It has never appeared. Not once, for anybody. The server computes the number, the
route puts it on a header, the console reads the header, the number is always
zero, and the branch that would show it never runs. What the person gets instead
is the success path: silence.

Somebody pays staff from that file. The server's own comment says exactly what
was at stake:

> _"A download cannot carry a warning, so the one fact that would change how
> someone reads the file rides on a header … the discrepancy somebody will
> otherwise spend an afternoon hunting."_

The same comment appears on the accounting route, in nearly the same words:
_"Rows left out are surfaced in a header rather than silently dropped."_ Both
authors thought about this carefully and both were defeated by one missing line
of CORS configuration four hundred files away.

## The fix

`wizeworks/services/api-rest/src/lib/exposed-headers.ts` holds the list, with the
reason it exists written above it, and `app.ts` hands it to `@fastify/cors`
beside the `methods` array — which is there for exactly the same kind of silent
default.

```ts
exposedHeaders: [...EXPOSED_RESPONSE_HEADERS],
```

Explicit rather than `*`, so adding one is a decision somebody makes.

## The guard

`pnpm check:exposed-headers` reads the allowlist out of that file and scans both
consoles' client code for `headers.get('…')`, requiring every non-safelisted name
to be on it. It also asserts that `app.ts` actually passes the list to CORS — a
perfect allowlist nobody registers is the same bug wearing a tidier hat.

Client code only: the scan roots are `surfaces/` and `lib/` under each workbench,
which are browser modules. Next route handlers under `app/api/**` read REQUEST
headers and are deliberately out of scope, because a check with false positives
is a check somebody switches off.

Reports `10 header reads across 1997 client files · 4 exposed by the API`. Wired
into `package.json`, the pre-push guard and CI.

| breaking                                     | reddens                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| dropping one header from the allowlist       | 2 — both consoles, by file and line                     |
| removing `exposedHeaders` from the CORS call | throws, naming the registration                         |
| renaming a scan root                         | throws, rather than scanning nothing and printing green |

The allowlist parser strips comments before extracting quoted names. It did not
at first, and an apostrophe in the prose above an entry ("the caller's fallback")
paired with the next one and swallowed a real header — a check that quietly stops
checking, which is the exact failure this file exists to catch. It now also
refuses anything that does not look like a header name, so a parse that goes
wrong again fails loudly.

## Proven

`curl -H "Origin: http://localhost:3022"` now answers:

```
access-control-expose-headers: content-disposition, x-sparx-skipped-rows, x-sparx-row-count, x-sparx-unpriced-minutes
```

and the download toast names the real file rather than `expenses.csv`.
