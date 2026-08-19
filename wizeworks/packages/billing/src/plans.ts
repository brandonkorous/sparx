// The billing PLAN registry — the MECHANISM for "what is this tenant charged, and
// out of which Stripe account". It deliberately contains no brand's prices.
//
// ── WHY A PLAN AND NOT A BRAND ──────────────────────────────────────────────
//
// WizeWorks runs two products on one platform and they bill on incompatible models:
// one sells modules (an item per active module), one sells a flat plan with capacity
// as the only variable axis. They also bill out of two SEPARATE Stripe accounts.
//
// The obvious implementation — ask the tenant which brand it is — is a boundary
// violation under wizeworks/ (wizeworks/CLAUDE.md RULE #0). So nothing here asks. A
// tenant carries `tenants.billing_plan`, a plan says what that id DOES, and billing
// reads only the plan. Which plan a new tenant is born on is the brand registry's
// business (@wizeworks/brand-core `billingPlan`), stamped once at provisioning.
//
// ── WHY THE DEFINITIONS ARE LOADED AND NOT LISTED ───────────────────────────
//
// A plan's SHAPE and prices are brand policy — "what a seat costs" is exactly the
// example wizeworks/CLAUDE.md gives — so a hardcoded list of them here would fail the
// brand-blindness test: it would need editing the day a third brand launched. This
// file therefore holds the vocabulary and one built-in default, and takes every other
// plan as configuration. The brand owns the definition; the platform owns the engine.
//
// `BILLING_PLANS` is a JSON array of BillingPlan objects. Each brand authors its own
// (piggles/config/billing-plan.json) and ops ships it into the API's environment —
// the same shape as every other brand value the platform reads by name.

/** How a plan's subscription is shaped.
 *  - `per_module` — one item per active billable module; the item set IS the plan.
 *  - `flat`       — one base item, plus a quantity-bearing item per capacity block
 *                   bought. Module flags never reach the bill. */
export type PlanShape = 'per_module' | 'flat';

/** One purchasable block of capacity on a flat plan. `key` matches a capacity meter
 *  the owning product surfaces at the point of friction. */
export interface CapacityBlock {
  key: string;
  label: string;
  /** Deterministic Stripe product id — a provisioner finds-or-creates on it. */
  product: string;
  lookupKey: string;
  /** Env var holding the resolved Stripe Price id. */
  priceEnv: string;
  monthlyCents: number;
  /** How much of the meter ONE block adds. */
  blockSize: number;
  blockUnit?: string;
}

export interface BillingPlan {
  id: string;
  label: string;
  shape: PlanShape;
  /** Env var holding this plan's Stripe secret key — i.e. WHICH ACCOUNT. */
  secretEnv: string;
  /** Env var holding that account's webhook signing secrets (comma-separated). */
  webhookSecretEnv: string;
  /** Flat plans only: the single always-present subscription item. */
  base?: {
    product: string;
    lookupKey: string;
    priceEnv: string;
    monthlyCents: number;
  };
  /** Flat plans only: what the base price includes, keyed by capacity meter. */
  included?: Record<string, number>;
  /** Flat plans only: the expansion blocks. */
  capacity?: CapacityBlock[];
}

/**
 * The platform's built-in plan: per-active-module billing out of `STRIPE_SECRET_KEY`.
 *
 * It is here rather than in configuration because it is the BEHAVIOUR EVERY TENANT
 * ALREADY HAD — a row with no `billing_plan`, an unconfigured environment and a test
 * all resolve to it, so it cannot itself be configuration without making the
 * unconfigured case undefined. Its prices live in ./price-catalog, driven by the
 * module roster.
 */
const DEFAULT_PLAN: BillingPlan = {
  id: 'modules',
  label: 'Per active module',
  shape: 'per_module',
  secretEnv: 'STRIPE_SECRET_KEY',
  webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET_BILLING',
};

export const DEFAULT_PLAN_ID = DEFAULT_PLAN.id;

/** Loaded plans, memoized per process. `undefined` = not yet read. */
let loaded: Map<string, BillingPlan> | undefined;

function fail(reason: string): never {
  throw new Error(`BILLING_PLANS is invalid: ${reason}`);
}

/** Validate one entry hard. A malformed plan must not degrade to "close enough" —
 *  a plan with the wrong `secretEnv` bills real money in the wrong account, and a
 *  loud boot failure is cheaper than an invoice nobody can explain. */
function validate(raw: unknown): BillingPlan {
  if (typeof raw !== 'object' || raw === null) fail('every entry must be an object');
  const plan = raw as Partial<BillingPlan>;
  for (const field of ['id', 'label', 'secretEnv', 'webhookSecretEnv'] as const) {
    if (typeof plan[field] !== 'string' || plan[field]?.trim() === '') {
      fail(`plan "${plan.id ?? '?'}" is missing ${field}`);
    }
  }
  if (plan.shape !== 'per_module' && plan.shape !== 'flat') {
    fail(`plan "${plan.id}" has shape "${String(plan.shape)}" (expected per_module or flat)`);
  }
  if (plan.shape === 'flat' && !plan.base) {
    fail(`flat plan "${plan.id}" has no base item — there would be nothing to charge`);
  }
  return plan as BillingPlan;
}

function load(): Map<string, BillingPlan> {
  if (loaded) return loaded;
  const map = new Map<string, BillingPlan>([[DEFAULT_PLAN.id, DEFAULT_PLAN]]);
  const raw = process.env.BILLING_PLANS?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail('not valid JSON');
    }
    if (!Array.isArray(parsed)) fail('expected a JSON array of plans');
    for (const entry of parsed) {
      const plan = validate(entry);
      map.set(plan.id, plan);
    }
  }
  loaded = map;
  return map;
}

/** Register a plan in-process — the seam a test or a script uses instead of setting
 *  env. Later registration of the same id wins. */
export function registerBillingPlan(plan: BillingPlan): void {
  load().set(plan.id, validate(plan));
}

/** Test seam — drops loaded plans so a case can change `BILLING_PLANS`. */
export function resetBillingPlansForTesting(): void {
  loaded = undefined;
}

/**
 * The plan for an id.
 *
 * Null/empty resolves to the default — that is a tenant row written before plans
 * existed, and its billing has not changed. A NON-EMPTY id this process does not know
 * THROWS: the tenant was deliberately put on some other plan, and quietly billing
 * them on the default would charge them the wrong amount in the wrong Stripe account.
 * The loud failure is the point — a missing `BILLING_PLANS` should stop billing, not
 * silently redirect it.
 */
export function planFor(id: string | null | undefined): BillingPlan {
  const key = id?.trim();
  if (!key) return DEFAULT_PLAN;
  const plan = load().get(key);
  if (!plan) {
    throw new Error(
      `Unknown billing plan "${key}". Define it in BILLING_PLANS, or the tenant will be billed on the wrong account.`
    );
  }
  return plan;
}

/** Every plan this process knows — the default plus whatever was configured. */
export function listBillingPlans(): BillingPlan[] {
  return [...load().values()];
}

/** The capacity block a plan sells for one meter, or undefined. */
export function capacityBlockFor(plan: BillingPlan, meterKey: string): CapacityBlock | undefined {
  return plan.capacity?.find((c) => c.key === meterKey);
}
