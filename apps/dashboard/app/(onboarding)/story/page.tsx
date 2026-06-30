import { redirect } from 'next/navigation';
import { requireSession } from '@sparx/auth';
import { api } from '@/lib/api-rest-client';
import { StoryComposer } from './_components/story-composer';
import { StoryTail } from './_components/story-tail';
import { storyFromPersisted, type PersistedStory } from './_lib/story-state';
import type { OnboardingStepKey, WizardBlueprint } from '../onboarding/_lib/types';

// The natural-language "story" onboarding — an alternative front end to the classic
// wizard at /onboarding (which is untouched). The owner narrates their business in a
// sentence or two; each clause activates a module and the right side fills in live.
// It is FULLY STANDALONE: on commit it runs the SAME pipeline as the wizard, then
// continues IN PAGE through the reused payments + launch steps. This server entry
// reads the blueprint catalog + saved state once, so it can either start the composer
// OR resume the tail (e.g. after the Stripe OAuth round-trip reloads the page).
export const dynamic = 'force-dynamic';

interface OnboardingStateDto {
  currentStep: OnboardingStepKey;
  finishedAt: string | null;
  blueprintKey: string | null;
  installId: string | null;
  story: PersistedStory | null;
}

interface BlueprintDto {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: WizardBlueprint['vertical'];
  preview?: string;
  requiredModules: string[];
  contents: WizardBlueprint['contents'];
  install: WizardBlueprint['install'];
}

export default async function StoryOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ stripe_connected?: string; stripe_error?: string }>;
}) {
  await requireSession();
  const sp = (await searchParams) ?? {};

  const [tenant, state, catalog] = await Promise.all([
    api.get<{ name: string; slug: string }>('/v1/tenant'),
    api.get<OnboardingStateDto>('/v1/tenant/onboarding'),
    api.getPaged<BlueprintDto[]>('/v1/blueprints?take=250'),
  ]);

  // Already onboarded — this route group has no guard of its own, so send finished
  // tenants to the dashboard (the wizard relies on the dashboard layout for this).
  if (state.finishedAt) redirect('/');

  const blueprints: WizardBlueprint[] = catalog.data.map((b) => ({
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

  // Storefront origin for the Launch preview/links — prod uses the tenant's canonical
  // zone subdomain; dev resolves tenants by `?tenant=<slug>` against the local site.
  const slug = tenant.slug ?? '';
  const isDev = process.env.NODE_ENV !== 'production';
  const siteOrigin = isDev
    ? (process.env.SPARX_SITE_DEV_ORIGIN ?? 'http://localhost:3004')
    : `https://${slug}.sparx.zone`;

  // Resume the tail when a story is already committed (e.g. the Stripe OAuth reload).
  // The narrative is persisted, so we rebuild the editable state to repaint the plan.
  const inTail =
    state.story && (state.currentStep === 'payments' || state.currentStep === 'launch');
  if (inTail && state.story) {
    return (
      <StoryTail
        story={storyFromPersisted(state.story)}
        blueprints={blueprints}
        installId={state.installId}
        blueprintKey={state.blueprintKey}
        initialStage={state.currentStep === 'payments' ? 'payments' : 'launch'}
        stripeConnected={sp.stripe_connected === '1'}
        siteOrigin={siteOrigin}
        useTenantParam={isDev}
      />
    );
  }

  return (
    <StoryComposer
      blueprints={blueprints}
      initialName={slug}
      siteOrigin={siteOrigin}
      useTenantParam={isDev}
    />
  );
}
