// B2B purchase approval — rule configuration + the approval queue (docs/10 §12,
// docs/64 B2B Ph6). Extracted from the api-rest routes.
//
// Approval rules gate B2B portal orders above a configured threshold: an order
// that trips a rule at checkout parks in `pending_approval`; staff approve (→ the
// order places, stock commits, a net-terms AR document is issued) or reject (→ the
// order cancels). The mutating transitions COMMIT then ask their caller to publish
// the resulting domain events — the service stays free of publisher plumbing so it
// runs identically under REST (`request.log` publisher) and MCP (a createPublisher
// from @wizeworks/events, matching the other api-mcp tool registries).

import { z } from 'zod';
import { nameSearchClauses, withTenant, type Prisma } from '@wizeworks/db';
import { forbidden, notFound, validationError } from '@wizeworks/api-core/errors';
import { isModuleEnabled } from '@wizeworks/auth';
import {
  accountOrderGate,
  b2bArService,
  heldOrderMoney,
  poNumberOf,
  taskService,
} from '@wizeworks/crm';
import { inventoryService, type CommittedSale, type OrderStockOutcome } from '@wizeworks/inventory';
import type { B2bContext } from './context.js';
import type { PendingEvent } from './events.js';

// ── Schemas (shared with the REST routes) ─────────────────────────────────────

/** Who signs off an order a limit holds (sparx persona issue 087): the
 *  business's own team, or the account's own approvers. */
export const SignOffBy = z.enum(['business', 'account']);

export const ApprovalRuleBody = z.object({
  accountId: z.string().uuid().nullable().optional(),
  // The site this spending control applies to (docs/131 §4). Explicit null = it
  // applies everywhere the tenant sells; omitted = the caller's default site.
  propertyId: z.string().uuid().nullable().optional(),
  minAmountCents: z.number().int().min(0),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  signOffBy: SignOffBy.optional(),
  isActive: z.boolean().optional(),
});

export const ApprovalRulePatchBody = z.object({
  minAmountCents: z.number().int().min(0).optional(),
  requiredApproverUserId: z.string().uuid().nullable().optional(),
  signOffBy: SignOffBy.optional(),
  isActive: z.boolean().optional(),
});

export const ApprovalQueueQuery = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  account_id: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const ApproveBody = z.object({ reason: z.string().max(1000).optional() });
export const RejectBody = z.object({ reason: z.string().max(1000).optional() });

/** What a contact at the account sends to approve or turn down an order. */
export const AccountDecisionBody = z.object({ reason: z.string().trim().max(1000).optional() });

export type ApprovalRuleInput = z.infer<typeof ApprovalRuleBody>;
export type ApprovalRulePatchInput = z.infer<typeof ApprovalRulePatchBody>;
export type ApprovalQueueInput = z.infer<typeof ApprovalQueueQuery>;

// ── View mappers ──────────────────────────────────────────────────────────────

/**
 * A spending limit, written the way a person reads it.
 *
 * This was `$${(cents / 100).toFixed(2)}`, which prints a five-figure limit as
 * "$5000.00" — no separator on the one figure a reader has to count. 38 of the
 * 42 approval rules on the platform are five figures, so it has never once read
 * correctly, and it sits directly under a sentence about when orders get held.
 *
 * Built once, not per row: constructing an `Intl.NumberFormat` is the expensive
 * half and this runs inside a list response. Pinned to `en-US` because this is a
 * SERVER-rendered string and the container's locale is a coin toss, not a
 * reader's preference. The currency is hardcoded for now because a rule carries
 * a `minAmountCents` and no currency of its own; the same shape as before, but
 * now it is a stated gap rather than a buried one.
 */
const LIMIT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function toRuleView(
  rule: {
    id: string;
    accountId: string | null;
    propertyId: string | null;
    minAmountCents: number;
    requiredApproverUserId: string | null;
    signOffBy: string;
    isActive: boolean;
    createdAt: Date;
    account?: { id: string; companyName: string } | null;
    requiredApprover?: { id: string; name: string | null; email: string } | null;
  },
  approvers: ReadonlyMap<string, accountOrderGate.AccountApprover[]>
) {
  return {
    id: rule.id,
    accountId: rule.accountId,
    accountName: rule.account?.companyName ?? null,
    // null renders as "All sites" — an operator must see at a glance that a
    // threshold reaches businesses other than the one they're looking at.
    propertyId: rule.propertyId,
    minAmountCents: rule.minAmountCents,
    minAmountFormatted: LIMIT.format(rule.minAmountCents / 100),
    requiredApproverUserId: rule.requiredApproverUserId,
    requiredApproverName: rule.requiredApprover?.name ?? rule.requiredApprover?.email ?? null,
    signOffBy: rule.signOffBy === 'account' ? ('account' as const) : ('business' as const),
    // Who at the account signs when it signs, for a rule about ONE account:
    // empty means nobody can, and the business's team signs instead. Null for a
    // rule covering every account, where it differs account by account.
    accountApprovers: rule.accountId
      ? (approvers.get(rule.accountId) ?? []).map(({ customerId, name, email }) => ({
          customerId,
          name,
          email,
        }))
      : null,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
  };
}

