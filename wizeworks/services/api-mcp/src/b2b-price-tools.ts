// What one business on account pays for one product version, for an AI client.
//
// The REST route `GET /v1/b2b/resolve-price` and this tool are the same call:
// commerce's `pricingService.resolveForAccount`, which goes through the engine
// checkout charges with (a signed agreement first, then the account's and its
// group's prices, then price lists and bulk prices) and says which rule set the
// price in a sentence.
//
// It lives here rather than in `@wizeworks/b2b/mcp` because the answer belongs
// to commerce and the b2b package does not carry commerce (same reasoning as
// `purchase-order-tools.ts`). The version that lived in the b2b package called
// `resolve_b2b_price()` directly, which never reads a signed agreement, while
// its description promised that it did (sparx persona issue 077). Its scope is
// still `read:b2b`, so it is still gated on the b2b module in server.ts.

import { z } from 'zod';
import { pricingService } from '@wizeworks/commerce';

interface Ctx {
  tenantId: string;
  userId: string;
}

const resolveB2bPriceTool = {
  name: 'resolve_b2b_price',
  description:
    'What ONE wholesale account pays for ONE product version, exactly as checkout would charge it: a signed agreement wins while it runs, then the account\'s own price, its group\'s price or discount, then price lists and bulk prices. Returns listPriceCents, effectivePriceCents, the kind of rule that set it, and `words`, a sentence for the customer such as "Fleet price: 12% off $600.00" (null when the list price applies). Pass quantity for bulk prices.',
  scope: 'read:b2b' as const,
  confirmation: false,
  input: z.object({
    variantId: z.string().uuid(),
    accountId: z.string().uuid(),
    quantity: z.number().int().positive().max(100_000).optional(),
  }),
  run(ctx: Ctx, input: { variantId: string; accountId: string; quantity?: number }) {
    return pricingService.resolveForAccount(
      { tenantId: ctx.tenantId, userId: ctx.userId },
      {
        variantId: input.variantId,
        accountId: input.accountId,
        ...(input.quantity ? { quantity: input.quantity } : {}),
      }
    );
  },
};

export const b2bPriceMcpTools = [resolveB2bPriceTool];
