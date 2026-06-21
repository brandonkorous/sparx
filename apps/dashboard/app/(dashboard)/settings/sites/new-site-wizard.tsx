'use client';

// New-site create wizard (docs/49 Phase 8b). The single guided flow for spinning
// up an additional site over the shared back office — it replaces the inline
// create form on the Sites page. Three journey steps in the platform's modal
// WizardFrame (docs/86):
//
//   1. Starting point — a blank site, or a blueprint (a whole themed site:
//      pages, products, content, emails, theme — installed INTO the new site).
//   2. Name & address — the site name + URL handle, with a live preview of the
//      instant `<handle>.<tenant>.sparx.zone` address.
//   3. Review        — confirm, choose whether to publish a blueprint right away,
//      and create. A success panel then links into the Builder / live site.
//
// All work is one server action (createSiteWithBlueprint): create the Property →
// install the blueprint into it (the 8a route's explicit `property_id` target) →
// go live → switch the dashboard to it. The rail is Builder Indigo (multi-site is
// a Builder capability) via the wrapping ModuleProvider.

import * as React from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Input,
  Label,
  ModuleProvider,
  Spinner,
  Switch,
  Text,
  WizardFrame,
  WizardStep,
  cn,
  useConfirm,
  type WizardStepDef,
} from '@sparx/ui';
import { ArrowRight, Check, ExternalLink, Globe, PencilRuler } from 'lucide-react';

import { createSiteWithBlueprint, type NewSiteResult } from './actions';

export interface SiteBlueprintOption {
  key: string;
  name: string;
  summary: string;
  vertical: string;
  preview?: string;
  contents: {
    products: number;
    content: number;
    pages: number;
    emails: number;
    components: number;
    theme: string;
  };
}

interface NewSiteWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blueprints: SiteBlueprintOption[];
  /** `<tenant-slug>.sparx.zone` — the new site's address is `<handle>.<suffix>`. */
  zoneSuffix: string;
  /** Called after the modal closes following a successful create (parent refresh). */
  onCreated: () => void;
}

const STEPS: WizardStepDef[] = [
  { key: 'template', label: 'Starting point', sublabel: 'Blank or a blueprint' },
  { key: 'details', label: 'Name & address', sublabel: 'Title and handle' },
  { key: 'review', label: 'Review', sublabel: 'Confirm & create' },
];

// Mirrors slugifyProperty in api-rest: lowercase, hyphenated, ≤63 chars.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function contentsLine(c: SiteBlueprintOption['contents']): string {
  const parts: string[] = [];
  if (c.products > 0) parts.push(`${c.products} products`);
  if (c.content + c.pages > 0) parts.push(`${c.content + c.pages} pages`);
  if (c.emails > 0) parts.push(`${c.emails} emails`);
  parts.push(`${c.theme} theme`);
  return parts.join(' · ');
}

const BLANK = '__blank__';