/** The approvers on each of these accounts, in one query. */
async function approversByAccount(
  tx: Prisma.TransactionClient,
  accountIds: readonly (string | null)[]
): Promise<Map<string, accountOrderGate.AccountApprover[]>> {
  const ids = [...new Set(accountIds.filter((id): id is string => id !== null))];
  const out = new Map<string, accountOrderGate.AccountApprover[]>();
  if (ids.length === 0) return out;
  const rows = await tx.b2bAccountContact.findMany({
    where: { accountId: { in: ids }, isActive: true, role: 'approver' },
    orderBy: { createdAt: 'asc' },
    select: {
      accountId: true,
      customerId: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  for (const row of rows) {
    const list = out.get(row.accountId) ?? [];
    list.push({
      customerId: row.customerId,
      name: accountOrderGate.signerName(row.customer),
      email: row.customer.email ?? null,
    });
    out.set(row.accountId, list);
  }
  return out;
}

export type ApprovalRuleView = ReturnType<typeof toRuleView>;

const RULE_INCLUDE = {
  account: { select: { id: true, companyName: true } },
  requiredApprover: { select: { id: true, name: true, email: true } },
} as const;

// ── Which rule governs an order ───────────────────────────────────────────────

/**
 * The one rule that holds a given order, out of every active rule. It lives
 * beside the hold itself in `account-order-gate.ts`, because checkout and an
 * accepted quote now have to know which rule held an order too: the rule says
 * who is asked to sign it (sparx persona issue 087).
 */
export function ruleGoverningOrder<T extends accountOrderGate.GoverningRuleFields>(
  order: { accountId: string | null; propertyId: string | null; totalCents: number },
  rules: readonly T[]
): T | null {
  return accountOrderGate.ruleGoverningOrder(order, rules);
}

/**
 * Refuse a decision the governing rule did not ask this person for.
 *
 * The inventory twin has said this since it shipped: "A named approver is a
 * named approver. Anyone else signing would make the rule decorative, and the
 * trail would record a signature the rule did not ask for." This half of the
 * product stored the name, printed it on the rule as "Nadia Osei signs off",
 * and let any editor sign — so the sentence was decorative here and binding
 * there, in one product, on two screens that do the same job.
 *
 * REJECTING is gated too. A rejection cancels a customer's order; "anybody may
 * refuse it" is the same hole wearing the other outcome.
 */
export function approverRefusal(
  userId: string | null | undefined,
  rule: {
    requiredApproverUserId: string | null;
    requiredApprover?: { name: string | null; email: string } | null;
  } | null
): string | null {
  if (!rule?.requiredApproverUserId) return null;
  if (rule.requiredApproverUserId === userId) return null;
  const who = rule.requiredApprover?.name ?? rule.requiredApprover?.email ?? null;
  return who
    ? `This order has to be signed off by ${who}.`
    : 'This order has to be signed off by the person named on the rule that held it.';
}

function assertNamedApprover(ctx: B2bContext, rule: Parameters<typeof approverRefusal>[1]): void {
  const refusal = approverRefusal(ctx.userId, rule);
  if (refusal) throw forbidden(refusal);
}

// ── Rules ──────────────────────────────────────────────────────────────────────

export async function listRules(ctx: B2bContext): Promise<{ rules: ApprovalRuleView[] }> {
  const { rules, approvers } = await withTenant(ctx, async (tx) => {
    const rules = await tx.purchaseApprovalRule.findMany({
      where: { tenantId: ctx.tenantId },
      include: RULE_INCLUDE,
      orderBy: [{ accountId: 'asc' }, { createdAt: 'desc' }],
    });
    return {
      rules,
      approvers: await approversByAccount(
        tx,
        rules.map((r) => r.accountId)
      ),
    };
  });
  return { rules: rules.map((rule) => toRuleView(rule, approvers)) };
}

/**
 * Who signs a rule, from what was sent. Naming a teammate means the business
 * signs, so it switches an account-signed rule back; a rule the account signs
 * names nobody on the team. Asking for both at once is refused rather than
 * guessed at, because either guess changes who can release a customer's order.
 */
function signOffFields(body: {
  signOffBy?: 'business' | 'account' | undefined;
  requiredApproverUserId?: string | null | undefined;
}): { signOffBy?: 'business' | 'account'; requiredApproverUserId?: string | null } {
  if (body.signOffBy === 'account') {
    if (body.requiredApproverUserId) {
      throw validationError(
        'A limit their own approvers sign off cannot also name someone on your team.',
        [{ field: 'requiredApproverUserId', message: 'Leave this empty, or pick your team.' }]
      );
    }
    return { signOffBy: 'account', requiredApproverUserId: null };
  }
  if (body.requiredApproverUserId) {
    return { signOffBy: 'business', requiredApproverUserId: body.requiredApproverUserId };
  }
  return {
    ...(body.signOffBy !== undefined ? { signOffBy: body.signOffBy } : {}),
    ...(body.requiredApproverUserId !== undefined
      ? { requiredApproverUserId: body.requiredApproverUserId }
      : {}),
  };
}

/**
 * Create a spending-approval rule. `defaultPropertyId` is the caller's active
 * site — used when the body omits `propertyId` entirely; an EXPLICIT null makes
 * the rule apply everywhere. Defaulting the other way would silently gate
 * checkout on businesses the author wasn't thinking about (docs/131 §4).
 */
/**
 * A rule can only name somebody who is in this account and can sign in.
 *
 * `approveOrder` and `rejectOrder` now refuse everyone but the named person,
 * so naming a stranger, somebody from another business, or an invitation nobody
 * has answered would hold every order the rule catches with nobody able to
 * release it. Refused at save, where it can be fixed, rather than found later
 * as a customer's order nobody can move. The spending limits on orders TO
 * suppliers carry the same check.
 */
async function assertApproverIsTeammate(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string | null
): Promise<void> {
  if (!userId) return;
  const member = await tx.member.findFirst({
    where: { organizationId: tenantId, userId, status: 'active' },
    select: { id: true },
  });
  if (!member) {
    throw validationError('Only someone who is already on your team can be named to sign off.', [
      { field: 'requiredApproverUserId', message: 'Pick someone from your team.' },
    ]);
  }
}

export async function createRule(
  ctx: B2bContext,
  rawInput: unknown,
  defaultPropertyId: string
): Promise<ApprovalRuleView> {
  const body = ApprovalRuleBody.parse(rawInput);

  const rule = await withTenant(ctx, async (tx) => {
    if (body.accountId) {
      const account = await tx.company.findFirst({
        where: { id: body.accountId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!account) throw notFound('B2B account not found');
    }
    const signer = signOffFields(body);
    await assertApproverIsTeammate(tx, ctx.tenantId, signer.requiredApproverUserId ?? null);

    const created = await tx.purchaseApprovalRule.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: body.accountId ?? null,
        propertyId: body.propertyId === undefined ? defaultPropertyId : body.propertyId,
        minAmountCents: body.minAmountCents,
        requiredApproverUserId: signer.requiredApproverUserId ?? null,
        signOffBy: signer.signOffBy ?? 'business',
        isActive: body.isActive ?? true,
      },
      include: RULE_INCLUDE,
    });
    return { created, approvers: await approversByAccount(tx, [created.accountId]) };
  });

  return toRuleView(rule.created, rule.approvers);
}

export async function updateRule(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<ApprovalRuleView> {
  const body = ApprovalRulePatchBody.parse(rawInput);

  const rule = await withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseApprovalRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw notFound('Approval rule not found');
    const signer = signOffFields(body);
    await assertApproverIsTeammate(tx, ctx.tenantId, signer.requiredApproverUserId ?? null);

    const updated = await tx.purchaseApprovalRule.update({
      where: { id },
      data: {
        ...(body.minAmountCents !== undefined ? { minAmountCents: body.minAmountCents } : {}),
        ...signer,
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
      include: RULE_INCLUDE,
    });
    return { updated, approvers: await approversByAccount(tx, [updated.accountId]) };
  });

  return toRuleView(rule.updated, rule.approvers);
}

/**
 * Remove a rule.
 *
 * This used to set `isActive = false` and call itself a soft delete "preserving
 * its audit history". It preserved nothing: nothing in the schema points at a
 * rule id, and an approval decision is logged as a `CrmActivity` row naming the
 * ORDER, not the rule that held it. What the soft delete actually did was make
 * the bin and the on/off switch beside it the same button, one of which said
 * something else.
 *
 * MEASURED 2026-09-20. A $2,500 limit was added through the console, removed
 * through its own bin with a confirm that read "No order from Loom and Larder
 * will be held for sign-off again", and the row came straight back on the list
 * marked Off. In the database: `is_active = f`, still there. `listRules`
 * returns every rule whatever its switch, so a limit could never leave the
 * screen, and 38 of the 43 rules on this machine sit switched off with no way
 * to clear any of them. [[feedback_a_promise_in_copy_is_a_contract]]
 *
 * The same feature for buying (`deletePoApprovalRule`, purchase-order spending
 * limits) has really deleted its rows since the day it was written, and writes
 * an audit row while doing it. Two spellings of one idea, and only one of them
 * kept its word. [[feedback_a_fix_leaves_its_neighbour_behind]]
 *
 * Switching a limit off is still there and is still the reversible option; it
 * is the PATCH above.
 */
export async function deleteRule(ctx: B2bContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseApprovalRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw notFound('Approval rule not found');
    await tx.purchaseApprovalRule.delete({ where: { id } });
  });
}

