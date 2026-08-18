import { createPublisher, type PublisherLogger } from '@wizeworks/events';

export const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

export const publisher = createPublisher({ logger: pubLogger });
