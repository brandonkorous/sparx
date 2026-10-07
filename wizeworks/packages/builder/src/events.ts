// Builder Pub/Sub event publisher.
//
// Phase 1 ships a noop-with-logging publisher behind a minimal interface; the
// worker bootstrap swaps in a real Pub/Sub-backed implementation via
// setPublisher(). Tests inject RecordingPublisher and assert emissions. Service
// functions call publishBuilderEvent AFTER their withTenant() transaction
// commits, so a rolled-back write never emits a phantom event. Mirrors
// wizeworks/packages/sitebuilder/src/events.ts.
//
// `builder.page.published` / `builder.layout.published` / `builder.layout.activated`
// / `builder.theme.published` are the meaningful business events: each changes what
// the live site serves, so `cache-revalidation-worker` purges the site's `builder:`
// cache on every one. Draft saves are not events (too frequent, no external
// consumer).
//
// They reach the broker through `installBuilderPubSubBridge` (api-rest boots it),
// so each is a member of the platform `EventType` union too; the assertion below
// stops a new topic being added here and not there. The purge worker subscribed
// to none of the four until 2026-10-06 (persona issue 921): a header, footer,
// single page or look published from its own pane reached visitors only when
// the five-minute cache ran out.

import type { EventType } from '@wizeworks/events';

export interface BuilderEvent {
  tenantId: string;
  topic: BuilderTopic;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  occurredAt?: Date;
}

export type BuilderTopic =
  | 'builder.page.published'
  | 'builder.layout.published'
  | 'builder.layout.activated'
  | 'builder.theme.published'
  | 'builder.page.settings.changed'
  | 'builder.email.published';

// Fails to compile when a topic above is missing from `EventType`.
type Assert<T extends true> = T;
export type BuilderTopicsAreEvents = Assert<BuilderTopic extends EventType ? true : false>;

export interface Publisher {
  publish(event: BuilderEvent): Promise<void>;
}

class LoggingPublisher implements Publisher {
  publish(event: BuilderEvent): Promise<void> {
    console.log(
      '[builder-event]',
      JSON.stringify({
        tenantId: event.tenantId,
        topic: event.topic,
        payload: event.payload,
        dedupeKey: event.dedupeKey,
        occurredAt: (event.occurredAt ?? new Date()).toISOString(),
      })
    );
    return Promise.resolve();
  }
}

let activePublisher: Publisher = new LoggingPublisher();

export function setPublisher(publisher: Publisher): void {
  activePublisher = publisher;
}

export function getPublisher(): Publisher {
  return activePublisher;
}

export async function publishBuilderEvent(event: BuilderEvent): Promise<void> {
  await activePublisher.publish(event);
}

export class RecordingPublisher implements Publisher {
  readonly events: BuilderEvent[] = [];
  publish(event: BuilderEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
  clear(): void {
    this.events.length = 0;
  }
}
