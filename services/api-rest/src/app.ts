// Fastify factory. Tests import createApp() to spin up an in-memory instance
// (no listen()); the bootstrap in index.ts wraps it with listen() + signal
// handlers. Keeping the two split is a Fastify convention worth observing.
//
// Shared Fastify primitives (auth, error envelope, db helpers, audit,
// pubsub, content-type validation) live in @sparx/api-core. This service
// composes the factories with its own env config and stays focused on
// REST-only route plumbing. GraphQL is a separate service (api-graphql).

import { randomUUID } from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyServerOptions,
} from 'fastify';
import cookie from '@fastify/cookie';
import { CrmConflictError, CrmNotFoundError, CrmValidationError } from '@sparx/crm';
import {
  SitebuilderConflictError,
  SitebuilderNotFoundError,
  SitebuilderValidationError,
} from '@sparx/sitebuilder';
import { BuilderConflictError, BuilderNotFoundError, BuilderValidationError } from '@sparx/builder';
import {
  CommerceConflictError,
  CommerceNotFoundError,
  CommerceOutOfStockError,
  CommercePricingError,
  CommerceProviderError,
  CommerceValidationError,
} from '@sparx/commerce';
import {
  EmailConflictError,
  EmailNotFoundError,
  EmailProviderError,
  EmailValidationError,
} from '@sparx/email-platform';
import {
  AutomationNotFoundError,
  AutomationVersionNotFoundError,
  LockedAutomationError,
  NoDraftError,
} from '@sparx/automation';
import { createAuthPlugin } from '@sparx/api-core/auth';
import { createErrorsPlugin, type ErrorEnvelope } from '@sparx/api-core/errors-plugin';
import { env } from './env.js';
import openapiPlugin from './plugins/openapi.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import healthRoutes from './routes/health.js';
import domainCheckRoutes from './routes/internal/domain-check.js';
import crmCronRoutes from './routes/internal/crm-cron.js';
import commerceCronRoutes from './routes/internal/commerce-cron.js';
import invoicingCronRoutes from './routes/internal/invoicing-cron.js';
import acquisitionReportRoutes from './routes/internal/acquisition-report.js';
import contentTypeRoutes from './routes/v1/content/types.js';
import entryRoutes from './routes/v1/content/entries.js';
import publishRoutes from './routes/v1/content/publish.js';
import revisionRoutes from './routes/v1/content/revisions.js';
import previewTokenRoutes from './routes/v1/content/preview-tokens.js';
import navigationRoutes from './routes/v1/navigation/menus.js';
import redirectRoutes from './routes/v1/redirects/index.js';
import authorRoutes from './routes/v1/authors/index.js';
import taxonomyRoutes from './routes/v1/taxonomies/index.js';
import webhookRoutes from './routes/v1/webhooks/subscriptions.js';
import stripeBillingWebhookRoutes from './routes/v1/webhooks/stripe-billing.js';
import providerWebhookRoutes from './routes/v1/webhooks/providers.js';
import paymentWebhookRoutes from './routes/v1/webhooks/payments.js';
import sitemapRoutes from './routes/v1/sitemap.js';
import rssRoutes from './routes/v1/rss.js';
import publicContentRoutes from './routes/v1/public/content.js';
import publicCommerceRoutes from './routes/v1/public/commerce.js';
import publicSearchRoutes from './routes/v1/public/search.js';
import publicCartRoutes from './routes/v1/public/cart.js';
import publicCheckoutRoutes from './routes/v1/public/checkout.js';
import publicReviewRoutes from './routes/v1/public/reviews.js';
import publicAccountRoutes from './routes/v1/public/account.js';
import publicSiteSnapshotRoutes from './routes/v1/public/site-snapshot.js';
import publicSiteRoutes from './routes/v1/public/site.js';
import publicBuilderRoutes from './routes/v1/public/builder.js';
import publicMediaRoutes from './routes/v1/public/media.js';
import marketplaceMediaRoutes from './routes/v1/public/marketplace-media.js';
import publicConsentRoutes from './routes/v1/public/consent.js';
import publicSignupRoutes from './routes/v1/public/signup.js';
import publicNewsletterRoutes from './routes/v1/public/newsletter.js';
import publicMarketplaceRoutes from './routes/v1/public/marketplace.js';
import publicRedirectRoutes from './routes/v1/public/redirects.js';
import publicB2bPortalRoutes from './routes/v1/public/b2b-portal.js';
import publicB2bSchedulingRoutes from './routes/v1/public/b2b-scheduling.js';
import uploadRoutes from './routes/v1/media/uploads.js';
import mediaAssetRoutes from './routes/v1/media/assets.js';
import crmRoutes from './routes/v1/crm/index.js';
import invoicingRoutes from './routes/v1/invoicing/index.js';
import b2bRoutes from './routes/v1/b2b/index.js';
import chatRoutes from './routes/v1/chat/index.js';
import publicChatRoutes from './routes/v1/public/chat.js';
import pushRoutes from './routes/v1/push.js';
import sitebuilderRoutes from './routes/v1/sitebuilder/index.js';
import builderRoutes from './routes/v1/builder/index.js';
import commerceRoutes from './routes/v1/commerce/index.js';
import dropshipRoutes from './routes/v1/dropship/index.js';
import inventoryRoutes from './routes/v1/inventory/index.js';
import tenantRoutes from './routes/v1/tenant.js';
import billingRoutes from './routes/v1/billing.js';
import brandRoutes from './routes/v1/brand.js';
import propertiesRoutes from './routes/v1/properties.js';
import blueprintRoutes from './routes/v1/blueprints/index.js';
import marketplaceRoutes from './routes/v1/marketplace/index.js';
import domainsRoutes from './routes/v1/domains.js';
import legalRoutes from './routes/v1/legal.js';
import meRoutes from './routes/v1/me.js';
import userRoutes from './routes/v1/users.js';
import emailTestRoutes from './routes/v1/email/test.js';
import emailRoutes from './routes/v1/email/index.js';
import emailWebhookRoutes from './routes/v1/public/email-webhook.js';
import emailUnsubscribeRoutes from './routes/v1/public/email-unsubscribe.js';
import dashboardRoutes from './routes/v1/dashboard.js';
import searchRoutes from './routes/v1/search.js';
import seoAuditRoutes from './routes/v1/seo/audit.js';
import automationRoutes from './routes/v1/automations/index.js';
import { bootstrapProviders } from './lib/providers-bootstrap.js';
import pretty from 'pino-pretty';

