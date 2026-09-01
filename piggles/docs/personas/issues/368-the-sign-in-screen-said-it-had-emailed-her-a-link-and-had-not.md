# 368 — The sign-in screen said it had emailed her a link, and had not

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · working the register (FOLLOW_UPS #7)
**Surface:** getpiggles.com › Sign in › "Email me a link instead" and "Forgot your password?"
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** publishing a real magic link through the running bus and watching the worker ack it

## What happened

Both ways past a forgotten password end on the same screen:

> Check your email — we have sent a link that signs you straight in. It is good
> for the next few minutes.

On a machine with no `EVENT_BROKER` set, nothing had been sent. Not delayed, not
queued: discarded, deliberately, by the transport that exists to discard things.

The chain is short. Both buttons reach `publishAuthEmail`, which publishes an
`email.send` event. With no broker configured, `resolveTransport` returns the
`log` transport, whose entire job is to write a line and drop the event —
correctly, because that is what a logging stub is for. `publishEvent` then
resolves successfully, because dropping is not an error. The client sees no
error. The screen says it sent a link.

The only trace is one startup line reading `events: logging stub — events are
DISCARDED`, in a terminal nobody is reading at the moment they are locked out.
The only way back into that account is to sign up a new one, which has already
cost real time once.

## Why the register's version of this was wrong

FOLLOW_UPS #7 named the wrong mechanism. It said the publisher was built by
`localDispatchFromEnv`, which returns null when `SPARX_DEV_WORKER_ROUTES` is
unset, and that the trace was `[pubsub:dev-dispatch] no local worker — skipping`.
That was true of an older transport selector. It is not how the publisher is
chosen any more — `EVENT_BROKER` is, and unset selects the logging stub rather
than nothing at all.

The distinction mattered, because it is why **the flow works on this machine
right now** and the note claimed it could not. Measured rather than read, end to
end, against the running stack:

```
stream last_seq before: 25996
POST /api/auth/sign-in/magic-link  →  200 {"status":true}
stream last_seq after:  25998

seq 25997  subject=sparx.email.send  type=email.send  to=p03.devi@piggles.test  template=magic-link
email-worker  | pending: 0 | ack_floor: 25997 | delivered: 25997
```

Published, delivered, acknowledged. `piggles/apps/account/.env` carries
`EVENT_BROKER=nats`, so the whole path runs.

**And `.env` is gitignored.** The file that tells the next person what to set is
`.env.example`, and it had **no `EVENT_BROKER` line at all** — while every
service that publishes events (`api-rest`, `api-graphql`, `api-mcp`,
`event-worker`, `import-worker`, `media-worker`) has one. So the app that sends
every email a person is waiting for was the one app whose example did not
mention the broker those emails travel on. The defect was one checkout away, not
gone: a fresh clone reproduces exactly what the note described, for a reason the
note did not name.

## The fix

**1. Do not promise a delivery that provably will not happen.**

`Publisher` gained one optional flag, set on the logging stub and nowhere else:

```ts
/** True when this transport THROWS THE EVENT AWAY — the logging stub, and
 *  nothing else. Every publisher resolves successfully, so without this a
 *  caller cannot tell "queued" from "discarded". */
readonly discards?: boolean;
```

Deliberately narrower than `isDurable`. The HTTP dev dispatch is not durable but
it does deliver, and a caller that refused to run on anything non-durable would
break local development for no reason. The question worth asking is not "is this
robust", it is "did the event go anywhere at all".

`publishAuthEmail` then refuses, rather than reporting success, for the four
templates where the email IS the person's next step — magic link, password
reset, address verification, one-time code. The error names the variable to set,
because the person reading it is a developer locked out of a dev account and the
fix belongs in the message.

**The other templates still go through.** `password-changed`,
`new-device-signin`, `two-factor-changed`, `invitation-accepted` all report on
something that has already happened. Failing a password reset because its
confirmation email could not be queued would be worse than the missing
confirmation, and `onPasswordReset` is not wrapped in a catch — it fires after
the password has already changed.

Nothing else needed writing: the sign-in form has always handled the error case
and says _"We could not send that link. Please try again in a moment."_ It had
simply never been reachable. The screen was ready to tell the truth and was
never given it.

**2. Put the broker in the example, so it does not happen at all.**

`piggles/apps/account/.env.example` now carries `EVENT_BROKER`, with the failure
written down beside it — the same treatment `api-rest`'s example already gives
the same variable, for the same reason.

## Confirming it

Eight tests, and five of them fail against the previous behavior — checked by
running them against a copy with the guard removed rather than by assuming:

```
× refuses to report a magic-link as sent
    AssertionError: promise resolved "undefined" instead of rejecting
× refuses to report a password-reset as sent
× refuses to report a email-verification as sent
× refuses to report a login-otp as sent
× names the variable to set rather than only the failure
```

"Promise resolved undefined instead of rejecting" is the defect in one line:
the caller was told everything was fine. The three notice templates pass in both
runs, which is the point of separating them.

No network is touched — with the broker unset the logging stub is the whole
transport under test, which is also the state a fresh checkout is in.

## Still open

- **`team-invitation` is not in the awaited set.** The inviter is told the
  invitation was sent, so it has the same shape, but the invitee can be
  re-invited and the pending row is visible on screen, so a silent failure is
  recoverable in a way a lost password reset is not. Left out deliberately
  rather than overlooked.
- **Only the account app's example was corrected.** Any other app that publishes
  something a person waits for and has no `EVENT_BROKER` in its example has the
  same gap; nothing checks for it. A guard would have to know which apps
  publish, which is not written down anywhere today.