// ── Approval queue ───────────────────────────────────────────────────────────

/** Why a queued order is waiting, as the console shows it. A spending limit is
 *  named by its amount (null when the rule has since been deleted); the credit
 *  reason carries both figures. An order held before this was recorded has
 *  none, and the console says nothing rather than guessing. */
export type QueueHoldReason =
  | { kind: 'approval_rule'; limitCents: number | null }
  | Extract<accountOrderGate.HoldReason, { kind: 'over_credit_limit' }>;

/** Where a held order's sign-off stands, as the console and the site show it:
 *  who has to say yes, who already has, and who at the account may sign. */
export interface SignOffView {
  needs: accountOrderGate.SignOffSide[];
  waitingOn: accountOrderGate.SignOffSide[];
  signed: Partial<Record<accountOrderGate.SignOffSide, { name: string; at: string }>>;
  /** Who at the account may sign. Empty unless the account is asked. */
  accountApprovers: { customerId: string; name: string; email: string | null }[];
}

export function queueSignOff(
  state: accountOrderGate.SignOffState,
  approvers: readonly accountOrderGate.AccountApprover[]
): SignOffView {
  const signed: SignOffView['signed'] = {};
  for (const side of state.needs) {
    const signature = state.signed[side];
    if (signature) signed[side] = { name: signature.name, at: signature.at };
  }
  return {
    needs: state.needs,
    waitingOn: state.waitingOn,
    signed,
    accountApprovers: state.needs.includes('account')
      ? approvers.map(({ customerId, name, email }) => ({ customerId, name, email }))
      : [],
  };
}

