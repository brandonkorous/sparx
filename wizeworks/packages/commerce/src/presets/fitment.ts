// Fitment dictionary presets — the commerce entries of kind 'fitment' in the
// platform module-preset registry. The 14 platform fitment dictionaries
// (Vehicle, Apparel, Device, Pet, …) surfaced as installable presets, each
// delegating to the REAL fitment service (installFitmentDictionary /
// isFitmentDictionaryInstalled) so a tree installed via the à-la-carte picker,
// via an industry starter, or via the demo seed are byte-identical (all funnel
// through planFitmentDictionaryRows).
//
// Data-as-code (line-limit exempt), mirroring the builder catalog authoring shape.

import {
  listFitmentDictionarySummaries,
  type FitmentDictionarySummary,
} from '@wizeworks/commerce-schemas';
import type { ModulePreset, ModulePresetSummaryChip } from '@wizeworks/auth';

import {
  installFitmentDictionary,
  isFitmentDictionaryInstalled,
} from '../services/fitment-service';

// English pluralization for the count chip — mirrors the fitment dashboard helper
// (Make → makes, Species → species, Category → categories). Declared before the
// `fitmentPresets` map below (which evaluates at module load and transitively
// reads this via pluralizeLabel) — a `const` stays in its temporal dead zone
// until its own line runs, so it must precede that use.
const IRREGULAR: Record<string, string> = { species: 'species' };

/** All commerce fitment-dictionary presets, in picker order. */
export const fitmentPresets: ModulePreset[] = listFitmentDictionarySummaries().map(fitmentPreset);

function fitmentPreset(dict: FitmentDictionarySummary): ModulePreset {
  return {
    module: 'commerce',
    // Namespaced within the module so other commerce preset kinds (tax,
    // categories, markup, …) can never collide with a fitment dictionary slug.
    slug: `fitment-${dict.slug}`,
    kind: 'fitment',
    name: dict.name,
    description: dict.description,
    iconKey: dict.iconKey,
    tags: ['fitment', ...dict.tags],
    summary: fitmentChips(dict),
    // The dictionary's domain slug (the bare `dict.slug`) keys the tenant's
    // domain — install + installed-check both speak that slug.
    isInstalled: (ctx) => isFitmentDictionaryInstalled(ctx, dict.slug),
    install: (ctx) => installFitmentDictionary(ctx, dict.slug),
  };
}

// "Make → Model → Engine · Year" + "4 makes" — the at-a-glance shape + scale.
function fitmentChips(dict: FitmentDictionarySummary): ModulePresetSummaryChip[] {
  const levels = dict.dimensions.filter((d) => d.kind === 'level').map((d) => d.label);
  const ranges = dict.dimensions.filter((d) => d.kind === 'range').map((d) => d.label);
  const chain = levels.join(' → ');
  const shape = ranges.length ? `${chain} · ${ranges.join(', ')}` : chain;
  const firstLevel = (levels[0] ?? 'item').toLowerCase();
  return [
    { label: shape, tone: 'neutral' },
    { label: `${dict.rootCount} ${pluralizeLabel(firstLevel, dict.rootCount)}`, tone: 'module' },
  ];
}

function pluralizeLabel(word: string, count: number): string {
  if (count === 1) return word;
  const lower = word.toLowerCase();
  if (IRREGULAR[lower]) return IRREGULAR[lower];
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}
