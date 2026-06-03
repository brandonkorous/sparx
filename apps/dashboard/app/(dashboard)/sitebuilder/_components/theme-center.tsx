'use client';

// The Brand & Theme center — the merged "Look" surface (docs/30 Brand+Theme,
// docs/33 token model v2). One screen, three columns: theme picker (rail) ·
// grouped controls · live component showcase. It replaces the separate Brand
// board and Theme inspector: a single source for the tenant's identity AND its
// presentation overlay, with the showcase recompiling on every keystroke so the
// tenant sees the brand applied across the whole platform without an iframe.
//
//   edit → compileThemeForTenant(themeKey, brand, presentation)
//        → buildThemeCssV2(..., { rootSelector:'#sf-theme-preview' })   ← scoped, instant
//        → debounced updateBrand / updateSettings                       ← persists
//
// The same compile runs server-side on publish, so the showcase tells the truth.
// Brand-owned slots persist via /v1/brand; presentation via the site config —
// the two owners stay clean even though they share one form (docs/33 §3.6).

import * as React from 'react';
import { toast, useConfirm } from '@sparx/ui';
import {
  buildThemeCssV2,
  compileThemeForTenant,
  type PresentationOverlayV2,
} from '@sparx/site-themes';
import {
  applySavedTheme,
  deleteSavedTheme,
  saveTheme,
  selectTheme,
  updateBrand,
  updateSavedTheme,
  updateSettings,
  type BrandPatch,
} from '../_lib/actions';
import type {
  AppearancePolicy,
  BrandDto,
  BrandMediaUrls,
  SiteConfigDto,
  SiteThemeDto,
} from '../_lib/types';
import { cleanTokens, type BrandTokens } from '../_lib/brand-feel';
import { BrandThemeControls, type MediaState } from './brand-theme-controls';
import { ThemeRail } from './theme-rail';
import { ThemeShowcase } from './theme-showcase';

type Mode = 'light' | 'dark';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ThemeCenterProps {
  brand: BrandDto;
  config: SiteConfigDto;
  savedThemes: SiteThemeDto[];
  media: BrandMediaUrls;
}

export function ThemeCenter({ brand, config, savedThemes: initialSaved, media }: ThemeCenterProps) {
  // ── Brand state (persists via /v1/brand) ──────────────────────────────────
  const [businessName, setBusinessName] = React.useState(brand.businessName ?? '');
  const [tagline, setTagline] = React.useState(brand.tagline ?? '');
  const [colorPrimary, setColorPrimary] = React.useState<string | null>(brand.colorPrimary);
  const [colorPrimaryForeground, setColorPrimaryForeground] = React.useState<string | null>(
    brand.colorPrimaryForeground
  );
  const [colorAccent, setColorAccent] = React.useState<string | null>(brand.colorAccent);
  const [colorAccentForeground, setColorAccentForeground] = React.useState<string | null>(
    brand.colorAccentForeground
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
      fontHeading,
      fontBody,
      tokens: cleanedTokens,
    }),
    [
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
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
    () => buildThemeCssV2(compiled, { rootSelector: '#sf-theme-preview' }),
    [compiled]
  );

  // ── Debounced autosave: brand ──────────────────────────────────────────────
  const brandPatch = React.useMemo<BrandPatch>(
    () => ({
      businessName: businessName.trim() || null,
      tagline: tagline.trim() || null,
      logoLightMediaId: logoLight.id,
      logoDarkMediaId: logoDark.id,
      faviconMediaId: favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      fontHeading,
      fontBody,
      tokens: cleanedTokens,
    }),
    [
      businessName,
      tagline,
      logoLight.id,
      logoDark.id,
      favicon.id,
      colorPrimary,
      colorPrimaryForeground,
      colorAccent,
      colorAccentForeground,
      fontHeading,
      fontBody,
      cleanedTokens,
    ]
  );
  const savedBrandRef = React.useRef(JSON.stringify(brandPatch));
  React.useEffect(() => {
    const cur = JSON.stringify(brandPatch);
    if (cur === savedBrandRef.current) return;
    setStatus('saving');
    const t = setTimeout(() => {
      void (async () => {
        const res = await updateBrand(brandPatch);
        if (res.ok) {
          savedBrandRef.current = cur;
          setStatus('saved');
        } else {
          setError(res.error ?? 'Could not save your brand.');
          setStatus('error');
          toast.error(res.error ?? 'Could not save your brand changes.');
        }
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [brandPatch]);

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

  // The active preset row's reset affordance ("Reset color overrides to this
  // preset"): clear BOTH the presentation overlay and the brand colour overrides
  // so the preset renders exactly as shipped — matching the control's label.
  const onResetOverrides = () => {
    setPresentation({ v: 2 });
    clearBrandColorOverrides();
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
    // Load the theme's captured brand "look" into state. That changes brandPatch,
    // so the brand autosave writes it to /v1/brand — i.e. applying a theme updates
    // the tenant brand everywhere (the chosen "apply to brand" model). Legacy
    // themes with no snapshot (brand === null) leave the current brand untouched.
    const tb = t.brand;
    if (tb) {
      setColorPrimary(tb.colorPrimary ?? null);
      setColorPrimaryForeground(tb.colorPrimaryForeground ?? null);
      setColorAccent(tb.colorAccent ?? null);
      setColorAccentForeground(tb.colorAccentForeground ?? null);
      setFontHeading(tb.fontHeading ?? null);
      setFontBody(tb.fontBody ?? null);
      setTokens(tb.tokens ?? {});
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Brand &amp; Theme
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your identity and theme in one place — every change previews live across the platform.
          </p>
        </div>
        <SaveStatus status={status} error={error} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[15rem_22rem_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <ThemeRail
            savedThemes={savedThemes}
            activeThemeKey={themeKey}
            activeSavedThemeId={activeSavedThemeId}
            onSelectPreset={onSelectPreset}
            onResetOverrides={onResetOverrides}
            onApplySaved={onApplySaved}
            onSaveCurrent={onSaveCurrent}
            onRenameSaved={onRenameSaved}
            onDeleteSaved={onDeleteSaved}
            busy={pending}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:contents">
          <div className="min-w-0 xl:col-start-2">
            <BrandThemeControls
              businessName={businessName}
              setBusinessName={setBusinessName}
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

          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start xl:col-start-3">
            <ThemeShowcase
              css={css}
              mode={mode}
              onModeChange={setMode}
              brandName={businessName.trim() || brand.businessName}
              logoLightUrl={logoLight.url}
              logoDarkUrl={logoDark.url}
              headingFont={fontHeading}
              bodyFont={fontBody}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ status, error }: { status: SaveState; error: string | null }) {
  if (status === 'error') {
    return (
      <span role="alert" className="text-xs text-[var(--color-danger-text)]">
        {error ?? 'Could not save.'}
      </span>
    );
  }
  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes saved' : '';
  return (
    <span role="status" aria-live="polite" className="text-xs text-[var(--color-text-muted)]">
      {label}
    </span>
  );
}
