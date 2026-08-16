'use client';

// Step 6 — Launch (the work pane). The terminal screen, and the best moment to make
// the value land before publishing: the live address, what the tenant is saving
// every month, and what the chosen starting point already dropped into their site.
// The primary action — Publish, or Finish for the blank path — is the setup card's
// CTA (the orchestrator owns it); this body is the reassurance plus the Preview
// affordance. `published` flips it to the success view.

import { useEffect, useState } from 'react';
import { Button, Text } from '@wizeworks/silicaui-react';
import {
  faArrowTrendUp,
  faArrowUpRightFromSquare,
  faBoxes,
  faGlobe,
  faPencilRuler,
  faReceipt,
  faRocket,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { storefrontPreviewUrl, type OnboardingActions } from '../../../lib/onboarding/api';
import type { PendingDomain, WizardBlueprint } from '../../../lib/onboarding/types';

const SITE_ZONE = 'sparx.zone';

function usd(n: number): string {
  return n.toLocaleString('en-US');
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function contentFacts(bp: WizardBlueprint | null): string[] {
  if (!bp) return [];
  const c = bp.contents;
  const facts: string[] = [];
  if (c.pages > 0) facts.push(`${c.pages} pages`);
  if (c.products > 0) facts.push(`${c.products} products`);
  if (c.content > 0) facts.push(`${c.content} content entries`);
  if (c.emails > 0) facts.push(`${c.emails} emails`);
  facts.push(`${c.theme} theme`);
  return facts;
}

export function StepLaunch({
  slug,
  installId,
  blueprint,
  builderEnabled,
  published,
  moduleCount,
  monthlyTotal,
  monthlyElsewhere,
  pendingDomain,
  actions,
}: {
  slug: string;
  installId: string | null;
  blueprint: WizardBlueprint | null;
  builderEnabled: boolean;
  published: boolean;
  moduleCount: number;
  monthlyTotal: number;
  monthlyElsewhere: number;
  pendingDomain: PendingDomain | null;
  actions: OnboardingActions;
}) {
  const [token, setToken] = useState<string | null>(null);
  const host = `${slug}.${SITE_ZONE}`;

  useEffect(() => {
    if (!installId) return;
    let active = true;
    void actions
      .getPreviewToken()
      .then((t) => {
        if (active) setToken(t);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [installId, actions]);

  if (published) {
    return <LaunchSuccess slug={slug} host={host} />;
  }

  const monthlySavings = Math.max(0, monthlyElsewhere - monthlyTotal);
  const annualSavings = monthlySavings * 12;
  const facts = contentFacts(blueprint);
  const previewHref = installId && token ? storefrontPreviewUrl(slug, token) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="bg-module flex size-14 items-center justify-center rounded-full">
          {installId ? (
            <Icon glyph={faRocket} className="text-module-content size-7" aria-hidden />
          ) : (
            <Icon glyph={faPencilRuler} className="text-module-content size-7" aria-hidden />
          )}
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {installId ? 'Your site is ready' : 'Your workspace is ready'}
          </h2>
          <Text className="mx-auto max-w-prose">
            {installId ? (
              <>
                {blueprint ? (
                  <>
                    The <span className="font-medium">{blueprint.name}</span> starting point is
                    installed as a private draft.{' '}
                  </>
                ) : (
                  'Your site is installed as a private draft. '
                )}
                Publishing makes it live at <span className="font-medium">{host}</span> — nothing
                locks, so keep editing in the Builder anytime.
              </>
            ) : builderEnabled ? (
              <>
                You are starting from a blank canvas. Finish setup to open the Builder and design
                your site — publish whenever you are ready.
              </>
            ) : (
              <>Everything is set up and ready to use. Finish setup to head into your workspace.</>
            )}
          </Text>
        </div>
      </div>

      <div className="border-base-300 bg-base-100 flex items-center justify-between gap-4 rounded-xl border px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon glyph={faGlobe} className="text-module size-4 shrink-0" aria-hidden />
          <span className="truncate font-medium">{host}</span>
        </div>
        {previewHref ? (
          <Button
            variant="outline"
            color="module"
            size="sm"
            iconEnd={<Icon glyph={faArrowUpRightFromSquare} className="size-3.5" aria-hidden />}
            render={
              <a
                href={previewHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Preview your site in a new tab"
              />
            }
          >
            Preview
          </Button>
        ) : null}
      </div>

      {pendingDomain ? (
        <div className="border-module ring-module rounded-xl border px-5 py-4 ring-1">
          <div className="flex items-center gap-2">
            <Icon glyph={faGlobe} className="text-module size-4" aria-hidden />
            <span className="text-module text-sm font-medium">Custom domain</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-lg font-medium">{pendingDomain.domain}</p>
            <p className="text-sm">
              <span className="font-medium">{money(pendingDomain.displayPrice)}</span> charged when
              you publish
            </p>
          </div>
          <p className="mt-2 text-sm">
            We register it and point it at your site automatically — no DNS to set up. Not ready? Go
            back a step and switch to your free address; you will not be charged.
          </p>
        </div>
      ) : null}

      {monthlySavings > 0 ? (
        <div className="border-success rounded-xl border px-6 py-5 text-center">
          <span className="text-success text-sm font-medium">You are saving</span>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-success text-5xl font-semibold tracking-tight">
              ${usd(monthlySavings)}
            </span>
            <span className="text-success text-lg">/mo</span>
          </div>
          <Text className="mx-auto mt-2 max-w-prose text-sm">
            That is <span className="font-medium">${usd(annualSavings)}</span> a year. {moduleCount}{' '}
            best-in-class {moduleCount === 1 ? 'tool' : 'tools'} on one platform, one login, one
            invoice — for ${usd(monthlyTotal)}/mo after your free trial.
          </Text>
        </div>
      ) : null}

      <div className="border-base-300 bg-base-100 flex flex-col gap-4 rounded-xl border p-5">
        <ValuePoint
          icon={<Icon glyph={faBoxes} className="text-module size-4" aria-hidden />}
          title="One platform, not a patched-together stack"
          body="Your site, content, customers, and email run on one database — nothing to integrate, sync, or keep in step."
        />
        <ValuePoint
          icon={<Icon glyph={faReceipt} className="text-module size-4" aria-hidden />}
          title="One login, one invoice"
          body="Flat per-module pricing — no per-seat fees, no cut of every order, no surprise overages. Turn modules on and off anytime."
        />
        <ValuePoint
          icon={<Icon glyph={faArrowTrendUp} className="text-module size-4" aria-hidden />}
          title="Built to grow with you"
          body="From your first sale to enterprise volume on the same platform — and an AI-native API so it can all be run in plain English."
        />
      </div>

      {facts.length > 0 ? (
        <Text className="text-center text-sm">
          {facts.join(' · ')} — installed and ready to edit.
        </Text>
      ) : null}
    </div>
  );
}

function ValuePoint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-module soft mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm">{body}</p>
      </div>
    </div>
  );
}

function LaunchSuccess({ slug, host }: { slug: string; host: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
      <span className="bg-module flex size-14 items-center justify-center rounded-full">
        <Icon glyph={faRocket} className="text-module-content size-7" aria-hidden />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">You are live</h2>
      <Text className="max-w-prose">
        Your site is published and ready for the world. It is live at{' '}
        <span className="font-medium">{host}</span> — opening your workspace now.
      </Text>
      <Button
        color="module"
        variant="link"
        iconEnd={<Icon glyph={faArrowUpRightFromSquare} className="size-3.5" aria-hidden />}
        render={
          <a
            href={storefrontPreviewUrl(slug)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${host} in a new tab`}
          />
        }
      >
        {host}
      </Button>
    </div>
  );
}
