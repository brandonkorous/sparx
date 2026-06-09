import { createPublisher, type PublisherLogger } from '@sparx/events';
import { env } from './env.js';

export const pubLogger: PublisherLogger = {
  info: (obj, msg) => console.info(msg ?? '', obj),
  warn: (obj, msg) => console.warn(msg ?? '', obj),
  error: (obj, msg) => console.error(msg ?? '', obj),
};

export const publisher = createPublisher({ projectId: env.GCP_PROJECT_ID, logger: pubLogger });