export async function listQueue(ctx: B2bContext, input: ApprovalQueueInput) {
  // `status: 'pending_approval'` is set only by the checkout approval gate, which
  // only fires for an active B2B account. B2B orders place through the same
  // storefront checkout (channel='storefront'), so no channel filter is applied.
  const where: Prisma.OrderWhereInput = {
    tenantId: ctx.tenantId,
    status: 'pending_approval',
    ...(input.account_id ? { customer: { companyId: input.account_id } } : {}),
    // Every typed word must land somewhere, so a buyer's full name finds their
    // order waiting for approval. See `nameSearchClauses`.
    AND: nameSearchClauses(input.q, (term) => [
      { orderNumber: { contains: term, mode: 'insensitive' as const } },
      { customer: { firstName: { contains: term, mode: 'insensitive' as const } } },
      { customer: { lastName: { contains: term, mode: 'insensitive' as const } } },
      { customer: { email: { contains: term, mode: 'insensitive' as const } } },
      { customer: { company: { companyName: { contains: term, mode: 'insensitive' as const } } } },
    ]),
  };

  const { orders, total, accounts, limits, activeRules, approvers } = await withTenant(
    ctx,
    async (tx) => {
      const [orders, total] = await Promise.all([
        tx.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            createdAt: true,
            // The site and the rule's other facts, to work out who signs it.
            propertyId: true,
            // Why it is waiting (`account-order-gate.ts`), so the person signing
            // can see whether it is over a spending limit, over the account's
            // credit, or both (sparx persona issue 085).
            metadata: true,
            customer: {
              // NOT `company: { select: … }`. The Prisma client publishes a
              // computed `company` on customer (the typed employer string), and
              // the computed one wins — so that join came back null on every row
              // and this queue has never named a business (issue 751). The name
              // is fetched below, in one query for the page.
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                companyId: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
          take: input.take,
          skip: input.skip,
        }),
        tx.order.count({ where }),
      ]);
      // One query for the page, keyed by id. A lookup per row would be an N+1
      // on a screen whose whole job is a queue.
      const accountIds = [
        ...new Set(
          orders
            .map((o) => o.customer.companyId)
            .filter((id): id is string => id !== null && id !== undefined)
        ),
      ];
      const accounts =
        accountIds.length === 0
          ? []
          : await tx.company.findMany({
              where: { id: { in: accountIds } },
              select: { id: true, companyName: true },
            });
      // The spending limits the page's held orders name, in one query.
      const ruleIds = [
        ...new Set(
          orders.flatMap((o) =>
            accountOrderGate
              .approvalHoldReasons(o.metadata)
              .flatMap((reason) => (reason.kind === 'approval_rule' ? [reason.ruleId] : []))
          )
        ),
      ];
      const rules =
        ruleIds.length === 0
          ? []
          : await tx.purchaseApprovalRule.findMany({
              where: { id: { in: ruleIds } },
              select: { id: true, minAmountCents: true },
            });
      return {
        orders,
        total,
        accounts: new Map(accounts.map((a) => [a.id, a.companyName])),
        limits: new Map(rules.map((r) => [r.id, r.minAmountCents])),
        // Who each order waits on (sparx persona issue 087): the rules once, and
        // the page's accounts' approvers in one query.
        activeRules: await accountOrderGate.activeApprovalRules(tx, ctx.tenantId),
        approvers: await approversByAccount(tx, accountIds),
      };
    }
  );

  type OrderRow = (typeof orders)[number];

  return {
    items: orders.map((o: OrderRow) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalCents: Math.round(Number(o.total) * 100),
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      customerId: o.customer.id,
      customerName:
        [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') ||
        (o.customer.email ?? null),
      customerEmail: o.customer.email,
      companyId: o.customer.companyId,
      companyName: o.customer.companyId ? (accounts.get(o.customer.companyId) ?? null) : null,
      holdReasons: accountOrderGate
        .approvalHoldReasons(o.metadata)
        .map((reason): QueueHoldReason =>
          reason.kind === 'approval_rule'
            ? { kind: 'approval_rule', limitCents: limits.get(reason.ruleId) ?? null }
            : reason
        ),
      signOff: queueSignOff(
        accountOrderGate.signOffState({
          reasons: accountOrderGate.approvalHoldReasons(o.metadata),
          rule: accountOrderGate.ruleGoverningOrder(
            {
              accountId: o.customer.companyId ?? null,
              propertyId: o.propertyId ?? null,
              totalCents: Math.round(Number(o.total) * 100),
            },
            activeRules
          ),
          accountApprovers: (approvers.get(o.customer.companyId ?? '') ?? []).filter(
            (approver) => approver.customerId !== o.customer.id
          ),
          signed: accountOrderGate.approvalSignatures(o.metadata),
        }),
        (approvers.get(o.customer.companyId ?? '') ?? []).filter(
          (approver) => approver.customerId !== o.customer.id
        )
      ),
    })),
    total,
    skip: input.skip,
    take: input.take,
  };
}

export interface ApproveResult {
  /** `status` is `placed` when this was the last signature it needed, and
   *  still `pending_approval` when somebody else has yet to sign; `waitingOn`
   *  says who (sparx persona issue 087). */
  order: {
    id: string;
    orderNumber: string;
    status: string;
    waitingOn: accountOrderGate.SignOffSide[];
    /** Set when placing it took units that were not set aside for it: which
     *  lines, how many are now owed to the customer, and `note`, the sentence
     *  for whoever approved it. Null or absent when every unit came from the
     *  stock held for the order, and while it still waits for somebody. */
    stock?: OrderStockOutcome | null;
  };
  events: PendingEvent[];
  committedSales: CommittedSale[];
  /** The card work the decision needs, for the caller to do once the
   *  transaction has committed: charge a held card now the order is placed
   *  (sparx persona issue 087). Empty while it still waits for somebody. */
  money: heldOrderMoney.HeldOrderMoney[];
}

// ── Signing a held order off ──────────────────────────────────────────────────
//
// A held order can wait on two sides (`account-order-gate.ts`): the account's
// own approvers, on the site, and the business's team, in the console. Each
// side signs its own part, in either order. The signature goes on the order's
// metadata beside the reasons it was held, and the order goes ahead when the
// last side asked has signed. Either side turning it down cancels it.

const HELD_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  propertyId: true,
  total: true,
  currency: true,
  metadata: true,
  customer: { select: { companyId: true, firstName: true, lastName: true, email: true } },
  // An order made from a quote is billed as the quote was made out
  // (sparx persona issue 085): the conversion that held it would have
  // passed the quote's bill-to had it not been held.
  convertedFromDocument: { select: { billTo: true } },
} satisfies Prisma.OrderSelect;

type HeldOrder = Prisma.OrderGetPayload<{ select: typeof HELD_ORDER_SELECT }>;

function heldOrderFacts(order: HeldOrder) {
  return {
    customerId: order.customerId,
    accountId: order.customer.companyId ?? null,
    propertyId: order.propertyId ?? null,
    totalCents: Math.round(Number(order.total) * 100),
    metadata: order.metadata,
  };
}

