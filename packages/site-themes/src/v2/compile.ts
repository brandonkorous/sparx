// Token Model v2 compiler (docs/33-token-model-v2.md §5.3).
//
// compileTokensV2 layers a brand doc + presentation overlay over a preset's
// defaults to produce a complete { shared, light, dark } token set. Resolution:
//   • shared   : preset ← brand (brand owns type/shape/rhythm/effect);
//                containerWidth is presentation-owned, so preset ← presentation.
//   • per-mode : a per-mode presentation identity override (primary/secondary/
//                accent) wins → else brand identity → else preset; presentation
//                (surfaces/neutral/status/border) wins for its slots. The
//                per-mode identity slots are what let dark carry a different
//                brand color than light (the single tenant brand can't).
//   • `-content`: explicit (overlay/brand/preset) wins, else auto-derived.
//
// The SAME function feeds both the storefront chrome read path and the Site
// Builder published snapshot, so the two can never drift. Because a preset
// always supplies every slot, the output is complete even for a tenant with no
// brand doc and no overlay — which is what makes dropping the legacy
// CommerceSiteTheme columns safe (decision #3's dependency).

import { deriveContent, normalizeHex } from './color';
import type {
    BrandTokenDoc,
    ColorTokensV2,
    CompiledColorTokensV2,
    CompiledThemeV2,
    PresentationColorOverlay,
    PresentationOverlayV2,
    SharedTokensV2,
    ThemePresetV2,
} from './types';

export interface CompileV2Options {
    brand?: BrandTokenDoc | null;
    presentation?: PresentationOverlayV2 | null;
}

