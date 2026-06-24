'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Heading, Text, SurfaceFrame, type SurfaceStepDef } from '@sparx/ui';
import {
  checkSlugAction,
  completeDomainStepAction,
  completePaymentsAction,
  finishOnboardingAction,
  goToStepAction,
  publishAndFinishAction,
  purchaseSelectedDomainAction,
  saveModulesAction,
  saveWorkspaceAction,
  selectTemplateAction,
  startFromScratchAction,
} from '../_lib/actions';
import {
  ONBOARDING_MODULES,
  isSellingSelected,
  effectiveModuleOn,
  moduleLock,
  moduleBilled,
  moduleElsewhere,
} from '../_lib/modules';
import type {
  OnboardingStepKey,
  PendingDomain,
  SlugAvailability,
  WizardInitialState,
} from '../_lib/types';
import type { DomainSelection } from '@/app/(dashboard)/settings/domains/purchase-dialog';
import { StepModules } from './step-modules';
import { StepBlueprint } from './step-blueprint';
import { StepWorkspace } from './step-workspace';
import { StepDomain } from './step-domain';
import { StepPayments } from './step-payments';
import { StepLaunch } from './step-launch';
import { SummaryCard, type SummaryEntry } from './summary-card';
import { RailFooter } from './rail-footer';

// The orchestrator for the modules-first guided setup (docs/15 v2). It is the
// BRAIN: it owns every step's state, computes the next/back math, and renders the
// persistent two-column content area — a swapping WORK pane on the left and a
// constant SUMMARY CARD on the right. The card houses the primary CTA on every
// step (so navigation is consistent) and accretes a receipt as the tenant goes.
// The step components are presentational bodies; all the wiring lives here.

export type SlugCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: SlugAvailability };

const STEP_DEFS: Record<OnboardingStepKey, SurfaceStepDef> = {
  modules: { key: 'modules', label: 'Modules', sublabel: 'What you need' },
  template: { key: 'template', label: 'Blueprint', sublabel: 'A starting point' },
  workspace: { key: 'workspace', label: 'Workspace', sublabel: 'Name your site' },
  domain: { key: 'domain', label: 'Domain', sublabel: 'Make it yours' },
  payments: { key: 'payments', label: 'Payments', sublabel: 'Get paid' },
  launch: { key: 'launch', label: 'Launch', sublabel: 'Go live' },
};

interface RailCopy {
  title: string;
  blurb: string;
  context: string;
}

const RAIL: Record<OnboardingStepKey, RailCopy> = {
  modules: {
    title: 'Switch on what you use.',
    blurb: 'One toggle per module. Free for 14 days.',
    context:
      'Switch on only what you need — the bill updates live and your picks narrow the blueprints that fit. Free for 14 days, no card today.',
  },
  template: {
    title: 'Pick a starting point.',
    blurb: 'A complete, themed site — not a blank page.',
    context:
      'Every blueprint installs a whole site — pages, design, products, copy. Filtered to your modules; search to widen it.',
  },
  workspace: {
    title: 'Name your workspace.',
    blurb: 'Your company and its first site.',
    context:
      'Pre-filled from signup — tweak anything. Set your free .sparx.zone address here; it locks once you launch.',
  },
  domain: {
    title: 'Make it yours.',
    blurb: 'Claim a custom domain — or start free.',
    context:
      'A custom domain builds trust and is yours to keep. Skip it and your free .sparx.zone address works instantly.',
  },
  payments: {
    title: 'Get paid.',
    blurb: 'Connect Stripe to accept customer payments.',
    context:
      'This connects the account that RECEIVES money from your customers — separate from your sparx subscription. Skippable.',
  },
  launch: {
    title: 'Ready to launch.',
    blurb: "Your site is built. One tap and it's live.",
    context:
      'Publishing makes your draft live at your address. Keep editing in the Builder afterward — anytime.',
  },
};