/** "Teodora Vukić-Hale", "A or B", "A, B, or C". */
export function peopleWords(names: readonly string[]): string {
  if (names.length === 0) return 'somebody';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`;
}

/** The sentence the business's team reads when an order is the account's to
 *  sign, not theirs. */
async function waitingOnAccountWords(
  tx: Prisma.TransactionClient,
  accountId: string | null,
  approvers: readonly accountOrderGate.AccountApprover[]
): Promise<string> {
  const account = accountId
    ? await tx.company.findUnique({ where: { id: accountId }, select: { companyName: true } })
    : null;
  const who = peopleWords(approvers.map((approver) => approver.name));
  return `This order is waiting for ${who}${account ? ` at ${account.companyName}` : ''} to approve it. It goes ahead as soon as they do.`;
}

/**
 * Place a held order now that everyone asked has signed: commit stock (deferred
 * at checkout while held), and, if it was a net-terms order, issue the AR
 * document that was deferred too. Composed into the caller's transaction.
 */
async function placeHeldOrder(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string | null },
  existing: HeldOrder,
  metadata: Record<string, unknown>,
  inventoryActive: boolean
): Promise<{
  order: { id: string; orderNumber: string; status: string; stock: OrderStockOutcome | null };
  b2bInvoiceId: string | null;
  accountId: string | null;
  committedSales: CommittedSale[];
  money: heldOrderMoney.HeldOrderMoney[];
  customerId: string;
  /** Already paid in full while it waited, so placing it is when it is
   *  announced as paid. */
  paidWhenPlaced: boolean;
}> {
  const orderId = existing.id;
  const { paymentStatus, ...updated } = await tx.order.update({
    where: { id: orderId },
    data: { status: 'placed', metadata: metadata as Prisma.InputJsonValue },
    // The payment status comes back from this write, not an earlier read. A
    // payment landing at the same moment writes the same row, so one of the two
    // waits for the other: either this sees it paid, or the payment webhook
    // sees the order placed (sparx persona issue 087).
    select: { id: true, orderNumber: true, status: true, paymentStatus: true },
  });

  // A card held at checkout is charged now the order is placed. Worked out here,
  // charged by the caller after this commits (sparx persona issue 087).
  const money = await heldOrderMoney.heldOrderMoney(
    tx,
    { id: orderId, orderNumber: existing.orderNumber, customerId: existing.customerId },
    'placed'
  );

  // Decrement stock now the order is actually placed — checkout deferred the
  // commit while it was held (docs/100 §7.4). Idempotency keys keep a retried
  // approval safe. No-op when inventory is off.
  let committedSales: CommittedSale[] = [];
  if (inventoryActive) {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId, tenantId: ctx.tenantId },
      select: { id: true, variantId: true, quantity: true },
    });
    committedSales = await inventoryService.commitSaleOnTx(
      tx,
      { tenantId: ctx.tenantId, ...(ctx.userId ? { userId: ctx.userId } : {}) },
      {
        orderId,
        lines: orderItems.map((it) => ({
          variantId: it.variantId ?? '',
          quantity: it.quantity,
          // No hold passed: `commitSaleOnTx` commits from the stock the order
          // has held since checkout (or since its quote was accepted) itself.
          reservationId: null,
          lineKey: it.id,
        })),
      }
    );
  }
  // What the shelves could not cover, said to whoever approved it, instead of
  // a quiet allocation nobody sees. Null when every unit was set aside for it.
  const stock = committedSales.length
    ? await inventoryService.orderStockOutcomeOnTx(tx, { orderId, committed: committedSales })
    : null;

  // Net-terms order → issue the AR document now (deferred at checkout). It's a
  // BillingDocument on the system `net-terms-ar` workflow (docs/87 §15), composed
  // into this tx; createOrderArDocument re-syncs credit_used.
  const paymentTermsRequested =
    typeof metadata.paymentTermsRequested === 'string' ? metadata.paymentTermsRequested : null;
  const accountId = existing.customer.companyId ?? null;
  let b2bInvoiceId: string | null = null;

  if (paymentTermsRequested && accountId) {
    // Read off the account itself. This was `customer.company.paymentTerms`,
    // which the client answers with the computed employer string rather than
    // the account (issue 751), so it was never there and the terms the order
    // was placed on were used even after the account's had changed.
    const account = await tx.company.findUnique({
      where: { id: accountId },
      select: { paymentTerms: true },
    });
    const paymentTerms = account?.paymentTerms ?? paymentTermsRequested;
    const dueDaysMatch = /^net(\d+)$/i.exec(paymentTerms);
    const dueDays = dueDaysMatch?.[1] ? parseInt(dueDaysMatch[1], 10) : 30;
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + dueDays);
    // The order's own site issues the invoice (docs/131 §3.6). Order.propertyId
    // is nullable (orders outlive their site), so fall back to the primary.
    const issuingPropertyId =
      existing.propertyId ??
      (
        await tx.property.findFirst({
          where: { tenantId: ctx.tenantId, isPrimary: true },
          select: { id: true },
        })
      )?.id;
    if (!issuingPropertyId) {
      throw new Error(`Cannot issue an AR document: tenant ${ctx.tenantId} has no primary site.`);
    }
    const arDoc = await b2bArService.createOrderArDocument(
      { tenantId: ctx.tenantId, userId: ctx.userId ?? undefined, tx },
      {
        companyId: accountId,
        propertyId: issuingPropertyId,
        orderId,
        amount: Number(existing.total),
        currency: existing.currency,
        dueAt,
        description: `Order ${existing.orderNumber}`,
        ...(existing.convertedFromDocument?.billTo
          ? { billTo: existing.convertedFromDocument.billTo }
          : {}),
      }
    );
    b2bInvoiceId = arDoc.id;
  }

  return {
    order: { ...updated, stock },
    b2bInvoiceId,
    accountId,
    committedSales,
    money,
    customerId: existing.customerId,
    paidWhenPlaced: paymentStatus === 'paid',
  };
}

/** The events a placed order announces, after the transaction commits. */
function placedEvents(
  placed: {
    order: { orderNumber: string };
    b2bInvoiceId: string | null;
    accountId: string | null;
    customerId: string;
    paidWhenPlaced: boolean;
  },
  orderId: string,
  reason: string | null,
  decidedBy: string
): PendingEvent[] {
  const events: PendingEvent[] = [
    {
      type: 'b2b.order.approved',
      payload: { orderId, orderNumber: placed.order.orderNumber, reason, decidedBy },
    },
  ];
  if (placed.b2bInvoiceId) {
    events.push({
      type: 'b2b.invoice.created',
      payload: {
        invoiceId: placed.b2bInvoiceId,
        accountId: placed.accountId,
        orderId,
        orderNumber: placed.order.orderNumber,
      },
    });
  }
  // Announce the now-placed order for inventory/fulfillment consumers.
  events.push({
    type: 'order.placed',
    payload: { orderId, orderNumber: placed.order.orderNumber },
  });
  // Paid while it waited (a gateway that charges on its own page cannot hold
  // the card): the payment webhook recorded it and kept quiet, so it is
  // announced now the order is real, once (sparx persona issue 087). A card
  // held at checkout is not paid yet here; charging it announces it instead.
  if (placed.paidWhenPlaced) {
    events.push({
      type: 'order.paid',
      payload: {
        orderId,
        orderNumber: placed.order.orderNumber,
        customerId: placed.customerId,
      },
    });
  }
  return events;
}

/** How the business's task names somebody at the account who signed. */
const ACCOUNT_APPROVER = "who approves orders for the customer's account";

/**
 * Close the business's "waiting for your sign-off" task for this order, saying
 * who answered and how (`taskService.closeWhenOrderMovesOn`). Every way a held
 * order is answered ends here: signed by the business, signed on the site by
 * the account's own approver, or turned down by either. Cancelling the order
 * any other way is the order service's own call.
 */
async function closeSignOffTasks(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string },
  orderId: string,
  outcome: { because: string; byUserId: string | null; actorType: 'staff' | 'customer' }
): Promise<void> {
  await taskService.closeWhenOrderMovesOn(tx, ctx, {
    orderId,
    left: 'pending_approval',
    as: 'completed',
    because: outcome.because,
    byUserId: outcome.byUserId,
    actorType: outcome.actorType,
  });
}

/**
 * Sign one side of a held order off, and place it if that was the last
 * signature it needed. Shared by the business's console and the account's site,
 * which differ only in who may sign and how the trail names them.
 */
async function signHeldOrder(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string | null },
  existing: HeldOrder,
  signOff: accountOrderGate.OrderSignOff,
  side: accountOrderGate.SignOffSide,
  signature: accountOrderGate.SignOffSignature,
  trail: { actorType: 'staff' | 'customer'; who: string; reason: string | null },
  inventoryActive: boolean
): Promise<
  | {
      kind: 'signed';
      order: ApproveResult['order'];
    }
  | ({ kind: 'placed' } & Awaited<ReturnType<typeof placeHeldOrder>>)
> {
  const metadata = accountOrderGate.withSignature(
    (existing.metadata ?? {}) as Record<string, unknown>,
    side,
    signature
  );
  const waitingOn = signOff.state.waitingOn.filter((other) => other !== side);
  const because = trail.reason ? `: ${trail.reason}` : '';

  if (waitingOn.length > 0) {
    await tx.order.update({
      where: { id: existing.id },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
    const next =
      waitingOn[0] === 'account'
        ? `Still waiting for ${peopleWords(signOff.approvers.map((a) => a.name))} at the account to approve it.`
        : 'Still waiting for your team to sign it off.';
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: trail.actorType === 'staff' ? ctx.userId : null,
        actorType: trail.actorType,
        customerId: existing.customerId,
        type: 'note',
        description: `Order #${existing.orderNumber} approved by ${trail.who}${because}. ${next}`,
        occurredAt: new Date(),
      },
    });
    // The business's part is done even though the order still waits, so its
    // "waiting for your sign-off" task is done too. The account signing first
    // leaves it open: the business has still to sign.
    if (side === 'business') {
      await closeSignOffTasks(tx, ctx, existing.id, {
        because: `${trail.who} signed it off. ${next}`,
        byUserId: ctx.userId,
        actorType: trail.actorType,
      });
    }
    return {
      kind: 'signed',
      order: {
        id: existing.id,
        orderNumber: existing.orderNumber,
        status: 'pending_approval',
        waitingOn,
      },
    };
  }

  const placed = await placeHeldOrder(tx, ctx, existing, metadata, inventoryActive);
  // Audit trail via CRM activity.
  await tx.crmActivity.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: trail.actorType === 'staff' ? ctx.userId : null,
      actorType: trail.actorType,
      customerId: existing.customerId,
      type: 'note',
      description: `Order #${existing.orderNumber} approved by ${trail.who}${because}`,
      occurredAt: new Date(),
    },
  });
  await closeSignOffTasks(tx, ctx, existing.id, {
    because:
      side === 'business'
        ? `${trail.who} signed it off, and the order was placed.`
        : `${trail.who}, ${ACCOUNT_APPROVER}, approved it on your site, and the order was placed.`,
    byUserId: trail.actorType === 'staff' ? ctx.userId : null,
    actorType: trail.actorType,
  });
  return { kind: 'placed', ...placed };
}

