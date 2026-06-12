'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Card, Heading, Stack, Text } from '@sparx/ui';
import {
  ArrowRight,
  Boxes,
  ExternalLink,
  Globe,
  PartyPopper,
  PencilRuler,
  Receipt,
  Rocket,
  Shuffle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { getPreviewTokenAction } from '../_lib/actions';
import type { OnboardingModule } from '../_lib/modules';
import type { PendingDomain, WizardBlueprint } from '../_lib/types';

const STORE_ZONE = 'sparx.zone';
const BUILDER_HREF = '/builder/page';

function usd(n: number): string {
  return n.toLocaleString('en-US');
}

/** Env-aware storefront URL. Prod resolves the tenant by its zone subdomain;
 *  dev resolves by `?tenant=<slug>`. A preview token, when given, serves the
 *  DRAFT. */
function buildSiteUrl(
  siteOrigin: string,
  slug: string,
  useTenantParam: boolean,
  token?: string
): string {
  const params = new URLSearchParams();
  if (useTenantParam) params.set('tenant', slug);
  if (token) params.set('sparxSitePreview', token);
  const qs = params.toString();
  return qs ? `${siteOrigin}/?${qs}` : `${siteOrigin}/`;
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

// Step 6 — Launch (work pane). The terminal celebration — and the best moment to
// make the tenant FEEL the value before they publish: a prominent savings banner
// (monthly + annualized), the "everything you switched on" list showing what each
// module replaces and what it'd cost elsewhere, and what the blueprint already
// dropped into their site. The primary action (Publish my site) lives in the
// setup card; this body is the upsell + the secondary affordances. `published`
// flips it to the success view.
export function StepLaunch({
  slug,
  installId,
  blueprint,
  siteOrigin,
  useTenantParam,
  published,
  modules,
  monthlyTotal,
  monthlyElsewhere,
  pendingDomain,
  onDifferentTemplate,
}: {
  slug: string;
  installId: string | null;
  blueprint: WizardBlueprint | null;
  siteOrigin: string;
  useTenantParam: boolean;
  published: boolean;
  modules: OnboardingModule[];
  monthlyTotal: number;
  monthlyElsewhere: number;
  /** A paid domain chosen earlier — charged + registered when they publish. */
  pendingDomain: PendingDomain | null;
  onDifferentTemplate: () => void;
}) {
  const [token, setToken] = React.useState<string | null>(null);
  const host = `${slug}.${STORE_ZONE}`;

  React.useEffect(() => {
    if (!installId) return;
    let active = true;
    void getPreviewTokenAction().then((res) => {
      if (active && res.ok) setToken(res.data.token);
    });
    return () => {
      active = false;
    };
  }, [installId]);

  if (published) {
    return <LaunchSuccess slug={slug} siteOrigin={siteOrigin} useTenantParam={useTenantParam} />;
  }

  const monthlySavings = Math.max(0, monthlyElsewhere - monthlyTotal);
  const annualSavings = monthlySavings * 12;

  // Scratch path — nothing to publish; the card's CTA opens the Builder.
  if (!installId) {
    return (
      <div className="mx-auto max-w-xl">
        <Stack gap={5} align="center" className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
            <PencilRuler className="h-7 w-7 text-[var(--module-active)]" />
          </span>
          <Stack gap={2} align="center">
            <Heading level={2}>Your workspace is ready</Heading>
            <Text variant="muted">
              You&apos;re starting from a blank canvas. Hit{' '}
              <span className="font-medium text-[var(--color-text-primary)]">Finish setup</span> to
              open the Builder and design your site — publish whenever you&apos;re ready.
            </Text>
          </Stack>
        </Stack>
        {pendingDomain && (
          <div className="mt-7">
            <DomainChargeCard domain={pendingDomain} />
          </div>
        )}
        {monthlySavings > 0 && (
          <div className="mt-7">
            <SavingsBanner
              monthlySavings={monthlySavings}
              annualSavings={annualSavings}
              count={modules.length}
              monthlyTotal={monthlyTotal}
            />
          </div>
        )}
      </div>
    );
  }

  const previewHref = token ? buildSiteUrl(siteOrigin, slug, useTenantParam, token) : null;
  const facts = contentFacts(blueprint);

  return (
    <div className="mx-auto max-w-xl">
      <Stack gap={5} align="center" className="text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
          <Rocket className="h-7 w-7 text-[var(--module-active)]" />
        </span>
        <Stack gap={2} align="center">
          <Heading level={2}>Your site is ready</Heading>
          <Text variant="muted">
            {blueprint ? (
              <>
                The{' '}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {blueprint.name}
                </span>{' '}
                blueprint is installed as a private draft. Publishing makes it live at{' '}
                <span className="font-medium text-[var(--color-text-primary)]">{host}</span> —
                nothing&apos;s locked, so keep editing in the Builder anytime.
              </>
            ) : (
              <>
                Your site is installed as a private draft. Publishing makes it live at{' '}
                <span className="font-medium text-[var(--color-text-primary)]">{host}</span> — and
                you can keep editing it in the Builder afterward.
              </>
            )}
          </Text>
        </Stack>
      </Stack>

      {/* ── Paid domain (charged at publish) ──────────────────────────────── */}
      {pendingDomain && (
        <div className="mt-7">
          <DomainChargeCard domain={pendingDomain} />
        </div>
      )}

      {/* ── The value: savings banner ─────────────────────────────────────── */}
      {monthlySavings > 0 && (
        <div className="mt-7">
          <SavingsBanner
            monthlySavings={monthlySavings}
            annualSavings={annualSavings}
            count={modules.length}
            monthlyTotal={monthlyTotal}
          />
        </div>
      )}

      {/* ── Why that number is real (the platform value) ──────────────────── */}
      <div className="mt-5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <Stack gap={4}>
          <ValuePoint
            icon={<Boxes className="h-4 w-4 text-[var(--module-active)]" />}
            title="One platform, not a patched-together stack"
            body="Your storefront, content, customers, and email run on one database — nothing to integrate, sync, or keep in step. It just works together."
          />
          <ValuePoint
            icon={<Receipt className="h-4 w-4 text-[var(--module-active)]" />}
            title="One login, one invoice"
            body="Flat per-module pricing — no per-seat fees, no cut of every order, no surprise overages. Turn modules on and off anytime."
          />
          <ValuePoint
            icon={<TrendingUp className="h-4 w-4 text-[var(--module-active)]" />}
            title="Built to grow with you"
            body="From your first sale to enterprise volume on the same platform — and an MCP-native API so AI can run it all, no re-platforming ever."
          />
        </Stack>
      </div>

      {/* ── Already in your site (blueprint content) ──────────────────────── */}
      {facts.length > 0 && (
        <Text size="sm" variant="muted" className="mt-4 block text-center">
          {facts.join(' · ')} — installed and ready to edit.
        </Text>
      )}

      {/* ── Secondary actions (Publish lives in the setup card) ───────────── */}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          color="module"
          asChild
          disabled={!previewHref}
          rightIcon={<ExternalLink className="h-3.5 w-3.5" />}
        >
          <a
            href={previewHref ?? '#'}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!previewHref}
          >
            Preview in a new tab
          </a>
        </Button>
        <Button
          variant="soft"
          color="neutral"
          asChild
          leftIcon={<PencilRuler className="h-4 w-4" />}
        >
          <Link href={BUILDER_HREF}>Customize first</Link>
        </Button>
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          onClick={onDifferentTemplate}
          leftIcon={<Shuffle className="h-3.5 w-3.5" />}
        >
          Choose a different blueprint
        </Button>
      </div>
    </div>
  );
}

// The chosen paid domain, shown on Launch as a one-time charge line item — the
// "and charge it here" half of the disclosure: you picked it on the Domain step
// for free; publishing is where it's actually billed and registered.
function DomainChargeCard({ domain }: { domain: PendingDomain }) {
  const first = `$${(domain.displayPrice / 100).toFixed(2)}`;
  const renews =
    domain.renewalDisplayPrice > domain.displayPrice
      ? `$${(domain.renewalDisplayPrice / 100).toFixed(2)}`
      : null;
  return (
    <div className="rounded-2xl border border-[var(--module-active)] bg-[var(--module-active-tint)] px-6 py-5 text-left">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-[var(--module-active)]" />
        <Text size="sm" weight="medium" className="text-[var(--module-active)]">
          Custom domain
        </Text>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Text weight="medium" className="text-lg">
          {domain.domain}
        </Text>
        <Text size="sm" variant="muted">
          <span className="font-medium text-[var(--color-text-primary)]">{first}</span> charged when
          you publish{renews ? ` · then ${renews}/yr` : ''}
        </Text>
      </div>
      <Text size="xs" variant="muted" className="mt-2 block">
        We register it and point it at your site automatically — no DNS to set up. Not ready? Go
        back a step and switch to your free address; you won&apos;t be charged.
      </Text>
    </div>
  );
}

function ValuePoint({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--module-active-tint)]">
        {icon}
      </span>
      <div>
        <Text size="sm" weight="medium">
          {title}
        </Text>
        <Text size="sm" variant="muted">
          {body}
        </Text>
      </div>
    </div>
  );
}