const HEAD: Partial<Record<OnboardingStepKey, { title: string; supporting: string }>> = {
  modules: {
    title: 'Switch on what you use',
    supporting:
      "Every module is one toggle — flip it and your plan updates the instant you do. You're free for 14 days with no card; this is just what you'll pay after. Your picks narrow the blueprints next.",
  },
  template: {
    title: 'Pick a starting point',
    supporting:
      'Complete, themed sites — pages, design, products, and copy in place from the first second. Filtered to the modules you chose; pick one to load it into your setup.',
  },
  workspace: {
    title: 'Name your workspace',
    supporting:
      'This is your company and its first site. We pre-filled what you told us at signup — tweak anything. Your free address goes live the moment you launch.',
  },
  domain: {
    title: 'Make it yours',
    supporting:
      "A custom domain builds trust — and it's yours to keep. Grab the perfect one now, or start free on your .sparx.zone address and add a domain anytime.",
  },
  payments: {
    title: 'Get paid',
    supporting:
      "Connect your Stripe account so your site can take customer payments. Your site can go live now and you can connect this whenever you're ready — checkout stays off until then.",
  },
  // launch renders its own hero in the body.
};

const FULL_ORDER: OnboardingStepKey[] = [
  'modules',
  'template',
  'workspace',
  'domain',
  'payments',
  'launch',
];

/** A blueprint key, the literal `'scratch'` sentinel (blank-canvas path), or
 *  null when nothing is chosen yet. */
type BlueprintChoice = string | null;

