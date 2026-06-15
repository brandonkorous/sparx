'use client';

// The Brand & Theme center — the merged "Look" surface (docs/30 Brand+Theme,
// docs/33 token model v2). One screen, three columns: theme picker (rail) ·
// grouped controls · live component showcase. It replaces the separate Brand
// board and Theme inspector: a single source for the tenant's identity AND its
// presentation overlay, with the showcase recompiling on every keystroke so the
// tenant sees the brand applied across the whole platform without an iframe.
//
//   edit → compileThemeForTenant(themeKey, brand, presentation)
//        → buildThemeCssV2(..., { rootSelector:'#st-theme-preview' })   ← scoped, instant
//        → debounced updateBrand / updateSettings                       ← persists
//
// The same compile runs server-side on publish, so the showcase tells the truth.
// Brand-owned slots persist via /v1/brand; presentation via the site config —
// the two owners stay clean even though they share one form (docs/33 §3.6).

import * as React from 'react';
import { ChevronDown, Copy, Moon, Pencil, Plus, Save, Sun, Trash2, Upload } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  toast,
  useConfirm,
} from '@sparx/ui';
import {
  buildThemeCssV2,
  compileThemeForTenant,
  THEME_DEFAULTS_V2,
  THEME_LIST,
  type PresentationColorOverlay,
  type PresentationOverlayV2,
} from '@sparx/site-themes';
import {
  applySavedTheme,
  deleteSavedTheme,
  publishNow,
  saveTheme,
  selectTheme,
  updateBrand,
  updateSavedTheme,
  updateSettings,
  updateSiteIdentity,
  type BrandPatch,
} from '../lib/actions';
import type {
  AppearancePolicy,
  BrandDto,
  BrandMediaUrls,
  SiteConfigDto,
  SiteDto,
  SitePreviewConfig,
  SiteThemeDto,
} from '../lib/types';
import { computeBrandOverride } from '../lib/site-brand';
import { cleanTokens, type BrandTokens } from '../lib/brand-feel';
import { BrandThemeControls, type MediaState } from './brand-theme-controls';
import { ThemeShowcase } from './theme-showcase';
import { SitePreviewFrame } from './site-preview-frame';

type Mode = 'light' | 'dark';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Toolbar autosave label — mirrors the page/site editors' bx-savestate (docs/45).
const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

// The per-mode colour slots — everything in the presentation overlay. Brand
// identity (primary/secondary/accent), type, and shape are mode-independent, so
// they're NOT part of this; only surfaces, neutral, status, highlight, and the
// line colour differ between light and dark. Used by "copy this mode → other".
const COPYABLE_MODE_KEYS = [
  'base100',
  'base200',
  'base300',
  'baseContent',
  'neutral',
  'neutralContent',
  'info',
  'infoContent',
  'success',
  'successContent',
  'warning',
  'warningContent',
  'danger',
  'dangerContent',
  'highlight',
  'highlightContent',
  'border',
] as const satisfies readonly (keyof PresentationColorOverlay)[];

// The brand identity colours that carry a per-swatch "revert" affordance. Held
// as the last-SAVED snapshot so a swatch only shows its reset control while it
// differs from what's persisted (it clears once the debounced save commits).
interface BrandColorSnapshot {
  colorPrimary: string | null;
  colorPrimaryForeground: string | null;
  colorAccent: string | null;
  colorAccentForeground: string | null;
  colorSecondary: string | null;
  colorSecondaryForeground: string | null;
}
function pickBrandColors(src: Partial<BrandColorSnapshot>): BrandColorSnapshot {
  return {
    colorPrimary: src.colorPrimary ?? null,
    colorPrimaryForeground: src.colorPrimaryForeground ?? null,
    colorAccent: src.colorAccent ?? null,
    colorAccentForeground: src.colorAccentForeground ?? null,
    colorSecondary: src.colorSecondary ?? null,
    colorSecondaryForeground: src.colorSecondaryForeground ?? null,
  };
}

// A theme's signature palette — primary · accent · base100 — surfaced as three
// dots on the switcher so the tenant can see what a theme looks like before
// applying it (mirrors the old picker rail's swatches). For a prebuilt preset
// that's the preset's own light tokens; for a saved theme it overlays the
// captured brand identity + presentation base100 so two saved themes read
// distinctly.
function swatchFor(
  presetKey: string,
  opts?: { primary?: string | null; accent?: string | null; base100?: string | null }
): string[] {
  const preset = THEME_DEFAULTS_V2[presetKey as keyof typeof THEME_DEFAULTS_V2];
  const light = preset?.light ?? THEME_DEFAULTS_V2.apex.light;
  return [
    opts?.primary ?? light.primary,
    opts?.accent ?? light.accent,
    opts?.base100 ?? light.base100,
  ];
}

