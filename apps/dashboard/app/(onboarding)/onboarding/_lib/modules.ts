// Onboarding module helpers. The module catalog + dependency graph now live in
// the shared `@/lib/modules` (used by the public pricing page, the onboarding
// Modules step, and Settings → Modules). This file re-exports them under the
// historical onboarding names so the wizard's components are untouched, and adds
// the bits only onboarding needs: the default-on set, template-compatibility
// keys, and the selling-modules gate that decides whether the Payments step
// appears.

export {
  SWITCHBOARD_MODULES as ONBOARDING_MODULES,
  MODULE_BY_KEY,
  effectiveModuleOn,
  moduleLock,
  lockReasonText,
  toggleModule,
  moduleBilled,
  moduleElsewhere,
} from '@/lib/modules';
export type { SwitchboardModule as OnboardingModule } from '@/lib/modules';

/** Modules on by default the first time a tenant lands — the common starting
 *  point (a site that sells and publishes). Mirrors the pricing page. */
export const DEFAULT_ON = ['builder', 'commerce', 'cms'];

/** The modules a template can REQUIRE for compatibility filtering. Builder is
 *  universal (every site has it) so it never narrows the catalog; Chat is an
 *  add-on layered on top, never a structural requirement. */
export const TEMPLATE_CAP_KEYS = ['commerce', 'cms', 'crm', 'email', 'b2b', 'ai', 'dropship'];

/** Selling modules — when ANY is on, the onboarding flow includes the Payments
 *  (Stripe Connect) step so the tenant can take customer money. */
export const SELLING_MODULE_KEYS = ['commerce', 'b2b', 'dropship'];

export function isSellingSelected(modules: Record<string, boolean>): boolean {
  return SELLING_MODULE_KEYS.some((k) => modules[k]);
}
