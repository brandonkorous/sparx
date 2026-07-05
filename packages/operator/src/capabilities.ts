// The operator capability vocabulary (docs/apps/admin/build-plan.md §2 D5).
//
// Authorization for the WizeWorks admin console is CAPABILITY-scoped and
// DEFAULT-DENY (docs/16 §2.4): an operator holds an explicit set of these
// primitives and nothing is implied. There is no "operator admin implies
// everything" — even `operator:admin` grants ONLY the right to manage other
// operators, not, say, billing actions.
//
// The named roles from docs/76 §2 (super_admin / sparx_admin / billing_admin /
// support / developer) are expressed here as convenience BUNDLES over these
// primitives — a shortcut for GRANTING capabilities, never a shortcut the authz
// check reads. Every gate in the app and every audited api-rest call checks a
// primitive capability, not a role name.

export const OPERATOR_CAPABILITIES = [
  // Cross-tenant support surface: read a tenant's account state; take bounded
  // support actions (resend an email, trigger a reindex, …). NOT impersonation
  // (removed, D7) — operators never assume a tenant session.
  'support:read',
  'support:act',
  // Billing operations: read cross-tenant billing state; act (refund, coupon,
  // enterprise invoice, retry a failed payment).
  'billing:read',
  'billing:act',
  // Acquisition / growth reporting (the L-PLAT report, docs/80 §10).
  'acquisition:read',
  // Suspend / unsuspend a tenant.
  'tenant:suspend',
  // Manually activate / deactivate a module for a tenant (publishes
  // `module.activated`; never an inline flag write).
  'module:toggle',
  // Custom-domain + SSL operations across tenants (force re-verify, view
  // GoDaddy history).
  'domain:manage',
  // In-product feedback triage (docs/apps/admin/feedback.md): respond to a
  // submission; administer (delete / configure).
  'feedback:respond',
  'feedback:admin',
  // Manage the operator roster itself — grant/revoke capabilities, add/remove
  // operators. The ONLY capability that touches the operator identity store.
  'operator:admin',
] as const;

export type OperatorCapability = (typeof OPERATOR_CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(OPERATOR_CAPABILITIES);

/** Narrowing guard — is an arbitrary string a known capability? */
export function isOperatorCapability(value: string): value is OperatorCapability {
  return CAPABILITY_SET.has(value);
}

/** Human-readable labels for the console (grant UI, audit rendering). */
export const OPERATOR_CAPABILITY_LABELS: Record<OperatorCapability, string> = {
  'support:read': 'Support — read tenant accounts',
  'support:act': 'Support — take support actions',
  'billing:read': 'Billing — read financial data',
  'billing:act': 'Billing — refunds, coupons, invoices',
  'acquisition:read': 'Growth — acquisition reporting',
  'tenant:suspend': 'Tenants — suspend / unsuspend',
  'module:toggle': 'Tenants — activate / deactivate modules',
  'domain:manage': 'Domains — manage custom domains & SSL',
  'feedback:respond': 'Feedback — respond to submissions',
  'feedback:admin': 'Feedback — administer (delete / configure)',
  'operator:admin': 'Operators — manage the operator roster',
};

/**
 * Named capability bundles (docs/76 §2 role matrix, expressed as capability
 * sets). Used ONLY when granting an operator a sensible starting set — the
 * bundle name is never persisted or checked; the resolved capabilities are.
 */
export const CAPABILITY_BUNDLES = {
  // Everything, including operator-roster management. Seeded operator #1
  // (brandon@wize.works, D10) gets this.
  super_admin: [...OPERATOR_CAPABILITIES],
  // Full sparx product operations, but not operator-roster management.
  sparx_admin: OPERATOR_CAPABILITIES.filter((c) => c !== 'operator:admin'),
  // Financial data only, all products.
  billing_admin: ['billing:read', 'billing:act'] satisfies OperatorCapability[],
  // Read + bounded support actions + feedback replies; no billing, no suspend.
  support: ['support:read', 'support:act', 'feedback:respond'] satisfies OperatorCapability[],
  // Read-only introspection for engineers mining reports + support state.
  developer: ['support:read', 'acquisition:read'] satisfies OperatorCapability[],
} as const satisfies Record<string, readonly OperatorCapability[]>;

export type CapabilityBundle = keyof typeof CAPABILITY_BUNDLES;

/** Resolve a bundle name to its capability list (a fresh array copy). */
export function bundleCapabilities(bundle: CapabilityBundle): OperatorCapability[] {
  return [...CAPABILITY_BUNDLES[bundle]];
}