/**
 * Approve a pending B2B order from the business's side.
 *
 * Signs the business's part. When nothing else is waiting, the order is placed:
 * stock commits, it is audit-noted, and a net-terms order's AR document is
 * issued. When the account's approver has yet to say yes, the signature is kept
 * and the order keeps waiting for them. An order only the account signs is not
 * the business's to approve, and is refused with who it is waiting for.
 *
 * Returns the domain events to publish and the committed sales to emit
 * inventory threshold events for, both AFTER the caller observes the returned
 * transaction has committed.
 */
export async function approveOrder(
  ctx: B2bContext,
  orderId: string,
  rawInput: unknown
): Promise<ApproveResult> {
  const body = ApproveBody.parse(rawInput);
  const inventoryActive = await isModuleEnabled(ctx.tenantId, 'inventory');

  const result = await withTenant(ctx, async (tx) => {
    const existing = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
      select: HELD_ORDER_SELECT,
    });
    if (!existing) throw notFound('Pending order not found');

    const signOff = await accountOrderGate.loadOrderSignOff(
      tx,
      ctx.tenantId,
      heldOrderFacts(existing)
    );
    if (!signOff.state.needs.includes('business')) {
      throw forbidden(
        await waitingOnAccountWords(tx, existing.customer.companyId ?? null, signOff.approvers)
      );
    }
    const already = signOff.state.signed.business;
    if (already) {
      throw forbidden(
        `${already.name} has already signed this off. ${await waitingOnAccountWords(
          tx,
          existing.customer.companyId ?? null,
          signOff.approvers
        )}`
      );
    }
    assertNamedApprover(ctx, signOff.rule);

    const me = await tx.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    });
    const who = accountOrderGate.signerName(me ?? {});
    const signed = await signHeldOrder(
      tx,
      ctx,
      existing,
      signOff,
      'business',
      { name: who, at: new Date().toISOString(), userId: ctx.userId },
      { actorType: 'staff', who, reason: body.reason ?? null },
      inventoryActive
    );
    return { signed, who };
  });

  if (result.signed.kind === 'signed') {
    return { order: result.signed.order, events: [], committedSales: [], money: [] };
  }
  return {
    order: { ...result.signed.order, waitingOn: [] },
    events: placedEvents(result.signed, orderId, body.reason ?? null, result.who),
    committedSales: result.signed.committedSales,
    money: result.signed.money,
  };
}

