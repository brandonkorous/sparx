import { requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { listProperties } from '@/lib/sites';
import { OnboardingWizard } from './_components/onboarding-wizard';
import { DEFAULT_ON } from './_lib/modules';
import type { OnboardingCompleted, OnboardingStepKey, WizardBlueprint } from './_lib/types';

// Entry point for the modules-first guided setup (docs/15 v2). Reads the saved
// onboarding state, tenant basics, module flags, the primary site name, and the
// blueprint catalog once (all un-gated for the owner) and hands them to the
// client wizard, which resumes at the persisted `currentStep`. A `?blueprint=<key>`
// (marketplace funnel) pre-selects a template; a `?step=<key>` deep link (e.g. the
// welcome checklist) jumps straight to a step.
export const dynamic = 'force-dynamic';

interface OnboardingStateDto {
  currentStep: OnboardingStepKey;
  completed: OnboardingCompleted;
  finishedAt: string | null;
  blueprintKey: string | null;
  installId: string | null;
}

interface BlueprintDto {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: WizardBlueprint['vertical'];
  preview?: string;
  // The API field is `requiredModules` (with a d) — the gallery filters on it.
  requiredModules: string[];
  contents: WizardBlueprint['contents'];
  install: WizardBlueprint['install'];
}

const VALID_STEPS: OnboardingStepKey[] = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string; blueprint?: string }>;
}) {
  await requireSession();
  const sp = (await searchParams) ?? {};

  const [tenant, state, catalog, moduleList, properties] = await Promise.all([
    api.get<{ name: string; slug: string }>('/v1/tenant'),
    api.get<OnboardingStateDto>('/v1/tenant/onboarding'),
    api.get<{ blueprints: BlueprintDto[] }>('/v1/blueprints'),
    api.get<{ slug: string; enabled: boolean }[]>('/v1/tenant/modules'),
    listProperties().catch(() => []),
  ]);

  // First-run gallery shows ONLY blueprints that already have a real preview
  // screenshot — a polished showcase, never a placeholder. (Capturing the
  // remaining previews is a separate, tracked effort, intentionally not done here.)
  const blueprints: WizardBlueprint[] = catalog.blueprints
    .filter((b) => Boolean(b.preview))
    .map((b) => ({
      key: b.key,
      version: b.version,
      name: b.name,
      summary: b.summary,
      vertical: b.vertical,
      preview: b.preview ?? null,
      requiresModules: b.requiredModules ?? [],
      contents: b.contents,
      install: b.install,
    }));

  const preselectKey =
    sp.blueprint && blueprints.some((b) => b.key === sp.blueprint) ? sp.blueprint : null;

  // A `?step=` deep link wins over the persisted step; otherwise resume where the
  // tenant left off.
  const stepParam = VALID_STEPS.includes(sp.step as OnboardingStepKey)
    ? (sp.step as OnboardingStepKey)
    : null;

  // Module selection the switchboard starts from. A fresh tenant (modules step
  // not yet done, nothing enabled) gets the pricing-page default (Builder +
  // Commerce + CMS); otherwise their actual saved flags.
  const storedModules = Object.fromEntries(moduleList.map((m) => [m.slug, m.enabled]));
  const anyOn = moduleList.some((m) => m.enabled);
  const modules =
    !state.completed.modules && !anyOn
      ? { ...storedModules, ...Object.fromEntries(DEFAULT_ON.map((k) => [k, true])) }
      : storedModules;

  // The primary site's display name. Signup seeds it as "Default"; the Workspace
  // step's friendlier default is "Primary" (decision B).
  const primary = properties.find((p) => p.isPrimary) ?? properties[0];
  const rawSiteName = primary?.name ?? 'Primary';
  const siteName = rawSiteName === 'Default' ? 'Primary' : rawSiteName;

  // Storefront origin for the Launch preview. In prod the tenant's site lives at
  // its canonical zone subdomain; in dev the local storefront resolves tenants by
  // `?tenant=<slug>` (no per-tenant DNS), so point there and flag the param.
  const slug = tenant.slug ?? '';
  const isDev = process.env.NODE_ENV !== 'production';
  const siteOrigin = isDev
    ? (process.env.SPARX_SITE_DEV_ORIGIN ?? 'http://localhost:3004')
    : `https://${slug}.sparx.zone`;

  // Domain-checkout gate (mirrors api-rest's DOMAIN_PURCHASE_ENABLED, the security
  // boundary — this flag only governs UX). Off → the Domain step shows prices +
  // "checkout opens soon" instead of letting a tenant buy. Both read the same key
  // from the shared app-env, so they stay in lockstep.
  const domainPurchaseEnabled = process.env.DOMAIN_PURCHASE_ENABLED === 'true';

  return (
    <OnboardingWizard
      initial={{
        step: stepParam ?? state.currentStep,
        companyName: tenant.name ?? '',
        slug,
        siteName,
        modules,
        completed: state.completed,
        blueprints,
        blueprintKey: state.blueprintKey,
        installId: state.installId,
        preselectKey,
        siteOrigin,
        useTenantParam: isDev,
        domainPurchaseEnabled,
      }}
    />
  );
}