export function OnboardingWizard({ initial }: { initial: WizardInitialState }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeConnected = searchParams.get('stripe_connected') === '1';

  const [step, setStep] = React.useState<OnboardingStepKey>(initial.step);
  const [modules, setModules] = React.useState<Record<string, boolean>>(initial.modules);

  // Blueprint: `choice` is the SELECTED key (or scratch / null); `installedKey` +
  // `installId` are what's actually provisioned. Selecting only sets `choice`;
  // Continue installs (select-then-confirm). A marketplace-referred visitor
  // (`?blueprint=`) lands with their pick pre-selected.
  const [choice, setChoice] = React.useState<BlueprintChoice>(
    initial.blueprintKey ?? initial.preselectKey
  );
  const [installedKey, setInstalledKey] = React.useState<string | null>(initial.blueprintKey);
  const [installId, setInstallId] = React.useState<string | null>(initial.installId);

  // Workspace fields (lifted so the card can echo them live).
  const [companyName, setCompanyName] = React.useState(initial.companyName);
  const [slug, setSlug] = React.useState(initial.slug);
  const [siteName, setSiteName] = React.useState(initial.siteName);
  const [slugCheck, setSlugCheck] = React.useState<SlugCheck>({ status: 'idle' });

  // Domain choice — null = the free `.sparx.zone` address (the no-card default, so
  // Continue always works). A `PendingDomain` is a paid domain the tenant chose
  // but hasn't paid for: it's registered + charged at Launch, not here.
  const [pendingDomain, setPendingDomain] = React.useState<PendingDomain | null>(null);

  const [published, setPublished] = React.useState(false);
  const [busy, startBusy] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const selling = isSellingSelected(modules);
  const order = React.useMemo(
    () => (selling ? FULL_ORDER : FULL_ORDER.filter((s) => s !== 'payments')),
    [selling]
  );

  const idx = Math.max(0, order.indexOf(step));
  const nextKey = order[Math.min(idx + 1, order.length - 1)] ?? 'launch';
  const prevKey = order[Math.max(idx - 1, 0)] ?? 'modules';

  // ── Plan math ───────────────────────────────────────────────────────────────
  // Effective state applies the dependency graph (Commerce co-enabled by B2B,
  // Invoicing bundled free with either); bundled capabilities bill $0.
  const activeModules = ONBOARDING_MODULES.filter((m) => effectiveModuleOn(modules, m.key));
  const total = activeModules.reduce((s, m) => s + moduleBilled(modules, m), 0);
  const elsewhere = activeModules.reduce((s, m) => s + moduleElsewhere(modules, m), 0);
  const planItems = activeModules.map((m) => ({
    key: m.key,
    name: m.name,
    price: moduleBilled(modules, m),
    included: moduleLock(modules, m.key) === 'included',
    colorVar: m.colorVar,
  }));

  // ── Slug availability (debounced) — drives Workspace validity ────────────────
  const normalizedSlug = slug.trim().toLowerCase();
  const unchangedSlug = normalizedSlug === initial.slug.trim().toLowerCase();
  React.useEffect(() => {
    if (!normalizedSlug || unchangedSlug) {
      setSlugCheck({ status: 'idle' });
      return;
    }
    setSlugCheck({ status: 'checking' });
    const handle = setTimeout(() => {
      void checkSlugAction(normalizedSlug).then((res) => {
        if (res.ok) setSlugCheck({ status: 'done', result: res.data });
        else setSlugCheck({ status: 'idle' });
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [normalizedSlug, unchangedSlug]);

  const slugOk = unchangedSlug || (slugCheck.status === 'done' && slugCheck.result.available);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goPersist = React.useCallback(
    (target: OnboardingStepKey) => {
      startBusy(async () => {
        await goToStepAction(target);
        setStep(target);
      });
    },
    [startBusy]
  );

  const blueprintName = (key: string | null): string | null => {
    if (!key) return null;
    return initial.blueprints.find((b) => b.key === key)?.name ?? null;
  };

  // ── Per-step commit (the card's primary CTA) ─────────────────────────────────
  function onContinue() {
    setError(null);
    startBusy(async () => {
      let res: { ok: boolean; error?: string } = { ok: true };
      switch (step) {
        case 'modules':
          res = await saveModulesAction(modules);
          break;
        case 'template':
          if (choice === 'scratch') {
            res = await startFromScratchAction();
            if (res.ok) {
              setInstalledKey(null);
              setInstallId(null);
            }
          } else if (choice) {
            const r = await selectTemplateAction(choice);
            res = r;
            if (r.ok) {
              setInstalledKey(choice);
              setInstallId(r.data.installId);
            }
          }
          break;
        case 'workspace':
          res = await saveWorkspaceAction({
            companyName: companyName.trim(),
            slug: normalizedSlug,
            siteName: siteName.trim(),
          });
          break;
        case 'domain':
          res = await completeDomainStepAction(nextKey);
          break;
        case 'payments':
          res = await completePaymentsAction({ paymentsConnected: stripeConnected, next: nextKey });
          break;
        case 'launch': {
          if (published) {
            router.push('/');
            return;
          }
          // Buy the chosen domain FIRST (charge + register). A failure here — card
          // declined, domain taken since they picked it, or checkout closed —
          // blocks launch with the API's message; we never publish onto a domain
          // we couldn't secure.
          if (pendingDomain && initial.domainPurchaseEnabled) {
            const bought = await purchaseSelectedDomainAction(pendingDomain);
            if (!bought.ok) {
              setError(bought.error ?? 'We couldn’t complete the domain purchase.');
              return;
            }
            setPendingDomain(null);
          }
          if (installId) {
            res = await publishAndFinishAction(installId);
            if (res.ok) {
              setPublished(true);
              return;
            }
          } else {
            res = await finishOnboardingAction();
            if (res.ok) {
              router.push('/builder/studio');
              return;
            }
          }
          break;
        }
      }
      if (res.ok) setStep(nextKey);
      else setError(res.error ?? 'Something went wrong.');
    });
  }

  // A paid domain was chosen in the Domain step's select dialog — hold it (it's
  // charged + registered at Launch, not now). Continue advances normally.
  function onDomainSelected(selection: DomainSelection) {
    setPendingDomain(selection);
    setError(null);
  }
  function onDomainCleared() {
    setPendingDomain(null);
  }

  // ── canContinue + CTA label per step ─────────────────────────────────────────
  const canContinue = (() => {
    switch (step) {
      case 'modules':
        return activeModules.length > 0;
      case 'template':
        return choice !== null;
      case 'workspace':
        return companyName.trim().length > 0 && siteName.trim().length > 0 && Boolean(slugOk);
      default:
        return true;
    }
  })();

  const ctaLabel = (() => {
    switch (step) {
      case 'template':
        return choice === 'scratch' ? 'Start from scratch' : 'Use this blueprint';
      case 'payments':
        return stripeConnected ? 'Continue' : 'Skip for now';
      case 'launch':
        if (published) return 'Go to dashboard';
        if (pendingDomain && initial.domainPurchaseEnabled) {
          return installId ? 'Pay & publish' : 'Pay & finish';
        }
        return installId ? 'Publish my site' : 'Finish setup';
      default:
        return 'Continue';
    }
  })();

  // ── Accreting receipt rows ───────────────────────────────────────────────────
  const entries: SummaryEntry[] = [];
  const pushEntry = (
    key: OnboardingStepKey,
    label: string,
    value: React.ReactNode,
    pending = false
  ) => {
    const sIdx = order.indexOf(key);
    if (sIdx < 0 || sIdx > idx) return; // not reached yet
    entries.push({
      key,
      label,
      value,
      status: pending ? 'pending' : sIdx < idx ? 'done' : 'active',
    });
  };

  const chosenBlueprintLabel =
    choice === 'scratch' ? 'Start from scratch' : (blueprintName(choice) ?? 'Pick a blueprint');
  pushEntry('template', 'Blueprint', chosenBlueprintLabel, choice === null);
  pushEntry('workspace', 'Workspace', `${normalizedSlug || initial.slug}.sparx.zone`);
  pushEntry(
    'domain',
    'Domain',
    pendingDomain
      ? `${pendingDomain.domain} · $${(pendingDomain.displayPrice / 100).toFixed(2)} at launch`
      : `Free · ${normalizedSlug || initial.slug}.sparx.zone`
  );
  if (selling) {
    pushEntry('payments', 'Payments', stripeConnected ? 'Connected' : 'Set up later');
  }

  // ── Work body per step ───────────────────────────────────────────────────────
  let body: React.ReactNode;
  switch (step) {
    case 'modules':
      body = <StepModules value={modules} onChange={setModules} />;
      break;
    case 'template':
      body = (
        <StepBlueprint
          blueprints={initial.blueprints}
          selectedModules={modules}
          preselectKey={initial.preselectKey}
          selectedKey={choice}
          onSelect={setChoice}
        />
      );
      break;
    case 'workspace':
      body = (
        <StepWorkspace
          companyName={companyName}
          slug={slug}
          siteName={siteName}
          onCompany={setCompanyName}
          onSlug={setSlug}
          onSite={setSiteName}
          check={slugCheck}
          unchangedSlug={unchangedSlug}
        />
      );
      break;
    case 'domain':
      body = (
        <StepDomain
          slug={normalizedSlug || initial.slug}
          defaultQuery={initial.companyName.replace(/[^a-z0-9]+/gi, '').toLowerCase()}
          purchaseEnabled={initial.domainPurchaseEnabled}
          selectedHost={pendingDomain?.domain ?? null}
          onSelect={onDomainSelected}
          onClearSelection={onDomainCleared}
        />
      );
      break;
    case 'payments':
      body = <StepPayments stripeConnected={stripeConnected} />;
      break;
    case 'launch':
      body = (
        <StepLaunch
          slug={normalizedSlug || initial.slug}
          installId={installId}
          blueprint={initial.blueprints.find((b) => b.key === installedKey) ?? null}
          siteOrigin={initial.siteOrigin}
          useTenantParam={initial.useTenantParam}
          published={published}
          modules={activeModules}
          monthlyTotal={total}
          monthlyElsewhere={elsewhere}
          pendingDomain={pendingDomain}
          onDifferentTemplate={() => goPersist('template')}
        />
      );
      break;
  }

  const onStepSelect = (_key: string, index: number) => {
    if (index < idx) goPersist(order[index]!);
  };

  const head = HEAD[step];

  return (
    <SurfaceFrame
      variant="page"
      lede={{ title: RAIL[step].title, blurb: RAIL[step].blurb }}
      context={RAIL[step].context}
      steps={order.map((k) => STEP_DEFS[k])}
      current={idx}
      onStepSelect={onStepSelect}
      footer={<RailFooter />}
    >
      <div className="mx-auto w-full max-w-[1120px] px-12 py-12 max-[940px]:px-5 max-[940px]:py-8">
        <div className="grid grid-cols-[1fr_340px] items-start gap-8 max-[1040px]:grid-cols-1">
          {/* WORK column — swaps per step */}
          <div className="min-w-0">
            {head && (
              <div className="flex flex-col gap-2">
                <Heading level={2}>{head.title}</Heading>
                <Text variant="muted" className="max-w-[58ch]">
                  {head.supporting}
                </Text>
              </div>
            )}
            <div
              key={step}
              className={`${head ? 'mt-7' : ''}animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none`}
            >
              {body}
            </div>
          </div>

          {/* SUMMARY card — persistent across steps */}
          <SummaryCard
            plan={{ total, elsewhere, items: planItems }}
            entries={entries}
            cta={{ label: ctaLabel, onClick: onContinue, disabled: !canContinue, loading: busy }}
            onBack={idx > 0 ? () => goPersist(prevKey) : undefined}
            error={error}
            collapsibleModules={idx > 0}
          />
        </div>
      </div>
    </SurfaceFrame>
  );
}
