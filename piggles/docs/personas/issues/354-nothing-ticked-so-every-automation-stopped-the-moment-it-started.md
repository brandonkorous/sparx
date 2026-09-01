# 354 — Nothing ticked, so every automation stopped the moment it started

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · chasing why the form-submission automation never finished
**Surface:** the platform › the automation engine, everywhere that is not Kubernetes
**Filed:** 2026-08-31
**Fixed:** 2026-08-31
**Confirmed by:** her next submission, which advanced on its own with nothing manual behind it

## What happened

A shopper's message reached Devi's inbox, and the automation that acts on it —
notify her, reply to the sender, capture the lead — was created and then sat there:

```
status         running
cursor_index   0
actions_total  3
started_at     05:13:40
completed_at   (null)
```

Still `0` of `3` twenty minutes later.

## Two mechanisms, and only one of them was in the process

Consuming an event **enqueues** a run. A tick **advances** it. They are separate, and
only the first lived in the worker:

- `event-worker` subscribes to the automation fan-in and calls `handleTrigger`, which
  writes the run row. That part worked, on NATS, exactly as designed.
- `runAutomationTick` — the thing that executes the actions — was reachable only over
  HTTP at `/internal/cron/tick`, and the only caller was
  `k8s/cronjobs/automation-tick.yaml`.

Outside the cluster nothing knocked on that door. **The CronJob's own header predicts
this failure word for word:**

> WHY THIS EXISTS. On GCP the tick came from Cloud Scheduler calling a Cloud Run URL
> with an OIDC token. Neither survives a move to AKS, so without this file the worker
> runs and subscribes but nothing ever ticks: scheduled automations, delayed steps and
> drip sequences all simply stop. **That is silent — the pod is healthy, the queue is
> empty, and the only symptom is work that never happens.**

It was right, and it was one environment short: the file fixes the cluster and nothing
fixes anywhere else.

## How much had banked up

The first manual tick, run to test the theory:

```json
{
  "schedule": { "automations": 216, "enqueued": 20 },
  "runs": { "acquired": true, "runs": 100, "completed": 100, "failed": 0 },
  "sequences": { "acquired": true, "due": 0, "sent": 0 }
}
```

**100 runs, all completed, none failed.** The engine was never broken. Nothing had
called it.

## What this was NOT, checked before it was believed

The obvious suspect was Pub/Sub, since the platform runs on NATS now. It is not that,
and the evidence is specific:

- `publisher.ts` teeing to the fan-in over a Pub/Sub `Topic` is the Pub/Sub path only.
  The NATS transport tees too — `transports/nats.ts` calls `buildFanIn` and publishes
  to `subjectFor(AUTOMATION_FANIN_TOPIC)`, and `fan-in.ts` says why `buildFanIn` was
  split out: _"the NATS adapter needs exactly this without a Google type in sight."_
- The run row **existed**, which can only happen if the fan-in message was delivered
  and consumed.

So the transport did its whole job.

> **A correction, 2026-09-01.** This paragraph used to claim that
> `@google-cloud/pubsub`, imported eagerly by `@wizeworks/events`, "deadlocks tsx on
> Node 24, which is what makes every service hang at startup locally". Measured on
> tsx 4.22.3 / Node 24.16.0: `@google-cloud/pubsub` loads in **1,147 ms** and
> `@wizeworks/events` in **577 ms**, neither hangs, and `api-rest` — which imports
> the package from `src/index.ts` — was answering on 3100 while this was written, as
> was `event-worker` on 8086. Whatever produced that symptom, it was not this, and it
> is not happening now. Left as a correction rather than deleted, because the claim
> had been carried forward as a known problem and was shaping what got built around
> it.

## The fix

`event-worker` drives its own heartbeat: `AUTOMATION_TICK_INTERVAL_MS`, default
60,000, matching the CronJob. `0` turns it off.

**Safe beside the CronJob, deliberately.** `runAutomationTick` takes a Postgres
advisory lock, so whichever fires second gets `acquired: false` and returns. An
in-process guard does the same one level up, so a tick that overruns its interval never
has another stacked behind it — the same reasoning as the CronJob's
`concurrencyPolicy: Forbid`.

Never fatal: a failed tick logs and is retried on the next beat. Taking the process
down over it would stop twelve healthy consumers as well. Quiet by default too — a tick
that moved nothing logs at `debug`, because a line every minute forever is not a log.

## Confirmed by

A second message sent through her live Contact form, with no manual tick anywhere:

```
+12s: completed | 3 | 3
```

and its three steps, which are the whole point of the feature:

| Action             | Result                                         |
| ------------------ | ---------------------------------------------- |
| `form.notify`      | completed — `{"enqueued": 1, "recipients": 1}` |
| `form.autoreply`   | completed — skipped, autoresponder off         |
| `crm.capture_lead` | completed — skipped, CRM off                   |

`automation_runs` with status `running`: **0**.

## Worth saying plainly

This is why "she was never told a message arrived" looked like a forms bug and was not.
Every scheduled automation, every delayed step and every drip sequence in local
development had been dead for as long as the console has run outside Kubernetes, and
nothing anywhere said so.

## Rating effect

Not a surface. It is the reason [355]'s notify and autoresponder settings can be tested
at all, and it stands behind every automation-driven feature in the product.
