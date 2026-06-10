/**
 * The validating campaign-link builder (docs/80 §4.4). Encodes a {@link LinkDef}
 * into a UTM-tagged URL, classifies its channel, and surfaces taxonomy warnings
 * so a typo'd source/medium/campaign is caught at build time rather than
 * fragmenting reports later.
 */
import type { Channel } from './types';
import { classify } from './classify';
import { isValidCampaign, isValidMedium, isValidSource, normalizeToken } from './taxonomy';

export interface LinkDef {
  /** Human label for the row (e.g. "Product Hunt — first comment"). */
  label: string;
  /** Absolute destination URL. */
  destination: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
  id?: string;
}

export interface BuiltLink {
  label: string;
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  destination: string;
  url: string;
}

export interface BuildLinksResult {
  rows: BuiltLink[];
  warnings: string[];
}

/** Append normalized utm_* params to a destination URL, preserving any existing query. */
export function buildUtmUrl(
  destination: string,
  utm: {
    source: string;
    medium: string;
    campaign: string;
    term?: string;
    content?: string;
    id?: string;
  }
): string {
  const url = new URL(destination);
  url.searchParams.set('utm_source', normalizeToken(utm.source));
  url.searchParams.set('utm_medium', normalizeToken(utm.medium));
  url.searchParams.set('utm_campaign', normalizeToken(utm.campaign));
  if (utm.term) url.searchParams.set('utm_term', normalizeToken(utm.term));
  if (utm.content) url.searchParams.set('utm_content', normalizeToken(utm.content));
  if (utm.id) url.searchParams.set('utm_id', normalizeToken(utm.id));
  return url.toString();
}

export function buildLink(def: LinkDef): { link: BuiltLink; warnings: string[] } {
  const warnings: string[] = [];
  const source = normalizeToken(def.source);
  const medium = normalizeToken(def.medium);
  const campaign = normalizeToken(def.campaign);

  if (!isValidSource(source)) {
    warnings.push(
      `${def.label}: unknown utm_source "${source}" — register it in taxonomy.ts or use partner-{name}.`
    );
  }
  if (!isValidMedium(medium)) {
    warnings.push(`${def.label}: invalid utm_medium "${medium}" — not in the fixed enum.`);
  }
  if (!isValidCampaign(campaign)) {
    warnings.push(`${def.label}: campaign "${campaign}" doesn't match {initiative}-{yyyy-mm}.`);
  }

  const link: BuiltLink = {
    label: def.label,
    channel: classify({ source, medium }),
    source,
    medium,
    campaign,
    content: def.content ? normalizeToken(def.content) : '',
    term: def.term ? normalizeToken(def.term) : '',
    destination: def.destination,
    url: buildUtmUrl(def.destination, {
      source,
      medium,
      campaign,
      term: def.term,
      content: def.content,
      id: def.id,
    }),
  };
  return { link, warnings };
}

export function buildLinks(defs: readonly LinkDef[]): BuildLinksResult {
  const rows: BuiltLink[] = [];
  const warnings: string[] = [];
  for (const def of defs) {
    const result = buildLink(def);
    rows.push(result.link);
    warnings.push(...result.warnings);
  }
  return { rows, warnings };
}

export const CSV_COLUMNS = [
  'label',
  'channel',
  'source',
  'medium',
  'campaign',
  'content',
  'term',
  'destination',
  'url',
] as const;

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: readonly BuiltLink[]): string {
  const header = CSV_COLUMNS.join(',');
  const lines = rows.map((r) =>
    [r.label, r.channel, r.source, r.medium, r.campaign, r.content, r.term, r.destination, r.url]
      .map(csvCell)
      .join(',')
  );
  return `${[header, ...lines].join('\n')}\n`;
}