// Three overlapping color dots — the per-theme preview shown on the switcher
// trigger and every dropdown row. Background colors ride on inline `style`
// (real palette values, not design-system tokens), so this isn't a re-skin.
function ThemeDots({ colors }: { colors: string[] }) {
  return (
    <span className="flex flex-none -space-x-1" aria-hidden>
      {colors.map((c, i) => (
        <span
          key={i}
          className="h-4 w-4 rounded-full border border-[var(--color-border-default)]"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}

// Segmented control flipping the preview column between the component showcase
// and the tenant's live site (docs/49). Mirrors the showcase's Light/Dark toggle
// shape so the two read as one control family.
function PreviewSurfaceToggle({
  value,
  onChange,
}: {
  value: 'components' | 'site';
  onChange: (v: 'components' | 'site') => void;
}) {
  return (
    <div className="flex rounded-md border border-[var(--color-border-default)] p-0.5">
      {(
        [
          ['components', 'Components'],
          ['site', 'Site'],
        ] as const
      ).map(([v, label]) => (
        <Button
          key={v}
          size="xs"
          variant={value === v ? 'soft' : 'ghost'}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export interface ThemeCenterProps {
  // The EFFECTIVE brand the active site renders (base for primary, base+override
  // for a non-primary site). Drives the form + the live showcase.
  brand: BrandDto;
  // The tenant BASE brand — a non-primary site's edits are diffed against this so
  // only what differs is stored as its override (and re-inherits when reset).
  baseBrand: BrandDto;
  // The active site (docs/49) — its name + socials are per-site; `isPrimary`
  // routes brand edits to the base brand vs this site's override.
  site: SiteDto;
  config: SiteConfigDto;
  savedThemes: SiteThemeDto[];
  media: BrandMediaUrls;
  // Where the live "Site" preview iframe points (docs/49) — the active site's
  // public origin + tenant/property slugs.
  sitePreview: SitePreviewConfig;
}

export function ThemeCenter({
  brand,
  baseBrand,
  site,
  config,
  savedThemes: initialSaved,
  media,
  sitePreview,
}: ThemeCenterProps) {
  // ── Per-site identity (persists on the Property, docs/49) ──────────────────
  // The customer-facing SITE name (Property.name) — NOT the tenant's legal name.
  const [siteName, setSiteName] = React.useState(site.name);
  const [socials, setSocials] = React.useState(site.socials);

  // ── Brand state (primary → /v1/brand; non-primary → this site's override) ──
  const [tagline, setTagline] = React.useState(brand.tagline ?? '');
  const [colorPrimary, setColorPrimary] = React.useState<string | null>(brand.colorPrimary);
  const [colorPrimaryForeground, setColorPrimaryForeground] = React.useState<string | null>(
    brand.colorPrimaryForeground
  );
  const [colorAccent, setColorAccent] = React.useState<string | null>(brand.colorAccent);
  const [colorAccentForeground, setColorAccentForeground] = React.useState<string | null>(
    brand.colorAccentForeground
  );
  const [colorSecondary, setColorSecondary] = React.useState<string | null>(brand.colorSecondary);
  const [colorSecondaryForeground, setColorSecondaryForeground] = React.useState<string | null>(
    brand.colorSecondaryForeground
  );
  // Last-saved brand identity colours — drives each swatch's "revert" control so
  // it only appears while a colour is edited-but-unsaved (see the brand autosave).
  const [savedBrandColors, setSavedBrandColors] = React.useState<BrandColorSnapshot>(() =>
    pickBrandColors(brand)
  );
  const [fontHeading, setFontHeading] = React.useState<string | null>(brand.fontHeading);
  const [fontBody, setFontBody] = React.useState<string | null>(brand.fontBody);
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
  const [tokens, setTokens] = React.useState<BrandTokens>(brand.tokens ?? {});

  // ── Presentation state (persists via the site config) ──────────────────────
  const [themeKey, setThemeKey] = React.useState(config.themeKey);
  const [policy, setPolicy] = React.useState<AppearancePolicy>(config.appearancePolicy);
  const [presentation, setPresentation] = React.useState<PresentationOverlayV2>(
    config.draftSettings.presentation ?? { v: 2 }
  );

  const [savedThemes, setSavedThemes] = React.useState<SiteThemeDto[]>(initialSaved);
  // The saved theme currently selected for editing (null = editing a prebuilt
  // base). When set, presentation edits write back into that theme (below).
  // Seeded from the persisted draft so the rail restores the selection on reload
  // — the pointer rides in draftSettings (see the settings autosave).
  const [activeSavedThemeId, setActiveSavedThemeId] = React.useState<string | null>(
    config.draftSettings.activeSavedThemeId ?? null
  );
  const activeSavedIdRef = React.useRef(activeSavedThemeId);
  React.useEffect(() => {
    activeSavedIdRef.current = activeSavedThemeId;
  }, [activeSavedThemeId]);
  const [mode, setMode] = React.useState<Mode>(
    config.appearancePolicy === 'dark-only' ? 'dark' : 'light'
  );
  const [status, setStatus] = React.useState<SaveState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const confirm = useConfirm();

  const cleanedTokens = React.useMemo(() => cleanTokens(tokens), [tokens]);

  // ── Live compile → scoped CSS for the showcase ────────────────────────────
  const brandCols = React.useMemo(
    () => ({
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      tokens: cleanedTokens,
    }),
    [
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      cleanedTokens,
    ]
  );
  const compiled = React.useMemo(
    () => compileThemeForTenant({ themeKey, brand: brandCols, presentation }),
    [themeKey, brandCols, presentation]
  );
  const css = React.useMemo(
    () => buildThemeCssV2(compiled, { rootSelector: '#st-theme-preview' }),
    [compiled]
  );
  // The SAME compiled theme, scoped to `:root` — posted to the live site preview
  // iframe (the storefront's PreviewBridge injects it so the real site re-themes
  // on every edit). Separate from `css` only in selector scope.
  const rootCss = React.useMemo(() => buildThemeCssV2(compiled), [compiled]);

  // Which preview the right column shows: the component showcase (default) or the
  // tenant's live site in an iframe (docs/49). The site origin always resolves in
  // practice; guard anyway so a missing origin just hides the toggle.
  const [previewSurface, setPreviewSurface] = React.useState<'components' | 'site'>('components');
  const canPreviewSite = Boolean(sitePreview.origin && sitePreview.tenantSlug);

  // ── Debounced autosave: brand ──────────────────────────────────────────────
  // The brand fields to persist. `businessName` is NOT here — it's deprecated as a
  // name source (the site name is Property.name, saved separately). For a primary
  // site this is the /v1/brand PATCH body; for a non-primary site the same field
  // set is diffed into this site's override (see saveBrand).
  const brandPatch = React.useMemo<BrandPatch>(
    () => ({
      tagline: tagline.trim() || null,
      logoLightMediaId: logoLight.id,
      logoDarkMediaId: logoDark.id,
      faviconMediaId: favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      tokens: cleanedTokens,
    }),
    [
      tagline,
      logoLight.id,
      logoDark.id,
      favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      cleanedTokens,
    ]
  );

  // The full effective brand assembled from current state — used to diff a
  // non-primary site's edits into an override (only what differs from the base
  // is stored, so it keeps inheriting everything else).
  const currentBrand = React.useMemo<BrandDto>(
    () => ({
      tenantId: brand.tenantId,
      businessName: brand.businessName,
      tagline: tagline.trim() || null,
      logoLightMediaId: logoLight.id,
      logoDarkMediaId: logoDark.id,
      faviconMediaId: favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      tokens: cleanedTokens,
    }),
    [
      brand.tenantId,
      brand.businessName,
      tagline,
      logoLight.id,
      logoDark.id,
      favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      colorSecondary,
      colorSecondaryForeground,
      fontHeading,
      fontBody,
      cleanedTokens,
    ]
  );

  // Persist the brand to the right place for the active site: the tenant BASE
  // brand for the primary site (so "edit the brand everywhere" works), or this
  // site's OVERRIDE for a non-primary one (diffed against the base).
  const saveBrand = React.useCallback(() => {
    if (site.isPrimary) return updateBrand(brandPatch);
    return updateSiteIdentity(site.id, {
      brandOverride: computeBrandOverride(currentBrand, baseBrand),
    });
  }, [site.isPrimary, site.id, brandPatch, currentBrand, baseBrand]);

  const savedBrandRef = React.useRef(JSON.stringify(brandPatch));
  React.useEffect(() => {
    const cur = JSON.stringify(brandPatch);
    if (cur === savedBrandRef.current) return;
    setStatus('saving');
    const t = setTimeout(() => {
      void (async () => {
        const res = await saveBrand();
        if (res.ok) {
          savedBrandRef.current = cur;
          setSavedBrandColors(pickBrandColors(brandPatch));
          setStatus('saved');
        } else {
          setError(res.error ?? 'Could not save your brand.');
          setStatus('error');
          toast.error(res.error ?? 'Could not save your brand changes.');
        }
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [brandPatch, saveBrand]);

  // ── Debounced autosave: site name + social links (per-site, on the Property) ─
  const savedSiteRef = React.useRef(JSON.stringify({ name: siteName, socials }));
  React.useEffect(() => {
    if (!site.id) return; // brand-new tenant with no property yet — nothing to save
    const cur = JSON.stringify({ name: siteName, socials });
    if (cur === savedSiteRef.current) return;
    setStatus('saving');
    const t = setTimeout(() => {
      void (async () => {
        const cleanSocials = socials
          .map((s) => ({ platform: s.platform.trim(), url: s.url.trim() }))
          .filter((s) => s.platform && s.url);
        const res = await updateSiteIdentity(site.id, {
          name: siteName.trim() || undefined,
          socials: cleanSocials,
        });
        if (res.ok) {
          savedSiteRef.current = cur;
          setStatus('saved');
        } else {
          setError(res.error ?? 'Could not save your site details.');
          setStatus('error');
          toast.error(res.error ?? 'Could not save your site details.');
        }
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [siteName, socials, site.id]);

  // ── Write brand "look" edits back into the selected saved theme ─────────────
  // Separate from the tenant-brand save above: that always persists to /v1/brand
  // (so "apply to brand everywhere" works); this only fires when a saved theme is
  // selected, snapshotting the look into it so re-applying it later restores the
  // edit. On selection/apply/detach we re-baseline without writing.
  const themeBrandBaselineRef = React.useRef<string | null>(null);
  const prevActiveSavedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const sid = activeSavedThemeId;
    const cur = JSON.stringify(brandCols);
    if (sid !== prevActiveSavedRef.current) {
      prevActiveSavedRef.current = sid;
      themeBrandBaselineRef.current = sid ? cur : null;
      return;
    }
    if (!sid || cur === themeBrandBaselineRef.current) return;
    const t = setTimeout(() => {
      void (async () => {
        const res = await updateSavedTheme(sid, { brand: brandCols });
        if (res.ok && res.data) {
          const saved = res.data;
          themeBrandBaselineRef.current = cur;
          setSavedThemes((s) => s.map((x) => (x.id === sid ? saved : x)));
        } else {
          setError(res.error ?? 'Could not update this theme.');
          setStatus('error');
        }
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [brandCols, activeSavedThemeId]);

  // ── Debounced autosave: presentation + active-theme pointer ─────────────────
  // Both live in draftSettings, and updateSettings REPLACES that JSON, so they
  // must save through ONE effect — two effects would each send a partial
  // settings object and race on the full-replace, dropping a field. Fires when
  // either the presentation overlay or the active-saved-theme pointer changes.
  const draftTokens = React.useRef(config.draftSettings.tokens);
  const draftCss = React.useRef(config.draftSettings.customCss);
  const savedSettingsRef = React.useRef(JSON.stringify({ presentation, activeSavedThemeId }));
  React.useEffect(() => {
    const cur = JSON.stringify({ presentation, activeSavedThemeId });
    if (cur === savedSettingsRef.current) return;
    setStatus('saving');
    const t = setTimeout(() => {
      void (async () => {
        const res = await updateSettings({
          settings: {
            tokens: draftTokens.current,
            customCss: draftCss.current,
            presentation,
            activeSavedThemeId,
          },
        });
        if (!res.ok) {
          setError(res.error ?? 'Could not save theme settings.');
          setStatus('error');
          toast.error(res.error ?? 'Could not save theme settings.');
          return;
        }
        // If a saved theme is selected, the same presentation edit also writes
        // back into that theme so "select and tweak" actually modifies it.
        const sid = activeSavedIdRef.current;
        if (sid) {
          const upd = await updateSavedTheme(sid, { presentation });
          if (upd.ok && upd.data) {
            const saved = upd.data;
            setSavedThemes((s) => s.map((x) => (x.id === sid ? saved : x)));
          } else {
            setError(upd.error ?? 'Could not update this theme.');
            setStatus('error');
            savedSettingsRef.current = cur; // config saved — don't re-loop on it
            return;
          }
        }
        savedSettingsRef.current = cur;
        setStatus('saved');
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [presentation, activeSavedThemeId]);

  // ── Theme / saved-theme actions ────────────────────────────────────────────

  // Drop the brand's identity-colour overrides (primary/accent + their -content
  // pairs) back to "inherit". Brand colours WIN over the theme (docs/33), so a
  // stale override masks a newly-selected theme's signature colours — clearing
  // them lets the preset's palette show through ("switch to Market → Market
  // colours"). Surfaces/fonts/shape are the theme's already; the tenant
  // re-customises on top afterwards.
  const clearBrandColorOverrides = () => {
    setColorPrimary(null);
    setColorPrimaryForeground(null);
    setColorAccent(null);
    setColorAccentForeground(null);
    setColorSecondary(null);
    setColorSecondaryForeground(null);
  };

  const onSelectPreset = (key: string) => {
    setThemeKey(key);
    // Switching to a prebuilt base detaches from any saved theme being edited
    // (a saved theme's base is fixed; you're now editing the live draft)…
    setActiveSavedThemeId(null);
    // …and adopts the preset's palette: without this, brand primary/accent
    // overrides would keep the old colours and the theme would look "not applied".
    clearBrandColorOverrides();
    startTransition(async () => {
      setStatus('saving');
      const res = await selectTheme(key);
      if (res.ok) setStatus('saved');
      else {
        setError(res.error ?? 'Could not switch theme.');
        setStatus('error');
      }
    });
  };

  const onPolicyChange = (p: AppearancePolicy) => {
    setPolicy(p);
    startTransition(async () => {
      setStatus('saving');
      const res = await updateSettings({ appearancePolicy: p });
      if (res.ok) setStatus('saved');
      else {
        setError(res.error ?? 'Could not save appearance.');
        setStatus('error');
      }
    });
  };

  const onSaveCurrent = (name: string) => {
    startTransition(async () => {
      setStatus('saving');
      // Capture the full look: base preset + presentation overlay + brand
      // identity (colours/fonts/shape), so the theme is a self-contained snapshot.
      const res = await saveTheme({
        name,
        basePresetKey: themeKey,
        presentation,
        brand: brandCols,
      });
      if (res.ok && res.data) {
        const created = res.data;
        setSavedThemes((s) => [...s, created]);
        // The freshly-saved theme becomes the one you're editing, so further
        // tweaks flow back into it. The settings autosave (keyed on
        // activeSavedThemeId) then persists the pointer.
        setActiveSavedThemeId(created.id);
        setStatus('saved');
        toast.success(`Saved “${name}” to your themes.`);
      } else {
        setError(res.error ?? 'Could not save this theme yet.');
        setStatus('error');
        toast.error(res.error ?? 'Could not save this theme.');
      }
    });
  };

  const onRenameSaved = (id: string, name: string) => {
    setSavedThemes((s) => s.map((t) => (t.id === id ? { ...t, name } : t))); // optimistic
    startTransition(async () => {
      const res = await updateSavedTheme(id, { name });
      if (res.ok && res.data) {
        const renamed = res.data;
        setSavedThemes((s) => s.map((t) => (t.id === id ? renamed : t)));
      } else {
        setError(res.error ?? 'Could not rename this theme.');
        setStatus('error');
      }
    });
  };

  const onDeleteSaved = (id: string) => {
    const theme = savedThemes.find((t) => t.id === id);
    // Deleting a saved theme is destructive (the snapshot is gone) — confirm
    // before doing it. Resolve the dialog OUTSIDE the transition.
    void (async () => {
      const ok = await confirm({
        title: `Delete “${theme?.name ?? 'this theme'}”?`,
        description: 'This removes the saved theme. Your live store is not affected.',
        confirmLabel: 'Delete theme',
        tone: 'danger',
      });
      if (!ok) return;
      startTransition(async () => {
        const res = await deleteSavedTheme(id);
        if (res.ok) {
          setSavedThemes((s) => s.filter((t) => t.id !== id));
          if (activeSavedIdRef.current === id) setActiveSavedThemeId(null);
          toast.success(`Deleted “${theme?.name ?? 'theme'}”.`);
        } else {
          setError(res.error ?? 'Could not delete this theme.');
          setStatus('error');
          toast.error(res.error ?? 'Could not delete this theme.');
        }
      });
    })();
  };

  const onApplySaved = (id: string) => {
    const t = savedThemes.find((x) => x.id === id);
    if (!t) return;
    setThemeKey(t.basePresetKey);
    setPresentation(t.presentation);
    // Load the theme's captured brand "look" into state. That changes the brand
    // form, so the brand autosave persists it through saveBrand() — which routes
    // to the RIGHT place for the active site (docs/49): the tenant base brand for
    // the primary site, or THIS site's override for a non-primary one. So applying
    // a theme on a non-primary site recolours only that site, never the base. The
    // server apply endpoint writes the per-site config (preset/presentation) only,
    // never the brand. Legacy themes with no snapshot (brand === null) leave the
    // current brand untouched.
    const tb = t.brand;
    if (tb) {
      setColorPrimary(tb.colorPrimary ?? null);
      setColorPrimaryForeground(tb.colorPrimaryForeground ?? null);
      setColorAccent(tb.colorAccent ?? null);
      setColorAccentForeground(tb.colorAccentForeground ?? null);
      setColorSecondary(tb.colorSecondary ?? null);
      setColorSecondaryForeground(tb.colorSecondaryForeground ?? null);
      setFontHeading(tb.fontHeading ?? null);
      setFontBody(tb.fontBody ?? null);
      setTokens(tb.tokens ?? {});
      // The brand autosave (saveBrand) persists these to the right scope, so seed
      // the "saved" baseline now — no stale per-swatch revert affordance flashes.
      setSavedBrandColors(pickBrandColors(tb));
    }
    // This saved theme is now the one being edited — presentation AND brand edits
    // write back into it (see the autosave effects).
    setActiveSavedThemeId(id);
    // The apply endpoint persists base + presentation + the active-theme pointer
    // server-side; mark the settings snapshot as saved so the autosave effect
    // doesn't redundantly re-PATCH them.
    savedSettingsRef.current = JSON.stringify({
      presentation: t.presentation,
      activeSavedThemeId: id,
    });
    startTransition(async () => {
      setStatus('saving');
      const res = await applySavedTheme(id);
      if (res.ok) {
        setStatus('saved');
        toast.success(`Applied “${t.name}”.`);
      } else {
        setError(res.error ?? 'Could not apply this theme.');
        setStatus('error');
        toast.error(res.error ?? 'Could not apply this theme.');
      }
    });
  };

  // ── Toolbar: switcher · new/rename/delete · save · publish (docs/45 parity) ──
  // The brand editor adopts the page/site editors' toolbar so all three Builder
  // surfaces share one shape. The theme switcher (saved + prebuilt) replaces the
  // old "My themes" rail; New saves the current look as a theme; Save force-flushes
  // the debounced autosave; Publish compiles the draft into the live storefront.
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  // Switcher value: a saved theme (`saved:<id>`) when one is selected, else the
  // prebuilt base (`preset:<key>`). Selecting either applies it.
  const switcherValue = activeSavedThemeId ? `saved:${activeSavedThemeId}` : `preset:${themeKey}`;
  const onSwitcherChange = (value: string) => {
    if (value.startsWith('saved:')) onApplySaved(value.slice('saved:'.length));
    else if (value.startsWith('preset:')) onSelectPreset(value.slice('preset:'.length));
  };

  // The trigger mirrors the selected row: the active theme's name + its three
  // signature dots.
  const activeSaved = activeSavedThemeId
    ? savedThemes.find((t) => t.id === activeSavedThemeId)
    : undefined;
  const currentName = activeSaved
    ? activeSaved.name
    : (THEME_LIST.find((t) => t.key === themeKey)?.name ?? themeKey);
  const currentColors = activeSaved
    ? swatchFor(activeSaved.basePresetKey, {
        primary: activeSaved.brand?.colorPrimary,
        accent: activeSaved.brand?.colorAccent,
        base100: activeSaved.presentation.light?.base100,
      })
    : swatchFor(themeKey);

  const startRename = () => {
    if (!activeSavedThemeId) return;
    setNameDraft(savedThemes.find((t) => t.id === activeSavedThemeId)?.name ?? '');
    setRenaming(true);
  };
  const commitRename = () => {
    if (skipRenameCommit.current) {
      skipRenameCommit.current = false;
      setRenaming(false);
      return;
    }
    setRenaming(false);
    const id = activeSavedThemeId;
    if (!id) return;
    const name = nameDraft.trim();
    const current = savedThemes.find((t) => t.id === id);
    if (!name || name === current?.name) return;
    onRenameSaved(id, name);
  };

  // Force-flush the debounced autosave: persist brand + settings now (the live
  // preview already reflects the edit). Mirrors the page/site "Save".
  const onSaveNow = () => {
    startTransition(async () => {
      setStatus('saving');
      const cleanSocials = socials
        .map((s) => ({ platform: s.platform.trim(), url: s.url.trim() }))
        .filter((s) => s.platform && s.url);
      const [b, s, identity] = await Promise.all([
        saveBrand(),
        updateSettings({
          settings: {
            tokens: draftTokens.current,
            customCss: draftCss.current,
            presentation,
            activeSavedThemeId,
          },
        }),
        site.id
          ? updateSiteIdentity(site.id, {
              name: siteName.trim() || undefined,
              socials: cleanSocials,
            })
          : Promise.resolve({ ok: true } as const),
      ]);
      if (b.ok && s.ok && identity.ok) {
        savedBrandRef.current = JSON.stringify(brandPatch);
        setSavedBrandColors(pickBrandColors(brandPatch));
        savedSettingsRef.current = JSON.stringify({ presentation, activeSavedThemeId });
        savedSiteRef.current = JSON.stringify({ name: siteName, socials });
        setStatus('saved');
      } else {
        const identityErr = 'error' in identity ? identity.error : undefined;
        setError((b.ok ? (s.ok ? identityErr : s.error) : b.error) ?? 'Could not save.');
        setStatus('error');
        toast.error('Could not save your changes.');
      }
    });
  };

  // Publish compiles the draft theme's light tokens into the live storefront
  // (docs/51) — the same backend the storefront reads. Gated behind a confirm.
  const onPublish = () => {
    void (async () => {
      const ok = await confirm({
        title: 'Publish brand & theme?',
        description: 'Makes your current brand and theme live across your site.',
        confirmLabel: 'Publish',
        tone: 'module',
      });
      if (!ok) return;
      startTransition(async () => {
        setStatus('saving');
        const res = await publishNow();
        if (res.ok) {
          setStatus('saved');
          toast.success('Brand & theme published — live on your site.');
        } else {
          setError(res.error ?? 'Publish failed.');
          setStatus('error');
          toast.error(res.error ?? 'Publish failed.');
        }
      });
    })();
  };

  // Copy the mode you're editing onto the other mode, so light and dark stay in
  // sync without re-entering every surface/status colour. It snapshots the
  // RESOLVED per-mode colours (preset + your overlay) into the other mode's
  // overlay, so the other mode renders identically. Brand identity, type, and
  // shape are mode-independent and untouched. Overwrites the other mode → confirm.
  const otherMode: Mode = mode === 'light' ? 'dark' : 'light';
  const onCopyToOtherMode = () => {
    void (async () => {
      const ok = await confirm({
        title: `Copy ${mode} colours to ${otherMode}?`,
        description: `Replaces ${otherMode} mode's surface, neutral, and status colours with the ${mode} colours shown now. Brand identity colours are shared across modes and aren't affected.`,
        confirmLabel: `Copy to ${otherMode}`,
        tone: 'module',
      });
      if (!ok) return;
      const src = compiled[mode];
      const copied: PresentationColorOverlay = {};
      for (const key of COPYABLE_MODE_KEYS) copied[key] = src[key];
      setPresentation({ ...presentation, v: 2, [otherMode]: copied });
      toast.success(`Copied ${mode} colours to ${otherMode}.`);
    })();
  };

  return (
    <div className="flex flex-col">
      {/* Toolbar — the shared Builder shape (docs/45): theme switcher (saved +
          prebuilt) · new/rename/delete · Light/Dark · Save · Publish. Reuses the
          page/site `bx-toolbar` classes for true symmetry; /builder/brand loads
          builder.css so they resolve. */}
      <div className="bx-toolbar">
        <div className="bx-toolbar__templates">
          {renaming ? (
            <Input
              ref={renameInputRef}
              size="sm"
              className="bx-tplselect"
              value={nameDraft}
              aria-label="Theme name"
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  skipRenameCommit.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={commitRename}
            />
          ) : (
            // Custom dropdown (not a native <select>) so each row — and the
            // trigger — can show the theme's three signature color dots. The
            // trigger is styled to read like the page/site editors' switcher
            // field; text color inherits from the toolbar (the dots + name carry
            // the meaning), which also keeps it clear of the raw-Tailwind rule.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Theme"
                  disabled={pending}
                  className="bx-tplselect inline-flex h-8 items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] py-1.5 pr-2.5 pl-2.5 text-xs transition-colors hover:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ThemeDots colors={currentColors} />
                  <span className="min-w-0 flex-1 truncate text-left font-medium">
                    {currentName}
                  </span>
                  <ChevronDown aria-hidden className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[60vh] w-[260px] overflow-y-auto">
                <DropdownMenuRadioGroup value={switcherValue} onValueChange={onSwitcherChange}>
                  <DropdownMenuLabel>My themes</DropdownMenuLabel>
                  {savedThemes.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                      No saved themes yet
                    </p>
                  ) : (
                    savedThemes.map((t) => (
                      <DropdownMenuRadioItem key={t.id} value={`saved:${t.id}`}>
                        <ThemeDots
                          colors={swatchFor(t.basePresetKey, {
                            primary: t.brand?.colorPrimary,
                            accent: t.brand?.colorAccent,
                            base100: t.presentation.light?.base100,
                          })}
                        />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      </DropdownMenuRadioItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Prebuilt</DropdownMenuLabel>
                  {THEME_LIST.map((t) => (
                    <DropdownMenuRadioItem key={t.key} value={`preset:${t.key}`}>
                      <ThemeDots colors={swatchFor(t.key)} />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            type="button"
            className="bx-newtpl"
            aria-label="Rename this theme"
            disabled={pending || renaming || !activeSavedThemeId}
            onClick={startRename}
          >
            <Pencil aria-hidden />
          </button>
          <button
            type="button"
            className="bx-newtpl"
            aria-label="Save current look as a new theme"
            disabled={pending || renaming}
            onClick={() => onSaveCurrent('Untitled theme')}
          >
            <Plus aria-hidden />
          </button>
          <button
            type="button"
            className="bx-newtpl"
            aria-label="Delete this theme"
            disabled={pending || renaming || !activeSavedThemeId}
            onClick={() => activeSavedThemeId && onDeleteSaved(activeSavedThemeId)}
          >
            <Trash2 aria-hidden />
          </button>
        </div>

        <div className="bx-toolbar__devices">
          {(['light', 'dark'] as const).map((m) => {
            const Icon = m === 'light' ? Sun : Moon;
            return (
              <button
                key={m}
                type="button"
                className="bx-device"
                data-on={mode === m}
                aria-label={m === 'light' ? 'Light' : 'Dark'}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
              >
                <Icon aria-hidden />
              </button>
            );
          })}
        </div>

        {/* Mirror the mode you're editing onto the other one — so light and dark
            stay aligned without re-entering every surface/status colour. */}
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Copy className="h-3.5 w-3.5" />}
          onClick={onCopyToOtherMode}
          disabled={pending}
          title={`Copy the ${mode} palette onto ${otherMode} mode`}
        >
          Copy to {otherMode}
        </Button>

        <div className="bx-toolbar__actions">
          {status !== 'idle' ? (
            <span
              className="bx-savestate"
              data-state={status}
              title={status === 'error' ? (error ?? undefined) : undefined}
            >
              {SAVE_LABEL[status]}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="soft"
            leftIcon={<Save className="h-3.5 w-3.5" />}
            disabled={pending}
            onClick={onSaveNow}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="solid"
            leftIcon={<Upload className="h-3.5 w-3.5" />}
            disabled={pending}
            onClick={onPublish}
          >
            Publish
          </Button>
        </div>
      </div>

      {/* Context bar — mirrors the page/site editors. */}
      <div className="bx-ctx">
        <span className="bx-ctx__lead">Your brand identity &amp; theme</span>
        <span className="bx-ctx__note">
          Pick a theme, tune identity and surfaces, and preview live below. Edits save to your
          draft; <strong>Publish</strong> pushes the theme across your site.
        </span>
      </div>

      <div className="px-6 py-6 lg:px-8">
        {/* Controls take a fixed inspector width; the live preview fills the
            rest (and grows on wider screens). Stacks to one column below lg.
            Like the page/site editors: the controls are a light surface panel and
            the preview sits on the darker "stage" (base-200). */}
        <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
          <div className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <BrandThemeControls
              siteName={siteName}
              setSiteName={setSiteName}
              isPrimarySite={site.isPrimary}
              socials={socials}
              setSocials={setSocials}
              tagline={tagline}
              setTagline={setTagline}
              logoLight={logoLight}
              setLogoLight={setLogoLight}
              logoDark={logoDark}
              setLogoDark={setLogoDark}
              favicon={favicon}
              setFavicon={setFavicon}
              colorPrimary={colorPrimary}
              setColorPrimary={setColorPrimary}
              colorPrimaryForeground={colorPrimaryForeground}
              setColorPrimaryForeground={setColorPrimaryForeground}
              colorAccent={colorAccent}
              setColorAccent={setColorAccent}
              colorAccentForeground={colorAccentForeground}
              setColorAccentForeground={setColorAccentForeground}
              colorSecondary={colorSecondary}
              setColorSecondary={setColorSecondary}
              colorSecondaryForeground={colorSecondaryForeground}
              setColorSecondaryForeground={setColorSecondaryForeground}
              savedBrandColors={savedBrandColors}
              fontHeading={fontHeading}
              setFontHeading={setFontHeading}
              fontBody={fontBody}
              setFontBody={setFontBody}
              tokens={tokens}
              setTokens={setTokens}
              themeKey={themeKey}
              mode={mode}
              compiledColors={compiled[mode]}
              presentation={presentation}
              onPresentationChange={setPresentation}
              policy={policy}
              onPolicyChange={onPolicyChange}
            />
          </div>

          <div className="min-w-0 rounded-[var(--radius-lg)] bg-[var(--color-bg-subtle)] p-4 lg:sticky lg:top-4 lg:self-start">
            {previewSurface === 'site' && canPreviewSite && sitePreview.origin ? (
              <SitePreviewFrame
                origin={sitePreview.origin}
                tenantSlug={sitePreview.tenantSlug}
                propertySlug={sitePreview.propertySlug}
                css={rootCss}
                mode={mode}
                headerExtra={
                  canPreviewSite ? (
                    <PreviewSurfaceToggle value={previewSurface} onChange={setPreviewSurface} />
                  ) : null
                }
              />
            ) : (
              <ThemeShowcase
                css={css}
                mode={mode}
                brandName={siteName.trim() || site.name}
                logoLightUrl={logoLight.url}
                logoDarkUrl={logoDark.url}
                headingFont={fontHeading}
                bodyFont={fontBody}
                headerExtra={
                  canPreviewSite ? (
                    <PreviewSurfaceToggle value={previewSurface} onChange={setPreviewSurface} />
                  ) : null
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
