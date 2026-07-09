// The sparx host class-validator (docs/118 §4, the governance seam).
//
// silica's engine now OWNS the base security floor (deny `fixed` / arbitrary
// `z-[…]` / `content-[…]` / `url(…)`) as its built-in, unconditional first gate
// (silicaui-html `class-policy.ts`). So sparx no longer carries that denylist —
// `@sparx/surface-compile`'s `allowlist.ts` retires with the per-tenant compiler.
// All the host contributes is a tenant's OPTIONAL tighten rules, which compose
// ON TOP of the floor (add-only; the insecure "loosen the floor" state is
// unrepresentable — silica's `buildClassValidator` ANDs with the floor).
//
// sparx's stored `builder_governance.utility_allowlist` already used the exact
// `{ kind, value }` rule shape silica ships, so this is a defensive parse plus a
// pass-through to `buildClassValidator`.

import {
  buildClassValidator,
  type AllowlistRule,
  type ClassValidator,
} from '@wizeworks/silicaui-html';

/** Defensively parse a tenant's stored governance allowlist (the
 *  `builder_governance.utility_allowlist` JSON) into silica `AllowlistRule`s.
 *  Returns `[]` for null / malformed input — a tenant may only ever ADD tighten
 *  rules, never loosen, so an unparseable config degrades to "floor only". */
export function parseTenantAllowlist(raw: unknown): AllowlistRule[] {
  if (!raw || typeof raw !== 'object') return [];
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return [];
  const out: AllowlistRule[] = [];
  for (const entry of blocks) {
    if (!entry || typeof entry !== 'object') continue;
    const { kind, value } = entry as { kind?: unknown; value?: unknown };
    if (
      (kind === 'prefix' || kind === 'exact' || kind === 'substring') &&
      typeof value === 'string' &&
      value
    ) {
      out.push({ kind, value });
    }
  }
  return out;
}

/** The sparx host's `validateClass`: silica's built-in floor plus this tenant's
 *  tighten rules. Returns `undefined` when the tenant has no custom rules — the
 *  host then omits `validateClass` and the engine applies its built-in floor
 *  unchanged (no redundant wrapper). */
export function createSilicaClassValidator(tenantAllowlist?: unknown): ClassValidator | undefined {
  const blocks = parseTenantAllowlist(tenantAllowlist);
  return blocks.length ? buildClassValidator({ blocks }) : undefined;
}
