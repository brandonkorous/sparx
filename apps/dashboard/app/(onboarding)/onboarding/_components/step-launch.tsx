'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Heading, Stack, Text, cn } from '@sparx/ui';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  Monitor,
  PartyPopper,
  PencilRuler,
  Rocket,
  Smartphone,
} from 'lucide-react';
import {
  finishOnboardingAction,
  getPreviewTokenAction,
  publishAndFinishAction,
} from '../_lib/actions';

const STORE_ZONE = 'sparx.zone';
// Where "Customize" drops the tenant — the Builder, on the draft we just installed.
const BUILDER_HREF = '/builder/page';

type Device = 'desktop' | 'mobile';

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

export function StepLaunch({
  slug,
  installId,
  siteOrigin,
  useTenantParam,
  onDifferentTemplate,
}: {
  slug: string;
  /** The install to publish on Launch; null on the "start from scratch" path. */
  installId: string | null;
  siteOrigin: string;
  useTenantParam: boolean;
  /** Jump back to the template gallery to re-pick. */
  onDifferentTemplate: () => void;
}) {
  // No template installed → the scratch finish screen (no showcase to preview).
  if (!installId) {
    return <ScratchFinish />;
  }

  return (
    <TemplateLaunch
      slug={slug}
      installId={installId}
      urls={{ siteOrigin, useTenantParam }}
      onDifferentTemplate={onDifferentTemplate}
    />
  );
}

// ── Blueprint path: preview the draft site, then one-tap publish ───────────────

function TemplateLaunch({
  slug,
  installId,
  urls,
  onDifferentTemplate,
}: {
  slug: string;
  installId: string;
  urls: LaunchUrls;
  onDifferentTemplate: () => void;
}) {
  const [token, setToken] = React.useState<string | null>(null);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [device, setDevice] = React.useState<Device>('desktop');
  const [published, setPublished] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [publishing, startPublish] = React.useTransition();

  // The pretty, canonical address shown in chrome — always the zone host, even in
  // dev where the iframe actually loads from the local origin.
  const displayHost = `${slug}.${STORE_ZONE}`;

  // Mint the draft-preview token on mount so the iframe can render the
  // installed-but-unpublished site.
  React.useEffect(() => {
    let active = true;
    void getPreviewTokenAction().then((res) => {
      if (!active) return;
      if (res.ok) setToken(res.data.token);
      else setTokenError(res.error);
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

  const previewSrc = token
    ? buildSiteUrl(urls.siteOrigin, slug, urls.useTenantParam, token)
    : null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Chrome bar — the preview's command surface. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-2.5">
        <Stack direction="row" align="center" gap={3} className="min-w-0">
          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            onClick={onDifferentTemplate}
            disabled={publishing}
            leftIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Different template
          </Button>
          <span className="hidden h-5 w-px bg-[var(--color-border-default)] sm:block" />
          <Stack direction="row" align="center" gap={2} className="min-w-0">
            <Text size="sm" weight="medium" className="truncate">
              {displayHost}
            </Text>
            <Badge color="warning" variant="soft">
              Draft preview
            </Badge>
          </Stack>
        </Stack>

        {/* Device toggle — resizes the preview frame, not the window. */}
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-border-default)] p-0.5">
          <DeviceButton
            active={device === 'desktop'}
            onClick={() => setDevice('desktop')}
            label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </DeviceButton>
          <DeviceButton
            active={device === 'mobile'}
            onClick={() => setDevice('mobile')}
            label="Mobile preview"
          >
            <Smartphone className="h-4 w-4" />
          </DeviceButton>
        </div>

        <Stack direction="row" align="center" gap={2}>
          <Button
            variant="soft"
            color="neutral"
            asChild
            leftIcon={<PencilRuler className="h-4 w-4" />}
          >
            <Link href={BUILDER_HREF}>Customize</Link>
          </Button>
          <Button
            color="module"
            onClick={publish}
            disabled={publishing || !token}
            loading={publishing}
            leftIcon={publishing ? undefined : <Rocket className="h-4 w-4" />}
          >
            Publish
          </Button>
        </Stack>
      </div>

      {error && (
        <Text size="sm" variant="danger" role="alert" aria-live="polite" className="px-4 py-2">
          {error}
        </Text>
      )}

      {/* Preview stage. */}
      <div className="flex flex-1 justify-center overflow-auto bg-[var(--color-bg-subtle)] p-4">
        {tokenError ? (
          <Stack gap={2} align="center" justify="center" className="text-center">
            <Text variant="muted">Couldn&apos;t load the preview.</Text>
            <Text size="sm" variant="danger">
              {tokenError}
            </Text>
          </Stack>
        ) : !previewSrc ? (
          <Stack gap={2} align="center" justify="center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--module-active)]" />
            <Text size="sm" variant="muted">
              Loading your site…
            </Text>
          </Stack>
        ) : (
          <div
            className={cn(
              'h-full overflow-hidden rounded-lg border border-[var(--color-border-default)] bg-white shadow-sm transition-all',
              device === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'
            )}
          >
            <iframe
              src={previewSrc}
              title="Your site preview"
              className="h-full w-full"
              // The storefront is a different origin; the preview is display-only.
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-7 w-8 items-center justify-center rounded transition-colors',
        active
          ? 'bg-[var(--module-active-tint)] text-[var(--module-active)]'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
      )}
    >
      {children}
    </button>
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
