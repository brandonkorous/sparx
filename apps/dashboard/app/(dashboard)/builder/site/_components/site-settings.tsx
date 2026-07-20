'use client';

// Site settings — the active web property's IDENTITY, on its own Builder surface
// (docs/49 per-site brand). These are the fields the silica frame binds through
// `site.identity` / `site.social` (the storefront header + footer): the customer-
// facing NAME, TAGLINE, light/dark LOGO, FAVICON, and SOCIAL links. They are
// Property-level config, NOT page content, so they live here rather than in the
// silica page editor (which owns layout + theme). Switching the active site
// (breadcrumb switcher) remounts this with that site's identity.
//
// Where each field persists (docs/49):
//   · name + socials      → the Property (updateSiteIdentity)
//   · tagline/logos/favicon → the tenant BASE brand for the primary site
//     (updateBrand), or THIS site's brandOverride for a non-primary one (diffed
//     against the base so untouched fields keep inheriting).
//
// Explicit-save (docs/86): edits accumulate; the Save button persists the whole
// draft; a leave-guard confirms before discarding. No autosave — parity with
// every other editor on the platform.

import * as React from 'react';
import { Save } from 'lucide-react';
import { Alert, Button, Input, Label, toast, useConfirm } from '@sparx/ui';
import { BrandImageField } from '../../_brand/components/brand-image-field';
import { SocialLinksEditor, type SocialLink } from '../../_brand/components/social-links-editor';
import { updateBrand, updateSettings, updateSiteIdentity } from '../../_brand/lib/actions';
import { resetSiteFrame } from '../../_lib/actions';
import { computeBrandOverride } from '../../_brand/lib/site-brand';
import type { AppearancePolicy, BrandDto, BrandMediaUrls, SiteDto } from '../../_brand/lib/types';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

interface MediaState {
  id: string | null;
  url: string | null;
}

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

// How the site decides light vs dark for visitors (docs/33). Theme colours are
// owned by the Builder editor now; this is the one presentation setting that
// isn't a colour, so it rides Site settings alongside identity.
const APPEARANCE_OPTIONS: { key: AppearancePolicy; label: string; help: string }[] = [
  { key: 'light-only', label: 'Light', help: 'Always show the light theme.' },
  { key: 'dark-only', label: 'Dark', help: 'Always show the dark theme.' },
  { key: 'auto', label: 'Auto', help: "Match each visitor's device setting." },
  { key: 'toggle', label: 'Toggle', help: 'Let visitors switch it themselves.' },
];

export interface SiteSettingsProps {
  // The active site (docs/49): its customer-facing name + own social links.
  site: SiteDto;
  // The EFFECTIVE brand the active site renders (tenant base for the primary
  // site, base+override for a non-primary one) — the source of the identity
  // fields we edit here (tagline/logos/favicon).
  brand: BrandDto;
  // The tenant BASE brand — a non-primary site's edits are diffed against this
  // so only what differs is stored as its override (and re-inherits when reset).
  baseBrand: BrandDto;
  // Resolved preview URLs for the three brand images (server-resolved so logos
  // paint on first load without a client round-trip).
  media: BrandMediaUrls;
  // How the site chooses light/dark for visitors (SiteConfig.appearancePolicy).
  appearancePolicy: AppearancePolicy;
}