function SavingsBanner({
  monthlySavings,
  annualSavings,
  count,
  monthlyTotal,
}: {
  monthlySavings: number;
  annualSavings: number;
  count: number;
  monthlyTotal: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-success-border,var(--color-border-default))] bg-[var(--color-success-tint)] px-6 py-5 text-center">
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--color-success-text)]" />
        <Text size="sm" weight="medium" className="text-[var(--color-success-text)]">
          You&apos;re saving
        </Text>
      </div>
      <div className="mt-1 flex items-baseline justify-center gap-1">
        <span className="text-[3rem] leading-[1] font-medium tracking-[-0.04em] text-[var(--color-success-text)]">
          ${usd(monthlySavings)}
        </span>
        <span className="text-lg text-[var(--color-success-text)]/70">/mo</span>
      </div>
      <Text size="sm" variant="muted" className="mx-auto mt-2 block max-w-[42ch]">
        That&apos;s{' '}
        <span className="font-medium text-[var(--color-text-primary)]">${usd(annualSavings)}</span>{' '}
        a year. {count} best-in-class {count === 1 ? 'tool' : 'tools'} on one platform, one login,
        one invoice — for ${usd(monthlyTotal)}/mo after your free trial.
      </Text>
    </div>
  );
}

function LaunchSuccess({
  slug,
  siteOrigin,
  useTenantParam,
}: {
  slug: string;
  siteOrigin: string;
  useTenantParam: boolean;
}) {
  const liveUrl = buildSiteUrl(siteOrigin, slug, useTenantParam);
  return (
    <div className="mx-auto max-w-xl">
      <Stack gap={5}>
        <Stack gap={3} align="center" className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
            <PartyPopper className="h-7 w-7 text-[var(--module-active)]" />
          </span>
          <Heading level={2}>You&apos;re live</Heading>
          <Text variant="muted">
            Your site is published and ready for the world. Here&apos;s where to go next.
          </Text>
          <Button color="primary" variant="link" asChild>
            <a href={liveUrl} target="_blank" rel="noreferrer">
              {slug}.{STORE_ZONE}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </Stack>

        <Stack gap={3}>
          <NextCard
            href={BUILDER_HREF}
            title="Make it yours"
            description="Edit copy, swap images, and rearrange sections in the Builder."
          />
          <NextCard
            href="/commerce/products"
            title="Build out your catalog"
            description="Add your own products, pricing, variants, and media."
          />
          <NextCard
            href="/welcome"
            title="Finish the setup checklist"
            description="A few day-one tasks to get production-ready."
          />
        </Stack>
      </Stack>
    </div>
  );
}

function NextCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card padding="md" className="hover:border-[var(--module-active)]">
        <Stack direction="row" align="center" justify="between" gap={3}>
          <Stack gap={1}>
            <Text weight="medium">{title}</Text>
            <Text size="sm" variant="muted">
              {description}
            </Text>
          </Stack>
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
        </Stack>
      </Card>
    </Link>
  );
}
