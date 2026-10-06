// savedCartService: a trade account's named saved carts, and the lines of a
// past order for "Order again" (sparx persona issue 086).
//
// The /b2b page promised "Accounts keep named saved carts and reorder a past
// order in a click", and neither existed. A saved cart is a NAMED LIST kept for
// the ACCOUNT: any of its contacts who can order sees and uses it, and it is
// never a second live cart. It keeps no prices: loading it goes back through
// add-to-cart (`cartRefillService`), which prices every line today.
//
// ISOLATION. Every read and write is scoped by the account id it is handed, and
// the route hands only an account the signed-in contact belongs to. A saved cart
// id from another account finds nothing here, the same as one that never
// existed. A past order is read only when one of the given people placed it.

import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import type { RefillLine } from './cart-refill-service';

/** The most lines one saved cart keeps; a cart longer than this is unusual
 *  enough that a refusal in words beats a silent truncation. */
export const SAVED_CART_LINE_LIMIT = 200;
export const SAVED_CART_NAME_MAX = 120;

export interface SavedCartActor {
  accountId: string;
  customerId: string;
}

export interface SavedCartView {
  id: string;
  name: string;
  /** How many different items. */
  itemCount: number;
  /** How many units, across every item. */
  unitCount: number;
  /** Who saved it, by name, or null when they have since left the account. */
  savedBy: string | null;
  savedAt: string;
  updatedAt: string;
}

/** The account's saved carts, and only that account's. */
export function savedCartsWhere(accountId: string) {
  return { companyId: accountId } as const;
}

const SAVED_CART_INCLUDE = {
  createdBy: { select: { firstName: true, lastName: true, email: true } },
  items: {
    orderBy: { position: 'asc' },
    select: {
      variantId: true,
      quantity: true,
      position: true,
      variant: { select: { title: true, product: { select: { title: true } } } },
    },
  },
} satisfies Prisma.B2bSavedCartInclude;

type SavedCartRow = Prisma.B2bSavedCartGetPayload<{ include: typeof SAVED_CART_INCLUDE }>;

function personName(
  who: { firstName: string | null; lastName: string | null; email: string | null } | null
): string | null {
  if (!who) return null;
  const name = [who.firstName, who.lastName].filter(Boolean).join(' ').trim();
  return name === '' ? who.email : name;
}

/** How the catalog names an item: the product, then its option when it has one. */
export function itemName(
  variant: { title: string | null; product: { title: string } } | null
): string {
  if (!variant) return 'An item no longer in the catalog';
  const option = variant.title?.trim();
  return option && option !== 'Default' && option !== 'Default Title'
    ? `${variant.product.title}, ${option}`
    : variant.product.title;
}

function toView(row: SavedCartRow): SavedCartView {
  return {
    id: row.id,
    name: row.name,
    itemCount: row.items.length,
    unitCount: row.items.reduce((sum, i) => sum + i.quantity, 0),
    savedBy: personName(row.createdBy),
    savedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') throw new CommerceValidationError('Give this saved cart a name.');
  if (trimmed.length > SAVED_CART_NAME_MAX) {
    throw new CommerceValidationError(
      `A saved cart's name can be up to ${SAVED_CART_NAME_MAX} characters.`
    );
  }
  return trimmed;
}

export async function list(ctx: ServiceContext, accountId: string): Promise<SavedCartView[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.b2bSavedCart.findMany({
      where: savedCartsWhere(accountId),
      include: SAVED_CART_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
  );
  return rows.map(toView);
}

/** Save what is in a cart under a name. The route has already checked the cart
 *  is the caller's own (its token). Two lines of one item are kept as one. */
export async function saveFromCart(
  ctx: ServiceContext,
  actor: SavedCartActor,
  input: { cartId: string; name: string }
): Promise<SavedCartView> {
  const name = cleanName(input.name);
  return withTenant(ctx, async (tx) => {
    const lines = await tx.cartItem.findMany({
      where: { cartId: input.cartId },
      select: { variantId: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    });
    const byVariant = new Map<string, number>();
    for (const l of lines)
      byVariant.set(l.variantId, (byVariant.get(l.variantId) ?? 0) + l.quantity);
    if (byVariant.size === 0) {
      throw new CommerceValidationError('The cart is empty, so there is nothing to save.');
    }
    if (byVariant.size > SAVED_CART_LINE_LIMIT) {
      throw new CommerceValidationError(
        `A saved cart can keep up to ${SAVED_CART_LINE_LIMIT} items, and this cart has ${byVariant.size}.`
      );
    }
    const created = await tx.b2bSavedCart.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: actor.accountId,
        name,
        createdByCustomerId: actor.customerId,
        items: {
          create: [...byVariant.entries()].map(([variantId, quantity], position) => ({
            tenantId: ctx.tenantId,
            variantId,
            quantity,
            position,
          })),
        },
      },
      select: { id: true },
    });
    const row = await tx.b2bSavedCart.findFirst({
      where: { id: created.id, ...savedCartsWhere(actor.accountId) },
      include: SAVED_CART_INCLUDE,
    });
    if (!row) throw new CommerceNotFoundError('SavedCart', created.id);
    return toView(row);
  });
}

export async function rename(
  ctx: ServiceContext,
  accountId: string,
  savedCartId: string,
  name: string
): Promise<void> {
  const clean = cleanName(name);
  const { count } = await withTenant(ctx, (tx) =>
    tx.b2bSavedCart.updateMany({
      where: { id: savedCartId, ...savedCartsWhere(accountId) },
      data: { name: clean, updatedAt: new Date() },
    })
  );
  if (count === 0) throw new CommerceNotFoundError('SavedCart', savedCartId);
}

export async function remove(
  ctx: ServiceContext,
  accountId: string,
  savedCartId: string
): Promise<void> {
  const { count } = await withTenant(ctx, (tx) =>
    tx.b2bSavedCart.deleteMany({ where: { id: savedCartId, ...savedCartsWhere(accountId) } })
  );
  if (count === 0) throw new CommerceNotFoundError('SavedCart', savedCartId);
}

/** A saved cart's lines, named, for `cartRefillService.refillCart`. Null when
 *  the account has no such saved cart. */
export async function linesFor(
  ctx: ServiceContext,
  accountId: string,
  savedCartId: string
): Promise<RefillLine[] | null> {
  const row = await withTenant(ctx, (tx) =>
    tx.b2bSavedCart.findFirst({
      where: { id: savedCartId, ...savedCartsWhere(accountId) },
      include: SAVED_CART_INCLUDE,
    })
  );
  if (!row) return null;
  return row.items.map((i) => ({
    variantId: i.variantId,
    quantity: i.quantity,
    name: itemName(i.variant),
  }));
}

/** A past order's lines, by the names they were bought under, for "Order
 *  again". Read only when one of `customerIds` placed it: the route passes the
 *  signed-in customer, or the contacts of an account they may order on. Null
 *  otherwise, the same as an order that does not exist. */
export async function orderLinesFor(
  ctx: ServiceContext,
  orderId: string,
  customerIds: readonly string[]
): Promise<RefillLine[] | null> {
  if (customerIds.length === 0) return null;
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { id: orderId, customerId: { in: [...customerIds] } },
      select: {
        id: true,
        items: {
          select: { variantId: true, quantity: true, name: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  );
  if (!order) return null;
  return order.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, name: i.name }));
}