export function SiteSettings({
  site,
  brand,
  baseBrand,
  media,
  appearancePolicy,
}: SiteSettingsProps) {
  const [siteName, setSiteName] = React.useState(site.name);
  const [tagline, setTagline] = React.useState(brand.tagline ?? '');
  const [socials, setSocials] = React.useState<SocialLink[]>(site.socials);
  const [policy, setPolicy] = React.useState<AppearancePolicy>(appearancePolicy);
  const [logoLight, setLogoLight] = React.useState<MediaState>({
    id: brand.logoLightMediaId,
    url: media.logoLight,
  });
  const [logoDark, setLogoDark] = React.useState<MediaState>({
    id: brand.logoDarkMediaId,
    url: media.logoDark,
  });
  const [favicon, setFavicon] = React.useState<MediaState>({
    id: brand.faviconMediaId,
    url: media.favicon,
  });

  const [status, setStatus] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // The identity slice as a stable signature — its divergence from the last-saved
  // baseline drives `dirty`. (Preview URLs aren't tracked; only the stored ids.)
  const signature = React.useMemo(
    () =>
      JSON.stringify({
        siteName,
        tagline,
        socials,
        logoLight: logoLight.id,
        logoDark: logoDark.id,
        favicon: favicon.id,
        policy,
      }),
    [siteName, tagline, socials, logoLight.id, logoDark.id, favicon.id, policy]
  );
  const savedRef = React.useRef(signature);
  const dirty = signature !== savedRef.current;

  useUnsavedGuard(dirty, { kind: 'edit', noun: 'site settings' });

  const saveState: SaveState =
    status === 'saving' ? 'saving' : status === 'error' ? 'error' : dirty ? 'unsaved' : status;

  const save = React.useCallback(async () => {
    setStatus('saving');
    setError(null);
    const cleanSocials = socials
      .map((s) => ({ platform: s.platform.trim(), url: s.url.trim() }))
      .filter((s) => s.platform && s.url);

    // The identity fields (tagline/logos/favicon) as a brand patch. For a
    // non-primary site they're folded into currentBrand and diffed into an
    // override; for the primary site they PATCH the tenant base brand directly.
    const identityBrand = {
      tagline: tagline.trim() || null,
      logoLightMediaId: logoLight.id,
      logoDarkMediaId: logoDark.id,
      faviconMediaId: favicon.id,
    };

    // Every persist for this save — each resolves to { ok, error? }, and the
    // whole save succeeds only if they all do. Appearance policy is a property-
    // scoped SiteConfig write, independent of identity (theme-service only
    // touches the policy column when it's the one field present).
    const tasks: Promise<{ ok: boolean; error?: string }>[] = [
      updateSettings({ appearancePolicy: policy }),
    ];
    if (site.isPrimary) {
      // name + socials on the Property; brand identity on the tenant base brand.
      if (site.id) {
        tasks.push(
          updateSiteIdentity(site.id, {
            name: siteName.trim() || undefined,
            socials: cleanSocials,
          })
        );
      }
      tasks.push(updateBrand(identityBrand));
    } else {
      // A non-primary site: name, socials, AND its brand override all ride ONE
      // Property PATCH. currentBrand carries the effective (already-overridden)
      // colours/fonts unchanged, so computeBrandOverride preserves them while
      // folding in the edited identity fields.
      const currentBrand: BrandDto = { ...brand, ...identityBrand };
      tasks.push(
        updateSiteIdentity(site.id, {
          name: siteName.trim() || undefined,
          socials: cleanSocials,
          brandOverride: computeBrandOverride(currentBrand, baseBrand),
        })
      );
    }
    const result = (await Promise.all(tasks)).find((r) => !r.ok) ?? { ok: true as const };

    if (result.ok) {
      savedRef.current = signature;
      setStatus('saved');
      toast.success('Site settings saved.');
    } else {
      setError(result.error ?? 'Could not save your changes.');
      setStatus('error');
      toast.error(result.error ?? 'Could not save your changes.');
    }
  }, [
    socials,
    tagline,
    logoLight.id,
    logoDark.id,
    favicon.id,
    policy,
    site.isPrimary,
    site.id,
    siteName,
    brand,
    baseBrand,
    signature,
  ]);

  const onSave = () => startTransition(() => void save());

  return (
    <div className="flex flex-col">
      {/* Toolbar — the shared Builder shape (docs/45): context lead + Save. */}
      <div className="bx-toolbar">
        <div className="bx-toolbar__templates">
          <span className="text-base-content text-sm font-semibold">Site settings</span>
        </div>
        <div className="bx-toolbar__actions">
          {saveState !== 'idle' ? (
            <span
              className="bx-savestate"
              data-state={saveState}
              title={saveState === 'error' ? (error ?? undefined) : undefined}
            >
              {SAVE_LABEL[saveState]}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="soft"
            leftIcon={<Save className="h-3.5 w-3.5" />}
            disabled={pending || !dirty}
            onClick={onSave}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="bx-ctx">
        <span className="bx-ctx__lead">Your site&apos;s identity</span>
        <span className="bx-ctx__note">
          The name, logo, and links customers see in your site&apos;s header, footer, and browser
          tab. <strong>Save</strong> keeps your changes.
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6 lg:px-8">
        {!site.isPrimary ? (
          <Alert color="info" variant="soft" size="sm">
            You&apos;re editing a secondary site. Its identity below overrides your main site — any
            value you leave blank keeps inheriting from it.
          </Alert>
        ) : null}

        <Card title="Name & tagline">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-name">Site name</Label>
            <Input
              id="site-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Acme Co."
            />
            <p className="text-base-content text-xs">
              The name customers see on this site — its title, header, and emails. Your
              business&apos;s legal or billing name lives in Settings → General.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="site-tagline">Tagline</Label>
            <Input
              id="site-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short line that sums up what you do"
            />
            <p className="text-base-content text-xs">
              An optional short phrase shown beside your name in some layouts.
            </p>
          </div>
        </Card>

        <Card title="Logo & favicon">
          <BrandImageField
            label="Logo (light backgrounds)"
            value={logoLight.id}
            previewUrl={logoLight.url}
            onChange={(id, url) => setLogoLight({ id, url })}
            help="Shown on light surfaces — your main header logo."
          />
          <BrandImageField
            label="Logo (dark backgrounds)"
            value={logoDark.id}
            previewUrl={logoDark.url}
            onChange={(id, url) => setLogoDark({ id, url })}
            help="A light or reversed logo for dark surfaces. Falls back to the light logo."
            dark
          />
          <BrandImageField
            label="Favicon"
            value={favicon.id}
            previewUrl={favicon.url}
            onChange={(id, url) => setFavicon({ id, url })}
            help="The small square icon shown in browser tabs and bookmarks."
          />
        </Card>

        <Card title="Social links" hint="Shown in this site's footer. Each site has its own.">
          <SocialLinksEditor socials={socials} setSocials={setSocials} />
        </Card>

        <Card
          title="Appearance"
          hint="How your site chooses light or dark for visitors. Your theme colours are set in the Builder editor."
        >
          <AppearancePicker value={policy} onChange={setPolicy} />
        </Card>

        <Card
          title="Header & footer"
          hint="The bar across the top of your site and the strip along the bottom."
        >
          <RestoreChrome />
        </Card>
      </div>
    </div>
  );
}

// The way out for a site whose header was built before logos were supported.
//
// A header is a saved arrangement of pieces, frozen the day the site was created.
// When we later taught the header's name area to show an uploaded logo, sites
// built beforehand kept their older, text-only version — so an author can upload a
// logo here, save, and see nothing change. We heal the headers we can recognise
// automatically, but on some older sites the name is an ordinary link and we can't
// tell it apart from a real menu link, so we leave it alone rather than risk
// rewriting the wrong thing. For those, rebuilding is the only fix.
//
// Immediate, not part of this page's draft — it edits the site layout, not these
// settings — so it confirms first and says so. It only changes the working copy;
// the live site is untouched until the author publishes.
function RestoreChrome() {
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);

  const onRestore = async () => {
    const go = await confirm({
      title: 'Rebuild your header and footer?',
      description:
        'Anything you have changed in your header or footer will be replaced with the standard design, using your current name and logo. Your pages are not affected, and your live site stays exactly as it is until you publish.',
      confirmLabel: 'Rebuild them',
      cancelLabel: 'Keep mine',
      // Genuinely destructive: an author's own header customisations are replaced,
      // and there is no undo for it on this surface.
      tone: 'danger',
    });
    if (!go) return;
    setBusy(true);
    const res = await resetSiteFrame();
    setBusy(false);
    if (res.ok) {
      toast.success('Your header and footer were rebuilt. Publish to make them live.');
    } else {
      toast.error(res.error ?? 'Could not rebuild your header and footer.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base-content text-sm">
        Added a logo but your header still shows your name as plain text? Your header was built
        before logos were supported. Rebuilding it starts from the standard design again, with your
        current name and logo already in place.
      </p>
      <Alert color="warning" variant="soft" size="sm">
        This replaces any changes you have made to your header or footer. Your pages stay as they
        are, and nothing changes for visitors until you publish. If you have the site editor open in
        another tab, refresh that tab afterwards so it picks up the rebuilt header.
      </Alert>
      <div>
        <Button
          type="button"
          size="sm"
          color="warning"
          variant="soft"
          disabled={busy}
          onClick={() => void onRestore()}
        >
          {busy ? 'Rebuilding…' : 'Rebuild header & footer'}
        </Button>
      </div>
    </div>
  );
}

// A segmented control for the light/dark policy — the sanctioned Button toggle
// pattern (soft = selected, ghost = not) in a bordered track, with the selected
// option's one-line explanation below so the choice is never cryptic.
function AppearancePicker({
  value,
  onChange,
}: {
  value: AppearancePolicy;
  onChange: (v: AppearancePolicy) => void;
}) {
  const active = APPEARANCE_OPTIONS.find((o) => o.key === value);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="border-base-300 flex flex-wrap gap-1 rounded-md border p-1"
      >
        {APPEARANCE_OPTIONS.map((o) => {
          const selected = o.key === value;
          return (
            <Button
              key={o.key}
              type="button"
              size="sm"
              role="radio"
              aria-checked={selected}
              color={selected ? 'primary' : 'neutral'}
              variant={selected ? 'soft' : 'ghost'}
              onClick={() => onChange(o.key)}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
      {active ? <p className="text-base-content text-xs">{active.help}</p> : null}
    </div>
  );
}

// A neutral settings card. This is a single-module working surface, so cards stay
// neutral (docs DESIGN.md) — identity rides the module-tinted chrome + Save button.
function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-base-300 bg-base-100 flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base-content text-sm font-semibold">{title}</h2>
        {hint ? <p className="text-base-content text-xs">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
