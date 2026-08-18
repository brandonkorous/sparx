// Commerce — per-locale product translations.
//
//   GET    /v1/commerce/products/:productId/translations          → list every locale
//   GET    /v1/commerce/products/:productId/translations/:locale  → fetch one locale
//   PUT    /v1/commerce/products/:productId/translations/:locale  → create or replace one locale
//   POST   /v1/commerce/products/:productId/translations/bulk     → save every locale at once
//   DELETE /v1/commerce/products/:productId/translations/:locale  → drop one locale
//
// Translations are a sub-resource of the product, so they live under the
// product path and share its module gate + role guards: reading copy is a
// `viewer` action, authoring it is an `editor` action.
//
// PUT is the single-locale verb (not PATCH) because the service stores the
// payload as the whole row for that locale — omitted optional fields are
// cleared. Repeating the same PUT is idempotent, so it answers 200 on both
// create and replace rather than splitting into a 201.
//
// Routes are intentionally thin — the service owns Zod validation, locale
// canonicalization, audit logs, and event publishing. Transport handles
// auth, module gate, envelope.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { productTranslationService } from '@wizeworks/commerce';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { validationError } from '@wizeworks/api-core/errors';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const ProductIdParam = z.object({ productId: z.string().uuid() });

// The locale segment is only length-checked here; the service parses it
// against the BCP-47 schema and canonicalizes the casing, so `EN-us` and
// `en-US` address the same row from either transport.
const TranslationParams = z.object({
  productId: z.string().uuid(),
  locale: z.string().min(2).max(10),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const productTranslationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/commerce/products/:productId/translations', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    return ok(
      await productTranslationService.listForProduct(toCommerceContext(request), productId)
    );
  });

  // Static `bulk` segment is declared before `:locale` for readability; the
  // router matches static segments first regardless of declaration order, so
  // `bulk` can never be swallowed as a locale (and wouldn't parse as one).
  app.post('/v1/commerce/products/:productId/translations/bulk', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    return ok(
      await productTranslationService.bulkUpsert(
        toCommerceContext(request),
        productId,
        request.body
      )
    );
  });

  app.get('/v1/commerce/products/:productId/translations/:locale', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId, locale } = TranslationParams.parse(request.params);
    return ok(await productTranslationService.get(toCommerceContext(request), productId, locale));
  });

  app.put('/v1/commerce/products/:productId/translations/:locale', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { productId, locale } = TranslationParams.parse(request.params);
    const body = (request.body ?? {}) as Record<string, unknown>;

    // The path is authoritative. A body that names a DIFFERENT locale is a
    // client bug that would otherwise write the copy to the wrong language
    // and answer 200, so reject it rather than silently picking a winner.
    // Compared case-insensitively so `en-US` in the path and `EN-us` in the
    // body — which the service canonicalizes to the same tag — don't 422.
    const bodyLocale = body.locale;
    if (
      bodyLocale !== undefined &&
      (typeof bodyLocale !== 'string' || bodyLocale.toLowerCase() !== locale.toLowerCase())
    ) {
      // JSON.stringify, not String() — `locale` may be any JSON value here, and
      // an object would otherwise render as "[object Object]" in the message.
      throw validationError(
        `Body locale ${JSON.stringify(bodyLocale)} does not match path locale "${locale}"`,
        [{ field: 'locale', message: `Expected "${locale}" to match the request path` }]
      );
    }

    return ok(
      await productTranslationService.upsert(toCommerceContext(request), productId, {
        ...body,
        locale,
      })
    );
  });

  app.delete('/v1/commerce/products/:productId/translations/:locale', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { productId, locale } = TranslationParams.parse(request.params);
    await productTranslationService.remove(toCommerceContext(request), productId, locale);
    reply.code(204);
  });
};

export default productTranslationRoutes;