export interface RejectResult {
  order: { id: string; orderNumber: string; status: string };
  events: PendingEvent[];
  /** The card work turning it down needs, for the caller to do once the
   *  transaction has committed: let a held card go, or refund one that was
   *  already charged (sparx persona issue 087). There used to be none, because
   *  nothing was done: the order was cancelled and the money kept. */
  money: heldOrderMoney.HeldOrderMoney[];
}

/** Cancel a held order and write down who turned it down. */
async function turnDownHeldOrder(
  tx: Prisma.TransactionClient,
  ctx: { tenantId: string; userId: string | null },
  existing: { id: string; orderNumber: string; customerId: string },
  trail: { actorType: 'staff' | 'customer'; who: string; reason: string | null }
) {
  const order = await tx.order.update({
    where: { id: existing.id },
    data: { status: 'cancelled' },
    select: { id: true, orderNumber: true, status: true },
  });
  // The buyer gets their money back: a held card is let go, a charged one is
  // refunded in full. Worked out here, done by the caller after this commits.
  const money = await heldOrderMoney.heldOrderMoney(tx, existing, 'turned_down');
  // The stock it held while it waited goes back on sale, in this transaction,
  // so a turned-down order never keeps units nobody will buy. Every way of
  // turning one down (the console, the account's approver on the site, MCP)
  // comes through here. No-op when it held nothing.
  await inventoryService.releaseOrderHoldsOnTx(
    tx,
    { tenantId: ctx.tenantId, ...(ctx.userId ? { userId: ctx.userId } : {}) },
    { orderId: existing.id }
  );
  await tx.crmActivity.create({
    data: {
      tenantId: ctx.tenantId,
      actorId: trail.actorType === 'staff' ? ctx.userId : null,
      actorType: trail.actorType,
      customerId: existing.customerId,
      type: 'note',
      description: `Order #${existing.orderNumber} rejected by ${trail.who}${trail.reason ? `: ${trail.reason}` : ''}`,
      occurredAt: new Date(),
    },
  });
  // The sign-off it asked for has been given, as a no.
  const at = trail.actorType === 'customer' ? `, ${ACCOUNT_APPROVER},` : '';
  await closeSignOffTasks(tx, ctx, existing.id, {
    because: `${trail.who}${at} turned it down${trail.reason ? ` ("${trail.reason}")` : ''}, so the order was canceled.`,
    byUserId: trail.actorType === 'staff' ? ctx.userId : null,
    actorType: trail.actorType,
  });
  return { order, money };
}

/** Reject a pending B2B order from the business's side: cancel it + audit-note it. */
export async function rejectOrder(
  ctx: B2bContext,
  orderId: string,
  rawInput: unknown
): Promise<RejectResult> {
  const body = RejectBody.parse(rawInput);

  const { order, money, who } = await withTenant(ctx, async (tx) => {
    const existing = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
      select: HELD_ORDER_SELECT,
    });
    if (!existing) throw notFound('Pending order not found');

    // The named approver gates refusing too: a rejection cancels a customer's
    // order. A rule the account signs names nobody, so this passes for it, and
    // the business keeps the power to turn down any order placed with it.
    const signOff = await accountOrderGate.loadOrderSignOff(
      tx,
      ctx.tenantId,
      heldOrderFacts(existing)
    );
    assertNamedApprover(ctx, signOff.rule);

    const me = await tx.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true },
    });
    const who = accountOrderGate.signerName(me ?? {});
    const { order, money } = await turnDownHeldOrder(tx, ctx, existing, {
      actorType: 'staff',
      who,
      reason: body.reason ?? null,
    });
    return { order, money, who };
  });

  return {
    order,
    money,
    events: [
      {
        type: 'b2b.order.rejected',
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          reason: body.reason ?? null,
          decidedBy: who,
          side: 'business',
        },
      },
    ],
  };
}

// ── The account's own approvers, on the site (sparx persona issue 087) ────────
//
// A contact with the role "Can approve orders" signs the account's part of a
// held order from their wholesale account pages. They may sign only for an
// account they are an active approver on, only an order placed on that account,
// never one they placed themselves, and only when the rule that held it asks
// the account to sign.

/** Who is deciding, from the site. */
export interface AccountDecider {
  tenantId: string;
  /** The signed-in contact. */
  customerId: string;
  /** The account in the path. */
  accountId: string;
}

/** The held order, if it is this account's and the signed-in contact may decide
 *  on it. Refuses with the reason otherwise. */
async function accountDecision(
  tx: Prisma.TransactionClient,
  decider: AccountDecider,
  orderId: string
) {
  const contact = await tx.b2bAccountContact.findFirst({
    where: { accountId: decider.accountId, customerId: decider.customerId, isActive: true },
    select: { role: true, customer: { select: { firstName: true, lastName: true, email: true } } },
  });
  if (!contact) throw forbidden('You do not have access to this account.');
  if (contact.role !== 'approver') {
    throw forbidden('Only someone who can approve orders on this account can do that.');
  }

  const existing = await tx.order.findFirst({
    where: {
      id: orderId,
      tenantId: decider.tenantId,
      status: 'pending_approval',
      customer: { companyId: decider.accountId },
    },
    select: HELD_ORDER_SELECT,
  });
  if (!existing) throw notFound('That order is not waiting for approval on this account.');
  if (existing.customerId === decider.customerId) {
    throw forbidden('You placed this order, so someone else on the account has to approve it.');
  }

  const signOff = await accountOrderGate.loadOrderSignOff(
    tx,
    decider.tenantId,
    heldOrderFacts(existing)
  );
  if (!signOff.state.needs.includes('account')) {
    throw forbidden('This order is not waiting for your approval.');
  }
  return { existing, signOff, who: accountOrderGate.signerName(contact.customer) };
}