export function NewSiteWizard({
  open,
  onOpenChange,
  blueprints,
  zoneSuffix,
  onCreated,
}: NewSiteWizardProps) {
  const confirm = useConfirm();
  const [step, setStep] = React.useState(0);
  // undefined = nothing chosen yet (Continue stays disabled); BLANK = empty site;
  // else a blueprint key.
  const [choice, setChoice] = React.useState<string | undefined>(undefined);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [publish, setPublish] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [upsell, setUpsell] = React.useState<{ module: string } | null>(null);
  const [result, setResult] = React.useState<NewSiteResult | null>(null);

  const reset = React.useCallback(() => {
    setStep(0);
    setChoice(undefined);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setPublish(true);
    setSubmitting(false);
    setError(null);
    setUpsell(null);
    setResult(null);
  }, []);

  // Reset to a clean slate whenever the modal is (re)opened.
  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const selectedBlueprint =
    choice && choice !== BLANK ? blueprints.find((b) => b.key === choice) : undefined;
  const effectiveSlug = (slugTouched ? slug : slugify(slug || name)) || 'your-site';
  const predictedHost = `${effectiveSlug}.${zoneSuffix}`;
  const done = result?.ok === true;

  function close() {
    onOpenChange(false);
    // If a site was created, let the parent refresh the list after the modal goes.
    if (done) onCreated();
  }

  // Has the user entered anything worth protecting from an accidental dismiss?
  // A created site is no longer "in progress" — closing it just dismisses the
  // success panel, so a done wizard is never dirty.
  const isDirty = !done && (choice !== undefined || name.trim() !== '' || slug.trim() !== '');

  // Ask before throwing away unsaved progress (docs/86; destructive-actions-confirm).
  function confirmDiscard(): Promise<boolean> {
    return confirm({
      title: 'Discard this site?',
      description:
        'You haven’t created this site yet — your starting point and details will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    });
  }

  // Radix backdrop-click / Esc guard (sync). Never drop a create mid-flight, and
  // block-then-ask when there's entered detail to lose — closing only on confirm.
  function requestClose(): boolean {
    if (submitting) return false;
    if (!isDirty) return true;
    void confirmDiscard().then((ok) => {
      if (ok) close();
    });
    return false;
  }

  // Footer Cancel / Close — same guard, for the explicit button (it bypasses the
  // Radix dismiss path, so it has to consult the guard itself).
  function onCancelClick() {
    if (submitting) return;
    if (!isDirty) {
      close();
      return;
    }
    void confirmDiscard().then((ok) => {
      if (ok) close();
    });
  }

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setUpsell(null);
    try {
      const res = await createSiteWithBlueprint({
        name: name.trim(),
        slug: slugTouched && slug.trim() ? slug.trim() : undefined,
        blueprintKey: choice === BLANK ? null : choice,
        publish,
      });
      if (res.ok) {
        setResult(res);
      } else if (res.paymentRequired) {
        setUpsell(res.paymentRequired);
      } else {
        setError(res.error ?? 'Something went wrong.');
        // A site may have been created even though the blueprint failed — keep it
        // visible by stashing the partial result for the success-ish panel.
        if (res.site) setResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step bodies ─────────────────────────────────────────────────────────────

  const templateStep = (
    <WizardStep
      header={{
        title: 'How should this site start?',
        supporting:
          'Begin from a blank canvas, or drop in a blueprint — a whole themed site (pages, products, content, emails) you can edit. It shares this workspace’s back office.',
      }}
      actions={{
        onNext: () => setStep(1),
        nextLabel: 'Continue',
        nextDisabled: choice === undefined,
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Blank site */}
        <button
          type="button"
          onClick={() => setChoice(BLANK)}
          aria-pressed={choice === BLANK}
          className={cn(
            'group flex min-h-[150px] flex-col items-start gap-2 rounded-xl border p-4 text-left transition-shadow',
            choice === BLANK
              ? 'border-[var(--module-active)] shadow-md ring-2 ring-[var(--module-active)]'
              : 'border-dashed border-[var(--color-border-strong)] hover:shadow-md'
          )}
        >
          <span className="flex items-center gap-2">
            <PencilRuler className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            <Text weight="medium">Blank site</Text>
            {choice === BLANK && (
              <Badge color="module" variant="solid" size="sm">
                <Check className="h-3 w-3" /> Selected
              </Badge>
            )}
          </span>
          <Text size="sm" variant="muted">
            An empty site with default chrome. Build it yourself in the Builder, or run it headless.
          </Text>
        </button>

        {/* Blueprints */}
        {blueprints.map((bp) => {
          const isSelected = choice === bp.key;
          return (
            <button
              key={bp.key}
              type="button"
              onClick={() => setChoice(bp.key)}
              aria-pressed={isSelected}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-surface)] text-left transition-shadow',
                isSelected
                  ? 'border-[var(--module-active)] shadow-md ring-2 ring-[var(--module-active)]'
                  : 'border-[var(--color-border-default)] hover:shadow-md'
              )}
            >
              <div className="relative aspect-[16/10] w-full border-b border-[var(--color-border-default)] bg-[var(--color-bg-subtle)]">
                {bp.preview && (
                  <div
                    className="h-full w-full bg-cover bg-top"
                    style={{ backgroundImage: `url("${bp.preview}")` }}
                  />
                )}
                <span className="absolute top-2.5 right-2.5">
                  {isSelected ? (
                    <Badge color="module" variant="solid" size="sm">
                      <Check className="h-3 w-3" /> Selected
                    </Badge>
                  ) : (
                    <Badge color="neutral" variant="solid" size="sm">
                      {bp.vertical}
                    </Badge>
                  )}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <Text weight="medium">{bp.name}</Text>
                <Text size="sm" variant="muted" className="line-clamp-2">
                  {bp.summary}
                </Text>
                <Text size="xs" variant="muted" className="mt-1">
                  {contentsLine(bp.contents)}
                </Text>
              </div>
            </button>
          );
        })}
      </div>
    </WizardStep>
  );

  const detailsStep = (
    <WizardStep
      header={{
        title: 'Name your site',
        supporting: 'The name shows in your dashboard. The handle anchors its instant web address.',
      }}
      actions={{
        onBack: () => setStep(0),
        onNext: () => setStep(2),
        nextLabel: 'Continue',
        nextDisabled: name.trim().length === 0,
      }}
    >
      <div className="flex flex-col gap-5">
        <div>
          <Label htmlFor="nsw-name">Site name</Label>
          <Input
            id="nsw-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Wholesale Portal"
          />
        </div>
        <div>
          <Label htmlFor="nsw-slug">URL handle</Label>
          <Input
            id="nsw-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="wholesale"
          />
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Globe className="h-4 w-4 shrink-0" />
            <span>
              Live instantly at{' '}
              <span className="font-medium text-[var(--color-text-primary)]">{predictedHost}</span>.
              Connect your own domain anytime from this Sites page.
            </span>
          </div>
        </div>
      </div>
    </WizardStep>
  );

  const reviewStep = (
    <WizardStep
      header={{ title: 'Review & create', supporting: 'One last look before your site is built.' }}
      actions={{
        onBack: () => setStep(1),
        onNext: () => void submit(),
        nextLabel: 'Create site',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-[var(--color-text-muted)]">Name</dt>
          <dd className="font-medium">{name.trim() || '—'}</dd>
          <dt className="text-[var(--color-text-muted)]">Address</dt>
          <dd className="font-medium">{predictedHost}</dd>
          <dt className="text-[var(--color-text-muted)]">Starting point</dt>
          <dd className="font-medium">
            {selectedBlueprint ? selectedBlueprint.name : 'Blank site'}
          </dd>
          {selectedBlueprint && (
            <>
              <dt className="text-[var(--color-text-muted)]">Includes</dt>
              <dd className="text-[var(--color-text-muted)]">
                {contentsLine(selectedBlueprint.contents)}
              </dd>
            </>
          )}
        </dl>

        {selectedBlueprint && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--color-border-default)] p-4">
            <span className="flex flex-col gap-0.5">
              <Text size="sm" weight="medium">
                Publish immediately
              </Text>
              <Text size="sm" variant="muted">
                Your new site goes live at its address right away. Turn this off to install
                everything as drafts and review before going live.
              </Text>
            </span>
            <Switch
              checked={publish}
              onCheckedChange={setPublish}
              aria-label="Publish immediately"
            />
          </div>
        )}

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </WizardStep>
  );

  // Builder-module upsell (a 2nd+ site needs Builder). Replaces the review body.
  const upsellPanel = (
    <WizardStep
      header={{
        title: 'Additional sites need the Builder module',
        supporting:
          'Every workspace includes one site. Turn on the Builder module to run as many sites as you need over the same back office.',
      }}
      actions={{ onBack: () => setUpsell(null), backLabel: 'Back' }}
    >
      <div className="flex flex-wrap gap-2">
        <Button color="module" asChild>
          <Link href="/settings/modules">Activate Builder</Link>
        </Button>
        <Button variant="ghost" onClick={() => setUpsell(null)}>
          Not now
        </Button>
      </div>
    </WizardStep>
  );

  // Success (or site-created-but-install-failed). No action row — bespoke CTAs.
  const successPanel = result && (
    <WizardStep
      header={{
        title: result.ok ? `“${result.site?.name}” is ready` : `“${result.site?.name}” was created`,
        supporting: result.ok
          ? result.live
            ? 'Your new site is live. Keep editing it anytime in the Builder.'
            : result.installId
              ? 'Your new site is set up as drafts. Review and go live when you’re ready.'
              : 'Your blank site is ready. Open it in the Builder to start designing.'
          : (error ?? 'The site was created, but the blueprint didn’t finish installing.'),
      }}
    >
      <div className="flex flex-col gap-5">
        {result.host && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] p-3 text-sm">
            <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
            <a
              href={`https://${result.host}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--module-active)] underline-offset-2 hover:underline"
            >
              {result.host}
              <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
            </a>
            {result.live ? (
              <Badge color="success" variant="soft" size="sm">
                Live
              </Badge>
            ) : (
              <Badge color="neutral" variant="soft" size="sm">
                Draft
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button color="module" asChild>
            <Link href="/builder">
              Open in Builder <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          {result.installId && !result.live && (
            <Button variant="outline" asChild>
              <Link href={`/marketplace/installs/${result.installId}`}>Review &amp; go live</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            Done
          </Button>
        </div>
      </div>
    </WizardStep>
  );

  let body: React.ReactNode;
  if (result) body = successPanel;
  else if (upsell) body = upsellPanel;
  else if (step === 0) body = templateStep;
  else if (step === 1) body = detailsStep;
  else body = reviewStep;

  return (
    <ModuleProvider module="builder">
      <WizardFrame
        variant="modal"
        title="New site"
        steps={STEPS}
        current={result || upsell ? 2 : step}
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
          else onOpenChange(true);
        }}
        onRequestClose={requestClose}
        footer={
          submitting ? (
            <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Spinner className="h-3.5 w-3.5" /> Creating…
            </span>
          ) : (
            <button
              type="button"
              onClick={onCancelClick}
              className="text-[var(--color-text-muted)] underline-offset-2 hover:underline"
            >
              {done ? 'Close' : 'Cancel'}
            </button>
          )
        }
      >
        {body}
      </WizardFrame>
    </ModuleProvider>
  );
}
