// The silica-native marketplace theme payload (docs/60 §6, docs/118). A marketplace
// theme is now ONE of the platform's silica presets surfaced publicly — the same
// `Theme` token bag the Site Builder applies as `site.theme` (`--color-*`), NOT the
// retired v1/v2 `DataThemePreset`. The marketplace is a DISCOVERY surface: each row
// points at a silica theme (by `name`) that already lives in the Builder, so "Use
// this theme" hands the slug to onboarding and the Builder applies it via the
// existing silica path — the catalog never runs a second theming engine.
//
// This mirrors `@wizeworks/silicaui-html`'s `Theme` interface as a Zod schema so
// api-rest + the seed can validate an ingested payload without taking a silicaui
// dependency here (this package stays Zod-only). Keep the shapes in lockstep.

import { z } from 'zod';

const TokenBag = z.record(z.string(), z.string());

/** Which webfont a `--font-*` token was built from — provenance for the publish-time
 *  self-hosting step (mirrors silicaui-html `ThemeFontSelection`). */
const ThemeFontSelection = z
  .object({
    family: z.string().min(1).max(120),
    source: z.enum(['system', 'google']),
    weights: z.array(z.number().int().min(1).max(1000)).optional(),
  })
  .strict();

/** A complete silica `Theme` — the token set applied via `[data-theme]`. Base
 *  (light) tokens in `tokens`, dark deltas in `dark`; shape/type live in `tokens`. */
export const SilicaThemePayload = z
  .object({
    name: z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'name must be the kebab-case silica theme key'),
    tokens: TokenBag,
    dark: TokenBag.optional(),
    mode: z.enum(['light', 'dark']).optional(),
    fonts: z
      .object({ sans: ThemeFontSelection.optional(), head: ThemeFontSelection.optional() })
      .optional(),
  })
  .strict();
export type SilicaThemePayload = z.infer<typeof SilicaThemePayload>;

/** Tolerant read: parse an untrusted `tokens` JSON into a SilicaThemePayload, or
 *  null if it isn't one. Mirrors readDataThemePreset for the silica-native row. */
export function readSilicaThemePayload(input: unknown): SilicaThemePayload | null {
  const parsed = SilicaThemePayload.safeParse(input);
  return parsed.success ? parsed.data : null;
}
