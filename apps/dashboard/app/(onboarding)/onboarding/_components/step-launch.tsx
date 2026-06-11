'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Heading, Stack, Text } from '@sparx/ui';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  PartyPopper,
  PencilRuler,
  Rocket,
} from 'lucide-react';
import {
  finishOnboardingAction,
  getPreviewTokenAction,
  publishAndFinishAction,
} from '../_lib/actions';
import type { WizardBlueprint } from '../_lib/types';

const STORE_ZONE = 'sparx.zone';
// Where "Customize" drops the tenant — the Builder, on the draft we just installed.
const BUILDER_HREF = '/builder/page';

/** Build a storefront URL for this tenant, env-aware. Prod resolves the tenant by
 *  its zone subdomain (siteOrigin already carries the slug); dev resolves it by a
 *  `?tenant=<slug>` query against the shared local origin. A preview token, when
 *  given, serves the DRAFT. */
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

interface LaunchUrls {
  siteOrigin: string;
  useTenantParam: boolean;
}

/** The "what you're about to publish" facts, mirroring the gallery card's line. */
function contentFacts(bp: WizardBlueprint | null): string[] {
  if (!bp) return [];
  const c = bp.contents;
  const facts: string[] = [];
  if (c.products > 0) facts.push(`${c.products} products`);
  if (c.content > 0) facts.push(`${c.content} pages of content`);
  if (c.emails > 0) facts.push(`${c.emails} emails`);
  facts.push(`${c.theme} theme`);
  return facts;
}

export function StepLaunch({
  slug,
  installId,
  blueprint,
  siteOrigin,
  useTenantParam,
  onDifferentTemplate,
}: {
  slug: string;
  /** The install to publish on Launch; null on the "start from scratch" path. */
  installId: string | null;
  /** The chosen template (for the summary), resolved from the catalog. */
  blueprint: WizardBlueprint | null;
  siteOrigin: string;
  useTenantParam: boolean;
  /** Jump back to the template gallery to re-pick. */
  onDifferentTemplate: () => void;
}) {
  // No template installed → the scratch finish screen (nothing to publish).
  if (!installId) {
    return <ScratchFinish />;
  }

  return (
    <TemplateLaunch
      slug={slug}
      installId={installId}
      blueprint={blueprint}
      urls={{ siteOrigin, useTenantParam }}
      onDifferentTemplate={onDifferentTemplate}
    />
  );
}

// ── Blueprint path: confirm what's installed, then one-tap publish ─────────────
//
// No embedded preview: the site is installed as a DRAFT, and the storefront only
// serves PUBLISHED catalog/content — so a pre-publish preview shows empty product
// + journal grids, which reads as "unfinished" exactly when we want confidence.
// Instead we summarize what's set up and offer a full-fidelity "Preview in a new
// tab" (the real site, draft token) for anyone who wants to look before launching.

function TemplateLaunch({
  slug,
  installId,
  blueprint,
  urls,
  onDifferentTemplate,
}: {
  slug: string;
  installId: string;
  blueprint: WizardBlueprint | null;
  urls: LaunchUrls;
  onDifferentTemplate: () => void;
}) {
  const [token, setToken] = React.useState<string | null>(null);
  const [published, setPublished] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publishing, startPublish] = React.useTransition();

  const host = `${slug}.${STORE_ZONE}`;

  // Mint a draft-preview token on mount so "Preview in a new tab" opens the DRAFT.
  React.useEffect(() => {
    let active = true;
    void getPreviewTokenAction().then((res) => {
      if (active && res.ok) setToken(res.data.token);
    });
    return () => {
      active = false;
    };
  }, []);

  function publish() {
    setError(null);
    startPublish(async () => {
      const res = await publishAndFinishAction(installId);
      if (res.ok) setPublished(true);
      else setError(res.error);
    });
  }

  if (published) {
    return <LaunchSuccess slug={slug} urls={urls} />;
  }

  const previewHref = token
    ? buildSiteUrl(urls.siteOrigin, slug, urls.useTenantParam, token)
    : null;
  const facts = contentFacts(blueprint);

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <Stack gap={8}>
        <Stack gap={3} align="center" className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
            <Rocket className="h-7 w-7 text-[var(--module-active)]" />
          </span>
          <Heading level={1}>Your site is ready</Heading>
          <Text variant="muted">
            {blueprint
              ? `The ${blueprint.name} template is installed and styled. Publish to make it live at ${host}.`
              : `Your site is installed and styled. Publish to make it live at ${host}.`}
          </Text>
        </Stack>

        {facts.length > 0 && (
          <Stack direction="row" justify="center" gap={2} className="flex-wrap">
            {facts.map((f) => (
              <Badge key={f} variant="soft" color="neutral">
                {f}
              </Badge>
            ))}
          </Stack>
        )}

        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite" className="text-center">
            {error}
          </Text>
        )}

        <Stack gap={3} align="center">
          <Button
            color="module"
            size="lg"
            onClick={publish}
            disabled={publishing}
            loading={publishing}
            leftIcon={publishing ? undefined : <Rocket className="h-4 w-4" />}
            className="w-full"
          >
            {publishing ? 'Publishing…' : 'Publish my site'}
          </Button>

          <Stack direction="row" justify="center" gap={2} className="flex-wrap">
            <Button
              variant="soft"
              color="neutral"
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
              variant="ghost"
              color="neutral"
              asChild
              leftIcon={<PencilRuler className="h-4 w-4" />}
            >
              <Link href={BUILDER_HREF}>Customize first</Link>
            </Button>
          </Stack>

          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={onDifferentTemplate}
            disabled={publishing}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Choose a different template
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

// ── Success: the site is live ─────────────────────────────────────────────────

function LaunchSuccess({ slug, urls }: { slug: string; urls: LaunchUrls }) {
  const liveUrl = buildSiteUrl(urls.siteOrigin, slug, urls.useTenantParam);
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <Stack gap={8}>
        <Stack gap={3} align="center" className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
            <PartyPopper className="h-7 w-7 text-[var(--module-active)]" />
          </span>
          <Heading level={1}>You&apos;re live</Heading>
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

        <Stack direction="row" justify="center">
          <Button color="module" asChild rightIcon={<ArrowRight className="h-4 w-4" />}>
            <Link href="/">Go to dashboard</Link>
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

// ── Scratch path: workspace ready, no showcase to publish ─────────────────────

function ScratchFinish() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function go(href: string) {
    startTransition(async () => {
      await finishOnboardingAction();
      router.push(href);
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <Stack gap={8}>
        <Stack gap={3} align="center" className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--module-active-tint)]">
            <PencilRuler className="h-7 w-7 text-[var(--module-active)]" />
          </span>
          <Heading level={1}>Your workspace is ready</Heading>
          <Text variant="muted">
            You&apos;re starting from a blank canvas. Open the Builder to design your site, then
            publish it whenever you&apos;re ready.
          </Text>
        </Stack>

        <Stack direction="row" justify="center" gap={3}>
          <Button variant="ghost" color="neutral" onClick={() => go('/')} disabled={pending}>
            Go to dashboard
          </Button>
          <Button
            color="module"
            onClick={() => go(BUILDER_HREF)}
            disabled={pending}
            loading={pending}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Open the Builder
          </Button>
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
