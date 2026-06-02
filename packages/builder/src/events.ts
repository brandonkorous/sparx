// Builder Pub/Sub event publisher.
//
// Phase 1 ships a noop-with-logging publisher behind a minimal interface; the
// worker bootstrap swaps in a real Pub/Sub-backed implementation via
// setPublisher(). Tests inject RecordingPublisher and assert emissions. Service
// functions call publishBuilderEvent AFTER their withTenant() transaction
// commits, so a rolled-back write never emits a phantom event. Mirrors
// packages/sitebuilder/src/events.ts.
//
// `builder.page.published` is the meaningful business event — the future
// storefront render path + universal-search projector consume it. Draft saves
// are not events (too frequent, no external consumer).

export interface BuilderEvent {
  tenantId: string;
  topic: BuilderTopic;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  occurredAt?: Date;
}

export type BuilderTopic = 'builder.page.published';

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