// First value that is neither null/undefined nor an empty string. Written
// explicitly (not `??`) so an empty-string override counts as "absent" and
// falls through to the next source.
function pick(...vals: (string | null | undefined)[]): string | undefined {
    for (const v of vals) {
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return undefined;
}

// An explicit color slot, normalized to hex (or the raw string if it isn't hex,
// e.g. a CSS keyword), or undefined when no source supplied one.
function optColor(...vals: (string | null | undefined)[]): string | undefined {
    const v = pick(...vals);
    if (v == null) return undefined;
    return normalizeHex(v) ?? v;
}

// A required color slot — never empty (degrades to black on bad data so
// derivation never throws).
function color(...vals: (string | null | undefined)[]): string {
    return optColor(...vals) ?? '#000000';
}

function resolveShared(
    preset: SharedTokensV2,
    brand: BrandTokenDoc | null | undefined,
    presentation: PresentationOverlayV2 | null | undefined
): SharedTokensV2 {
    const depth = brand?.effect?.depth;
    return {
        fontHeading: pick(brand?.type?.heading, preset.fontHeading) ?? preset.fontHeading,
        fontBody: pick(brand?.type?.body, preset.fontBody) ?? preset.fontBody,
        radiusSelector:
            pick(brand?.shape?.radiusSelector, preset.radiusSelector) ?? preset.radiusSelector,
        radiusField: pick(brand?.shape?.radiusField, preset.radiusField) ?? preset.radiusField,
        radiusBox: pick(brand?.shape?.radiusBox, preset.radiusBox) ?? preset.radiusBox,
        borderWidth: pick(brand?.shape?.borderWidth, preset.borderWidth) ?? preset.borderWidth,
        spaceBase: pick(brand?.rhythm?.spaceBase, preset.spaceBase) ?? preset.spaceBase,
        sizeField: pick(brand?.rhythm?.sizeField, preset.sizeField) ?? preset.sizeField,
        sizeSelector: pick(brand?.rhythm?.sizeSelector, preset.sizeSelector) ?? preset.sizeSelector,
        depth: typeof depth === 'number' ? depth : preset.depth,
        containerWidth:
            pick(presentation?.containerWidth, preset.containerWidth) ?? preset.containerWidth,
    };
}

// Default for the semantic highlight (promo/attention) slot when a preset omits
// it — a distinct hue, NOT a brand alias. Tenants override via the presentation
// overlay (docs/47).
const DEFAULT_HIGHLIGHT = '#ec4899';

function resolveColors(
    base: ColorTokensV2,
    brand: BrandTokenDoc | null | undefined,
    overlay: PresentationColorOverlay | null | undefined
): CompiledColorTokensV2 {
    const bc = brand?.color;

    // Surfaces + line (presentation-owned).
    const base100 = color(overlay?.base100, base.base100);
    const base200 = color(overlay?.base200, base.base200);
    const base300 = color(overlay?.base300, base.base300);
    const baseContent = color(overlay?.baseContent, base.baseContent);
    const border = color(overlay?.border, base.border);

    // Brand identity. A per-mode presentation override wins (so dark can carry a
    // lighter primary than light), else the mode-invariant tenant brand, else the
    // preset. Secondary falls back to primary if neither preset nor brand defines
    // it (docs/33 §3.1).
    const primary = color(overlay?.primary, bc?.primary, base.primary);
    const secondary = color(overlay?.secondary, bc?.secondary, base.secondary, primary);
    const accent = color(overlay?.accent, bc?.accent, base.accent);

    // UI + status (presentation-owned).
    const neutral = color(overlay?.neutral, base.neutral);
    const info = color(overlay?.info, base.info);
    const success = color(overlay?.success, base.success);
    const warning = color(overlay?.warning, base.warning);
    const danger = color(overlay?.danger, base.danger);
    const highlight = color(overlay?.highlight, base.highlight ?? DEFAULT_HIGHLIGHT);

    // `-content` for the IDENTITY slots. Explicit still wins (overlay, then brand),
    // but the PRESET's pair only applies while the preset's own color is the one on
    // screen — see identityContent. Everything else: explicit wins, else auto-derive.
    const identityContent = (
        stated: string | undefined,
        presetColor: string,
        presetContent: string | undefined,
        resolved: string
    ): string => {
        if (stated) return stated;
        // The preset paired this foreground with ITS color. If a brand or overlay has
        // replaced that color and named no foreground of its own, the pair no longer
        // describes anything on screen — derive against what is actually rendered.
        //
        // Without this, a preset that states `accentContent: '#fff7ef'` hands near-white
        // to whatever accent a tenant sets, including a pale one. It only surfaced when
        // the platform base started stating its `-content` pairs (it mirrors the shipped
        // Ember theme, which states them); the six legacy presets left most of them
        // unstated, so derivation happened to run every time and hid the rule.
        if (presetContent && resolved === color(presetColor)) return presetContent;
        return deriveContent(resolved);
    };

    return {
        base100,
        base200,
        base300,
        baseContent,
        primary,
        primaryContent: identityContent(
            optColor(overlay?.primaryContent, bc?.primaryContent),
            base.primary,
            base.primaryContent,
            primary
        ),
        secondary,
        secondaryContent: identityContent(
            optColor(overlay?.secondaryContent, bc?.secondaryContent),
            base.secondary,
            base.secondaryContent,
            secondary
        ),
        accent,
        accentContent: identityContent(
            optColor(overlay?.accentContent, bc?.accentContent),
            base.accent,
            base.accentContent,
            accent
        ),
        neutral,
        neutralContent:
            optColor(overlay?.neutralContent, base.neutralContent) ?? deriveContent(neutral),
        info,
        infoContent: optColor(overlay?.infoContent, base.infoContent) ?? deriveContent(info),
        success,
        successContent:
            optColor(overlay?.successContent, base.successContent) ?? deriveContent(success),
        warning,
        warningContent:
            optColor(overlay?.warningContent, base.warningContent) ?? deriveContent(warning),
        danger,
        dangerContent: optColor(overlay?.dangerContent, base.dangerContent) ?? deriveContent(danger),
        highlight,
        highlightContent:
            optColor(overlay?.highlightContent, base.highlightContent) ?? deriveContent(highlight),
        border,
    };
}

/**
 * Compile a preset + optional brand doc + optional presentation overlay into a
 * complete { shared, light, dark } token set with all `-content` pairs resolved.
 */
export function compileTokensV2(
    preset: ThemePresetV2,
    opts: CompileV2Options = {}
): CompiledThemeV2 {
    const { brand, presentation } = opts;
    return {
        shared: resolveShared(preset.shared, brand, presentation),
        light: resolveColors(preset.light, brand, presentation?.light),
        dark: resolveColors(preset.dark, brand, presentation?.dark),
    };
}
