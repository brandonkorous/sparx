// WHICH BROKER, and the rule that it can never be answered by accident.
//
// This file exists because of a production incident with no error in it. The
// publisher used to choose its transport by asking whether `GCP_PROJECT_ID` was
// set: present → Google Pub/Sub, absent → a fire-and-forget HTTP fallback
// written as a DEV CONVENIENCE. Migrating from GCP to Azure unset that variable
// and therefore silently selected the dev path in production, where it ran for
// weeks. Every `publishEvent` returned success. Nothing logged an error. But
// there was no queue, no retry, no acknowledgement and no dead-letter — so any
// event published while a worker happened to be restarting was simply gone.
//
// Two things were wrong, and the second is the one that matters:
//
//   1. A CLOUD VENDOR'S NAME WAS THE SWITCH. `GCP_PROJECT_ID` was read in nine
//      packages — commerce, inventory, b2b, auth, customer-auth, builder, crm —
//      so "which cloud am I on" was a question domain code asked itself. It has
//      no business knowing. The selector is now `EVENT_BROKER`, which names the
//      capability, and the provider adapter is the only thing that knows a
//      provider exists.
//
//   2. THE DEFAULT WAS A DOWNGRADE. Unset meant "degrade quietly to something
//      weaker," which is the worst possible default: it converts a
//      configuration mistake into silent data loss instead of a failed
//      start-up. Here, an unset or unrecognised broker in production THROWS.
//      A pod that cannot deliver events refuses to boot, which is loud,
//      immediate, and shows up in a rollout rather than in a support ticket
//      three weeks later.
//
// Adding a provider means adding a case here and an adapter beside it. It must
// never mean adding an `if (process.env.SOME_CLOUD_ID)` anywhere else.

/** Transports that can carry events. `log` and `http` are DEV ONLY — see below. */
export type BrokerKind = 'nats' | 'pubsub' | 'http' | 'log';

export interface NatsTransport {
  kind: 'nats';
  /** e.g. `nats://nats.sparx-prod.svc.cluster.local:4222` */
  url: string;
  /** JetStream stream that binds the event subjects. */
  stream: string;
}

export interface PubSubTransport {
  kind: 'pubsub';
  projectId: string;
}

export interface HttpTransport {
  kind: 'http';
  routes: { url: string; events: string[] }[];
}

export interface LogTransport {
  kind: 'log';
}

export type Transport = NatsTransport | PubSubTransport | HttpTransport | LogTransport;

const DURABLE: BrokerKind[] = ['nats', 'pubsub'];

/**
 * Transports that acknowledge and redeliver. Anything outside this set loses
 * events when a consumer is down, which is tolerable while iterating and never
 * tolerable in production.
 */
export function isDurable(kind: BrokerKind): boolean {
  return DURABLE.includes(kind);
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production';
}

export class BrokerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerConfigError';
  }
}

/**
 * Resolve the transport from the environment.
 *
 * Throws rather than degrading. Callers should NOT catch this: a service that
 * cannot publish its events is not healthy, and starting anyway is what made
 * the original failure invisible.
 */
export function resolveTransport(env: NodeJS.ProcessEnv = process.env): Transport {
  const raw = env.EVENT_BROKER?.trim().toLowerCase();

  if (!raw) {
    // Unset is a configuration mistake in production and a convenience in dev.
    // It is NEVER an instruction to use something weaker in production.
    if (isProduction(env)) {
      throw new BrokerConfigError(
        'EVENT_BROKER is unset and NODE_ENV=production. Set it to `nats` (in-cluster ' +
          'JetStream) or `pubsub` (Google Cloud). Refusing to start rather than fall back ' +
          'to a non-durable transport — that fallback silently dropped events for weeks ' +
          'after the GCP→Azure migration and reported success on every publish.'
      );
    }
    return env.SPARX_DEV_WORKER_ROUTES ? httpFromEnv(env) : { kind: 'log' };
  }

  switch (raw) {
    case 'nats': {
      const url = env.EVENT_BROKER_URL?.trim();
      if (!url) {
        throw new BrokerConfigError(
          'EVENT_BROKER=nats requires EVENT_BROKER_URL (nats://host:4222).'
        );
      }
      // Not `??`: trim() turns a whitespace-only value into '', which is not
      // nullish and would be accepted as a stream name.
      const stream = env.EVENT_BROKER_STREAM?.trim();
      return { kind: 'nats', url, stream: stream && stream.length > 0 ? stream : 'SPARX_EVENTS' };
    }

    case 'pubsub': {
      // The project id is now an ARGUMENT to the pubsub adapter rather than the
      // thing that selects it. Domain code never reads it.
      const projectId = (env.EVENT_BROKER_PROJECT ?? env.GCP_PROJECT_ID)?.trim();
      if (!projectId) {
        throw new BrokerConfigError('EVENT_BROKER=pubsub requires EVENT_BROKER_PROJECT.');
      }
      return { kind: 'pubsub', projectId };
    }

    case 'http': {
      // The old accidental production path, now something you have to ask for
      // by name — and cannot get in production at all.
      if (isProduction(env)) {
        throw new BrokerConfigError(
          'EVENT_BROKER=http is a development transport: it POSTs fire-and-forget to worker ' +
            'endpoints with no queue, no retry and no dead-letter, so an event published while ' +
            'a worker restarts is lost. It is refused under NODE_ENV=production.'
        );
      }
      return httpFromEnv(env);
    }

    case 'log': {
      if (isProduction(env)) {
        throw new BrokerConfigError(
          'EVENT_BROKER=log discards every event and is refused in production.'
        );
      }
      return { kind: 'log' };
    }

    default:
      throw new BrokerConfigError(
        `EVENT_BROKER='${raw}' is not a known transport. Expected one of: nats, pubsub, http, log.`
      );
  }
}

function httpFromEnv(env: NodeJS.ProcessEnv): Transport {
  const raw = env.SPARX_DEV_WORKER_ROUTES;
  if (!raw) return { kind: 'log' };
  try {
    const routes = JSON.parse(raw) as { url: string; events: string[] }[];
    if (!Array.isArray(routes) || routes.length === 0) return { kind: 'log' };
    return { kind: 'http', routes };
  } catch {
    throw new BrokerConfigError('SPARX_DEV_WORKER_ROUTES is not valid JSON.');
  }
}
