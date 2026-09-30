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

/** How many steps a shopper walks down, for scanning a shelf of fourteen lists.
 *
 *  The level NAMES are deliberately not here. Every description already says
 *  them, in the owner's own words: "A shopper picks their make, model and
 *  engine, and you can narrow it further by year." Repeating that as
 *  "Make, then Model, then Engine, plus Year" said nothing new, and in five of
 *  the fourteen it said it in a DIFFERENT word than the sentence above it
 *  (`Brand` against "the make of their phone", `Species` against "the animal",
 *  `Class` against "the kind of machine", `Department` against "who they are
 *  buying for", `Discipline` against "the kind of riding they do").
 *
 *  It also did not fit. silicaui calls a badge "a small pill for labels, counts
 *  and statuses": fixed height, no vertical padding, `white-space: nowrap`.
 *  A sentence fragment in one is clipped, not wrapped — docked at 360px the old
 *  string was cut to "Make, then Model, then Engine, plu" and ran 53px past the
 *  card. The count of steps is a token, which is what a pill is for, and it is
 *  the one thing about the shape the sentence makes you work out for yourself
 *  (issue 806). */
export function stepWords(levelCount: number): string {
  return levelCount === 1 ? '1 step' : `${String(levelCount)} steps`;
}

// "3 steps" + "4 makes": how deep it goes, and how much is already filled in.
function fitmentChips(dict: FitmentDictionarySummary): ModulePresetSummaryChip[] {
  const levels = dict.dimensions.filter((d) => d.kind === 'level').map((d) => d.label);
  const firstLevel = (levels[0] ?? 'item').toLowerCase();
  return [
    { label: stepWords(levels.length), tone: 'neutral' },
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