function loggerOptions(): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'development') {
    // pino-pretty as a SYNCHRONOUS in-process stream — NOT a `transport`
    // worker. The worker path runs through thread-stream, which crashes the
    // whole server on boot under Node 24 with an inspector attached
    // ("Error: this should not happen: undefined"). A direct sync stream keeps
    // the colorized dev logs with no worker thread to fall over.
    return {
      level: env.LOG_LEVEL,
      stream: pretty({
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        sync: true,
      }),
    };
  }
  return { level: env.LOG_LEVEL };
}

// CRM service-layer errors share the platform vocabulary (NOT_FOUND /
// VALIDATION_ERROR / CONFLICT) — register them as extra mappers so the
// generic api-core plugin doesn't need to know CRM exists.
function crmErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof CrmNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: err.entityType, entityId: err.entityId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof CrmValidationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof CrmConflictError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        ...(err.field !== undefined ? { details: { field: err.field } } : {}),
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  return undefined;
}

function sitebuilderErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof SitebuilderNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: err.entityType, entityId: err.entityId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof SitebuilderValidationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof SitebuilderConflictError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        ...(err.field !== undefined ? { details: { field: err.field } } : {}),
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  return undefined;
}

// Builder (the docs/40 composition-model editor) service-layer errors — same
// envelope vocabulary as Site Builder. Separate package, separate mapper.
function builderErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof BuilderNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: err.entityType, entityId: err.entityId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof BuilderValidationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof BuilderConflictError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        ...(err.field !== undefined ? { details: { field: err.field } } : {}),
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  return undefined;
}

