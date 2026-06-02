// Builder Pub/Sub event publisher.
//
// Phase 1 ships a noop-with-logging publisher behind a minimal interface; the
// worker bootstrap swaps in a real Pub/Sub-backed implementation via
// setPublisher(). Tests inject RecordingPublisher and assert emissions. Service
// functions call publishBuilderEvent AFTER their withTenant() transaction
// commits, so a rolled-back write never emits a phantom event. Mirrors
// packages/sitebuilder/src/events.ts.
//
// `builder.page.published` / `builder.layout.published` / `builder.layout.activated`
// are the meaningful business events — the storefront render path consumes them (a
// published page, or activating a different published layout, changes what the
// live store serves). Draft saves are not events (too frequent, no external
// consumer).

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
  | 'builder.layout.activated';

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
