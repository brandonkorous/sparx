export type {
  EventType,
  SparxEvent,
  DomainPurchasedPayload,
  EmailSendPayload,
  RawEmailSendPayload,
  SearchEntityChangedPayload,
  TenantCreatedPayload,
  TenantUpdatedPayload,
  TenantSubscriptionChangedPayload,
  FeedbackSubmittedPayload,
  FeedbackRespondedPayload,
  FormSubmittedPayload,
} from './types';
export {
  createPublisher,
  publishEvent,
  publishRaw,
  localDispatchFromEnv,
  _resetPublisherForTest,
  type Publisher,
  type PublisherLogger,
  type CreatePublisherOptions,
  type DevWorkerRoute,
} from './publisher';
export { indexEntity, type IndexEntityInput } from './index-entity';
export {
  AUTOMATION_FANIN_TOPIC,
  teeToFanIn,
  buildFanIn,
  type FanInEnvelope,
  type FanInMessage,
} from './fan-in';
// Transport selection. Exported so a service can resolve it at BOOT and fail
// fast, rather than discovering a misconfigured broker on the first event it
// tries to publish — by which point the request that produced it has returned.
export {
  resolveTransport,
  isDurable,
  BrokerConfigError,
  type BrokerKind,
  type Transport,
} from './transport';
export { NatsJetStreamPublisher, subjectFor, SUBJECT_PREFIX } from './transports/nats';
export {
  startConsumer,
  createBrokerHandler,
  type ConsumerOptions,
  type RunningConsumer,
  type WorkerSubscription,
} from './consumer';