// Commerce service-layer errors — same envelope vocabulary as CRM (decision
// #7: one error language across modules). Out-of-stock + pricing-error +
// provider-error get distinct codes since the storefront / dashboard have
// specific recovery paths for each.
function commerceErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof CommerceNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: err.entityType, entityId: err.entityId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof CommerceValidationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof CommerceConflictError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        ...(err.field !== undefined ? { details: { field: err.field } } : {}),
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  if (err instanceof CommerceOutOfStockError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'OUT_OF_STOCK',
        message: err.message,
        details: {
          variantId: err.variantId,
          requested: err.requested,
          available: err.available,
        },
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  if (err instanceof CommercePricingError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'PRICING_ERROR',
        message: err.message,
        details: { reason: err.reason, trace: err.trace },
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof CommerceProviderError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: err.message,
        details: {
          providerSlug: err.providerSlug,
          providerErrorCode: err.providerErrorCode,
          retryable: err.retryable,
        },
        request_id: requestId,
      },
    };
    return reply.code(502).send(body);
  }
  return undefined;
}

// Email-platform service-layer errors — same envelope vocabulary as CRM, with
// PROVIDER_ERROR (→ 502) for Mailgun admin failures the tenant should see.
function emailErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof EmailNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: err.entityType, entityId: err.entityId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof EmailValidationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        request_id: requestId,
      },
    };
    return reply.code(422).send(body);
  }
  if (err instanceof EmailConflictError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'CONFLICT',
        message: err.message,
        ...(err.field !== undefined ? { details: { field: err.field } } : {}),
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  if (err instanceof EmailProviderError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: err.message,
        details: { provider: err.provider, ...(err.status ? { status: err.status } : {}) },
        request_id: requestId,
      },
    };
    return reply.code(502).send(body);
  }
  return undefined;
}

// Automation engine service-layer errors. The LOCKED-tier guard is a state
// conflict (the rule is platform-managed) — 409 with a distinct code so the
// dashboard can offer "Duplicate to edit" rather than a generic failure.
function automationErrorMapper(
  err: unknown,
  request: { id: string },
  reply: FastifyReply
): FastifyReply | undefined {
  const requestId = request.id;
  if (err instanceof AutomationNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: { entityType: 'Automation', entityId: err.automationId },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof LockedAutomationError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'AUTOMATION_LOCKED',
        message: err.message,
        details: { automationId: err.automationId },
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  if (err instanceof AutomationVersionNotFoundError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message,
        details: {
          entityType: 'AutomationVersion',
          automationId: err.automationId,
          version: err.version,
        },
        request_id: requestId,
      },
    };
    return reply.code(404).send(body);
  }
  if (err instanceof NoDraftError) {
    // Nothing staged to publish — a state conflict, distinct code so the
    // dashboard can quietly no-op rather than surface a generic error.
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: 'AUTOMATION_NO_DRAFT',
        message: err.message,
        details: { automationId: err.automationId },
        request_id: requestId,
      },
    };
    return reply.code(409).send(body);
  }
  return undefined;
}

