// Shared DTO shapes for the Builder governance surface (docs/61 §8 Phase 6b).
// Mirrors the api-rest /v1/builder/governance contract. No 'server-only' here so
// the client editor can import the types too.

export type AllowlistRuleKind = 'prefix' | 'exact' | 'substring';

/** One tenant-added block rule (tighten-only). */
export interface AllowlistRuleDto {
  kind: AllowlistRuleKind;
  value: string;
}

/** A platform base rule, surfaced read-only with its security rationale. */
export interface BaseRuleDto {
  label: string;
  reason: string;
}

/** The tenant's utility-allowlist governance: the immutable platform base rules
 *  (for display) + the tenant's own additions. */
export interface AllowlistDto {
  base: BaseRuleDto[];
  tenant: AllowlistRuleDto[];
}