/** An approver at the account approves a held order. */
export async function approveOrderForAccount(
  decider: AccountDecider,
  orderId: string,
  rawInput: unknown
): Promise<ApproveResult> {
  const body = AccountDecisionBody.parse(rawInput ?? {});
  // A blank reason box is no reason, not an empty one.
  const reason = body.reason?.length ? body.reason : null;
  const inventoryActive = await isModuleEnabled(decider.tenantId, 'inventory');
  const ctx = { tenantId: decider.tenantId };
  // Nobody on the business's team is acting: the trail names the contact.
  const actor = { tenantId: decider.tenantId, userId: null };

  const result = await withTenant(ctx, async (tx) => {
    const { existing, signOff, who } = await accountDecision(tx, decider, orderId);
    const already = signOff.state.signed.account;
    if (already) throw forbidden(`${already.name} has already approved this order.`);
    const signed = await signHeldOrder(
      tx,
      actor,
      existing,
      signOff,
      'account',
      { name: who, at: new Date().toISOString(), customerId: decider.customerId },
      { actorType: 'customer', who, reason },
      inventoryActive
    );
    return { signed, who };
  });

  if (result.signed.kind === 'signed') {
    return { order: result.signed.order, events: [], committedSales: [], money: [] };
  }
  return {
    order: { ...result.signed.order, waitingOn: [] },
    events: placedEvents(result.signed, orderId, reason, result.who),
    committedSales: result.signed.committedSales,
    money: result.signed.money,
  };
}

/** An approver at the account turns a held order down, which cancels it. */
export async function rejectOrderForAccount(
  decider: AccountDecider,
  orderId: string,
  rawInput: unknown
): Promise<RejectResult> {
  const body = AccountDecisionBody.parse(rawInput ?? {});
  // A blank reason box is no reason, not an empty one.
  const reason = body.reason?.length ? body.reason : null;
  const ctx = { tenantId: decider.tenantId };
  // Nobody on the business's team is acting: the trail names the contact.
  const actor = { tenantId: decider.tenantId, userId: null };

  const { order, money, who } = await withTenant(ctx, async (tx) => {
    const { existing, who } = await accountDecision(tx, decider, orderId);
    const { order, money } = await turnDownHeldOrder(tx, actor, existing, {
      actorType: 'customer',
      who,
      reason,
    });
    return { order, money, who };
  });

  return {
    order,
    money,
    events: [
      {
        type: 'b2b.order.rejected',
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          reason,
          decidedBy: who,
          side: 'account',
        },
      },
    ],
  };
}

/** One order waiting for the account's approval, as its approver sees it. */
export interface AccountApprovalItem {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  placedBy: string;
  poNumber: string | null;
  itemCount: number;
  /** The spending limit it went over, when one held it. */
  limitCents: number | null;
  /** True when the business also has to sign it off, after or before them. */
  businessToo: boolean;
}

/**
 * The account's held orders that are waiting for THIS approver to say yes:
 * the account is asked, has not signed yet, and the order is somebody else's.
 * Refused for anybody who is not an approver on the account.
 */
export async function listAccountApprovals(
  decider: AccountDecider
): Promise<{ items: AccountApprovalItem[] }> {
  const ctx = { tenantId: decider.tenantId };
  const items = await withTenant(ctx, async (tx) => {
    const contact = await tx.b2bAccountContact.findFirst({
      where: { accountId: decider.accountId, customerId: decider.customerId, isActive: true },
      select: { role: true },
    });
    if (!contact) throw forbidden('You do not have access to this account.');
    if (contact.role !== 'approver') {
      throw forbidden('Only someone who can approve orders on this account can see this.');
    }

    const orders = await tx.order.findMany({
      where: {
        tenantId: decider.tenantId,
        status: 'pending_approval',
        customer: { companyId: decider.accountId },
        customerId: { not: decider.customerId },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        ...HELD_ORDER_SELECT,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });
    const rules = await accountOrderGate.activeApprovalRules(tx, decider.tenantId);
    const out: AccountApprovalItem[] = [];
    for (const order of orders) {
      const signOff = await accountOrderGate.loadOrderSignOff(
        tx,
        decider.tenantId,
        heldOrderFacts(order),
        rules
      );
      if (!signOff.state.waitingOn.includes('account')) continue;
      out.push({
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents: Math.round(Number(order.total) * 100),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        placedBy: accountOrderGate.signerName(order.customer),
        poNumber: poNumberOf(order.metadata),
        itemCount: order._count.items,
        limitCents: signOff.rule?.minAmountCents ?? null,
        businessToo: signOff.state.needs.includes('business'),
      });
    }
    return out;
  });
  return { items };
}

/**
 * Where one held order stands, for the site's order page: who has to say yes,
 * who has, and whether the person looking may approve it now. Null when the
 * order is not held. Read for any contact who can see the order; `canDecide`
 * is true only for an approver on the account the order is waiting on.
 */
export async function accountOrderSignOff(
  decider: AccountDecider,
  order: {
    id: string;
    status: string;
    customerId: string | null;
    propertyId: string | null;
    totalCents: number;
    metadata: unknown;
  }
): Promise<(SignOffView & { canDecide: boolean; limitCents: number | null }) | null> {
  if (order.status !== 'pending_approval') return null;
  return withTenant({ tenantId: decider.tenantId }, async (tx) => {
    const signOff = await accountOrderGate.loadOrderSignOff(tx, decider.tenantId, {
      customerId: order.customerId,
      accountId: decider.accountId,
      propertyId: order.propertyId,
      totalCents: order.totalCents,
      metadata: order.metadata,
    });
    const contact = await tx.b2bAccountContact.findFirst({
      where: { accountId: decider.accountId, customerId: decider.customerId, isActive: true },
      select: { role: true },
    });
    const canDecide =
      contact?.role === 'approver' &&
      order.customerId !== decider.customerId &&
      signOff.state.waitingOn.includes('account');
    return {
      ...queueSignOff(signOff.state, signOff.approvers),
      canDecide,
      limitCents: signOff.rule?.minAmountCents ?? null,
    };
  });
}

/**
 * Where a held order stands, for whoever placed it: their own order page on
 * the site says who it is waiting on rather than "waiting for approval" with
 * nobody named (sparx persona issue 087). Null when the order is not held.
 */
export async function heldOrderSignOff(
  ctx: { tenantId: string },
  orderId: string
): Promise<SignOffView | null> {
  return withTenant(ctx, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId: ctx.tenantId, status: 'pending_approval' },
      select: HELD_ORDER_SELECT,
    });
    if (!order) return null;
    const signOff = await accountOrderGate.loadOrderSignOff(
      tx,
      ctx.tenantId,
      heldOrderFacts(order)
    );
    return queueSignOff(signOff.state, signOff.approvers);
  });
}