export async function createApp(): Promise<FastifyInstance> {
  // Populate the integration-framework registry + wire the SecretReader
  // before any route can call providerService.runPayment*.
  bootstrapProviders();

  const app = Fastify({
    logger: loggerOptions(),
    // Per docs/06-api-specification.md every error response carries a
    // `request_id` of the form `req_<hex>` — Fastify exposes it as
    // `request.id` everywhere once configured here.
    genReqId: () => `req_${randomUUID().replace(/-/g, '')}`,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id',
    // X-Forwarded-* — sparx-prod sits behind Caddy.
    trustProxy: true,
    disableRequestLogging: false,
    bodyLimit: 5 * 1024 * 1024, // 5 MiB — rich-text bodies, not media (those upload direct-to-GCS).
  });

  // Raw-bytes parser for local-mode media uploads. In prod (GCS) the
  // browser PUTs directly to a signed Cloud Storage URL and the bytes
  // never touch api-rest; this parser only fires in dev / test where the
  // local storage backend serves the "presigned" URL itself. Routes that
  // want a Buffer just declare a per-route `bodyLimit` and inspect
  // `request.body`.
  app.addContentTypeParser(
    /^(application\/octet-stream|application\/pdf|image\/.+|video\/.+|audio\/.+)$/,
    { parseAs: 'buffer', bodyLimit: 200 * 1024 * 1024 },
    (_req, body, done) => {
      done(null, body);
    }
  );

  // Order matters: errors → openapi → rate-limit → auth → routes. Error
  // handler must be registered first so it catches anything that throws
  // from the others. OpenAPI must be initialised before routes register so
  // each route's schema is recorded.
  await app.register(
    createErrorsPlugin({
      extraMappers: [
        crmErrorMapper,
        commerceErrorMapper,
        sitebuilderErrorMapper,
        builderErrorMapper,
        emailErrorMapper,
        automationErrorMapper,
      ],
    })
  );
  await app.register(openapiPlugin);
  await app.register(rateLimitPlugin);
  // Cookie support — used by the storefront customer session (httpOnly
  // sparx_customer_session). Unsigned: the session token is already a
  // high-entropy opaque value stored only as a SHA-256 hash server-side.
  await app.register(cookie);
  await app.register(
    createAuthPlugin({
      jwtSecret: env.SPARX_INTERNAL_JWT_SECRET,
      publicPrefixes: [
        '/v1/openapi.json',
        '/v1/sitemap.xml',
        '/v1/public/',
        // Local-mode media upload endpoints — issued by `presignPut` and
        // self-authorising via the in-URL object key. Skipping the Bearer
        // check here mirrors the GCS signed-URL contract.
        '/v1/media/_local/',
      ],
    })
  );

  // Surface request_id on every response (success or failure) so callers
  // logging a 5xx have something to send back to support.
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(healthRoutes);
  await app.register(domainCheckRoutes);
  await app.register(crmCronRoutes);
  await app.register(commerceCronRoutes);
  await app.register(invoicingCronRoutes);
  await app.register(acquisitionReportRoutes);

  // v1 surface. Each route file owns its own URL prefix so this central
  // map is easy to skim. Adding a new route group is a one-line registration.
  await app.register(contentTypeRoutes);
  await app.register(entryRoutes);
  await app.register(publishRoutes);
  await app.register(revisionRoutes);
  await app.register(previewTokenRoutes);
  await app.register(navigationRoutes);
  await app.register(redirectRoutes);
  await app.register(authorRoutes);
  await app.register(taxonomyRoutes);
  await app.register(webhookRoutes);
  await app.register(stripeBillingWebhookRoutes);
  await app.register(providerWebhookRoutes);
  await app.register(paymentWebhookRoutes);
  await app.register(sitemapRoutes);
  await app.register(rssRoutes);
  await app.register(publicContentRoutes);
  await app.register(publicCommerceRoutes);
  await app.register(publicSearchRoutes);
  await app.register(publicCartRoutes);
  await app.register(publicCheckoutRoutes);
  await app.register(publicReviewRoutes);
  await app.register(publicAccountRoutes);
  await app.register(publicB2bPortalRoutes);
  await app.register(publicB2bSchedulingRoutes);
  await app.register(publicSiteSnapshotRoutes);
  await app.register(publicSiteRoutes);
  await app.register(publicBuilderRoutes);
  await app.register(publicMediaRoutes);
  await app.register(marketplaceMediaRoutes);
  await app.register(publicConsentRoutes);
  await app.register(publicSignupRoutes);
  await app.register(publicNewsletterRoutes);
  await app.register(publicMarketplaceRoutes);
  await app.register(publicChatRoutes);
  await app.register(publicRedirectRoutes);
  await app.register(emailWebhookRoutes);
  await app.register(emailUnsubscribeRoutes);
  await app.register(uploadRoutes);
  await app.register(mediaAssetRoutes);
  await app.register(crmRoutes);
  await app.register(invoicingRoutes);
  await app.register(b2bRoutes);
  await app.register(chatRoutes);
  await app.register(pushRoutes);
  await app.register(sitebuilderRoutes);
  await app.register(builderRoutes);
  await app.register(commerceRoutes);
  await app.register(dropshipRoutes);
  await app.register(inventoryRoutes);
  await app.register(tenantRoutes);
  await app.register(billingRoutes);
  await app.register(brandRoutes);
  await app.register(propertiesRoutes);
  await app.register(blueprintRoutes);
  await app.register(marketplaceRoutes);
  await app.register(domainsRoutes);
  await app.register(legalRoutes);
  await app.register(meRoutes);
  await app.register(userRoutes);
  await app.register(emailTestRoutes);
  await app.register(emailRoutes);
  await app.register(dashboardRoutes);
  await app.register(searchRoutes);
  await app.register(seoAuditRoutes);
  await app.register(automationRoutes);

  return app;
}
