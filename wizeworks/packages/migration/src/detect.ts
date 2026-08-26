// Detection — "what is this file?"
//
// The tenant should never be asked to answer that. They export from the platform they
// are leaving, drop the file here, and the file identifies itself. Every minute spent
// on a column-mapping screen is a minute spent doing our job for us, and it is the
// exact point at which most people give up on a migration.
//
// Identification is by fingerprint, in three signals of decreasing trust:
//
//   1. Required headers. Every one must be present, and they are chosen to be columns
//      that vendor emits and nobody else does. This is a gate, not a score — a file
//      missing one is not a weak match, it is not that file.
//   2. Hint headers. Raise confidence within the vendors that already passed the gate.
//   3. Filename. Weakest, because it is the one thing the tenant can rename, and
//      several of them do before uploading.
//
// The result is a ranked list rather than a single answer, so an ambiguous file gets a
// "we think this is X — or is it Y?" instead of a wrong guess presented as certainty.

import type { CanonicalEntity, CanonicalRow } from './canonical';
import { parseDelimited, type SourceRow } from './parse/csv';
import {
  isMultiEntity,
  isTextual,
  type SourceFormat,
  type VendorAdapter,
  type VendorSource,
} from './types';
import { validateRows, type ValidationReport } from './validate';
import { allSources } from './vendors';
import { normalizeHeader } from './vendors/_helpers';

/**
 * The line between an answer and a question.
 *
 * It was written down at the top of this file from the beginning and then computed
 * and thrown away: `confidence` reached no caller, and the migration surface put
 * EVERY non-null detection in a green tick that reads "This is a Squarespace
 * contacts export". `sure` on the read result is that line made reachable.
 */
export const CERTAIN = 0.5;

export interface DetectionCandidate {
  vendorSlug: string;
  vendorName: string;
  sourceId: string;
  /** What this file is, in the tenant's words. */
  label: string;
  /** The entity a single-entity source produces. */
  entity: CanonicalEntity;
  /** Everything a multi-entity source produces. */
  yields: readonly CanonicalEntity[];
  format: SourceFormat;
  /** 0–1. Anything below 0.5 is offered as a question, never as an answer. */
  confidence: number;
  /** Plain-language reasons, shown when the tenant asks "how do you know?" */
  reasons: string[];
}

export interface DetectInput {
  fileName?: string;
  text: string;
}

/** Sniff the format from the first non-whitespace character, before any parsing. */
export function sniffFormat(text: string): SourceFormat {
  const head = text
    .slice(0, 4096)
    .replace(/^\ufeff/, '')
    .trimStart();
  if (head.startsWith('<')) return 'xml';
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  return 'csv';
}

function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map(normalizeHeader));
}

function scoreDelimited(
  source: VendorSource,
  headers: Set<string>,
  fileName: string,
  /** The vendor's own spelling of its name. Read from the adapter rather than
   *  derived from the source id, which is a lowercase slug — telling somebody
   *  their file has "columns only shopify writes" reads like a typo of the name
   *  of the platform they use every day. */
  vendorName: string
): { confidence: number; reasons: string[] } | null {
  const missing = source.required.filter((header) => !headers.has(normalizeHeader(header)));
  if (missing.length > 0) return null;

  const reasons: string[] = [];
  if (source.required.length > 0) {
    reasons.push(
      `has the ${source.required.map((header) => `“${header}”`).join(' and ')} column${source.required.length === 1 ? '' : 's'}`
    );
  }

  let confidence = source.required.length === 0 ? 0.3 : 0.6;

  const hints = source.hints ?? [];
  let corroborated = false;
  if (hints.length > 0) {
    const hit = hints.filter((header) => headers.has(normalizeHeader(header)));
    confidence += 0.3 * (hit.length / hints.length);
    if (hit.length > 0) {
      corroborated = true;
      // No leading conjunction: the surface joins these into one sentence and
      // supplies its own. "…, and plus 4 of 4 columns only shopify writes" is
      // what came out when both ends tried.
      reasons.push(`${hit.length} of ${hints.length} columns only ${vendorName} writes`);
    }
  }

  if (source.filePattern !== undefined && fileName !== '' && source.filePattern.test(fileName)) {
    confidence += 0.1;
    reasons.push('the file name matches too');
  }

  // A one-column gate is not a fingerprint, whatever this file's header says.
  //
  // Four contact exports require `Email` (or `Email Address`) and nothing else, so
  // a shop's own mailing-list spreadsheet cleared all four gates at exactly 0.6 and
  // the tie went to whichever adapter the registry happened to list first. It was
  // then announced as fact — and that vendor's column map reads four fields, so the
  // phone numbers, addresses and tags in the same file were dropped without a word
  // (persona issue 228).
  //
  // Not a hard rejection: the file really might be that export. It is demoted to a
  // question, and a genuine export is unaffected because it carries the hint columns
  // that corroborate it.
  if (source.required.length <= 1 && !corroborated) {
    confidence = Math.min(confidence, CERTAIN - 0.05);
  }

  return { confidence: Math.min(confidence, 1), reasons };
}

function scoreTextual(
  source: VendorSource,
  text: string,
  fileName: string
): { confidence: number; reasons: string[] } | null {
  const head = text.slice(0, 8192);
  const reasons: string[] = [];
  let confidence = 0;

  // Content markers beat filenames for XML and JSON, because these formats announce
  // themselves in their first few hundred bytes and the filename is a suggestion.
  if (source.format === 'xml') {
    if (!/<rss|<channel/i.test(head)) return null;
    if (/xmlns:wp=/i.test(head)) {
      confidence = 0.8;
      reasons.push('it is a WordPress-format export');
    } else {
      confidence = 0.4;
      reasons.push('it is an RSS-shaped XML export');
    }
    if (source.vendorMarker?.test(head) === true) {
      confidence = Math.min(confidence + 0.15, 1);
      reasons.push('and it names the platform it came from');
    }
  } else if (source.format === 'json') {
    if (!/"(db|posts|meta)"\s*:/.test(head)) return null;
    confidence = /"db"\s*:/.test(head) ? 0.8 : 0.5;
    reasons.push('it is a JSON content backup');
  } else {
    return null;
  }

  if (source.filePattern !== undefined && fileName !== '' && source.filePattern.test(fileName)) {
    confidence = Math.min(confidence + 0.15, 1);
    reasons.push('the file name matches too');
  }

  return { confidence, reasons };
}

function candidateFor(
  vendor: VendorAdapter,
  source: VendorSource,
  score: { confidence: number; reasons: string[] }
): DetectionCandidate {
  return {
    vendorSlug: vendor.slug,
    vendorName: vendor.name,
    sourceId: source.id,
    label: source.label,
    entity: source.entity,
    yields: source.yields ?? [source.entity],
    format: source.format,
    confidence: score.confidence,
    reasons: score.reasons,
  };
}

/** Rank every source that could explain this file. Best first. */
export function detect(input: DetectInput): DetectionCandidate[] {
  const fileName = (input.fileName ?? '').trim();
  const format = sniffFormat(input.text);
  const candidates: DetectionCandidate[] = [];

  if (format === 'csv') {
    const { headers } = parseDelimited(input.text, { limit: 1 });
    const present = headerSet(headers);
    for (const { vendor, source } of allSources()) {
      if (source.format !== 'csv') continue;
      const score = scoreDelimited(source, present, fileName, vendor.name);
      if (score === null) continue;
      candidates.push(candidateFor(vendor, source, score));
    }
  } else {
    for (const { vendor, source } of allSources()) {
      if (source.format !== format) continue;
      const score = scoreTextual(source, input.text, fileName);
      if (score === null) continue;
      candidates.push(candidateFor(vendor, source, score));
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

export interface MappedEntity {
  entity: CanonicalEntity;
  rows: CanonicalRow[];
  report: ValidationReport;
}

export interface ReadResult {
  /** Best candidate, or null when nothing recognised the file. */
  detected: DetectionCandidate | null;
  /**
   * True when `detected` is an ANSWER rather than a guess.
   *
   * False means either that the best candidate is below the certainty line, or that
   * a rival from a different platform explains the file just as well. A caller that
   * is about to say "this is an X export" must check this first; a caller that shows
   * the manual column mapper should show it whenever this is false, so a file we are
   * only guessing at never has columns silently dropped by the wrong vendor's map.
   */
  sure: boolean;
  candidates: DetectionCandidate[];
  format: SourceFormat;
  /** Headers as they appear in the file — the manual mapper's left-hand column. */
  headers: string[];
  /** Raw rows, for the manual mapping path and for previewing the file as-is. */
  raw: SourceRow[];
  /** One entry per entity the file produced, already validated. */
  entities: MappedEntity[];
}

/**
 * Read a dropped file end to end: identify it, map it, and validate it — all locally.
 *
 * Nothing here touches the network. That is the whole point: by the time the tenant
 * sees a number, we have already proved we can read their file, and if we cannot they
 * find out in the same second rather than after an upload and a failed job.
 */
export function readSource(input: DetectInput, sourceId?: string): ReadResult {
  const format = sniffFormat(input.text);
  const candidates = detect(input);
  const chosen =
    sourceId === undefined
      ? (candidates[0] ?? null)
      : (candidates.find((candidate) => candidate.sourceId === sourceId) ?? candidates[0] ?? null);

  let headers: string[] = [];
  let raw: SourceRow[] = [];
  if (format === 'csv') {
    const parsed = parseDelimited(input.text);
    headers = parsed.headers;
    raw = parsed.rows;
  }

  const entities: MappedEntity[] = [];
  if (chosen !== null) {
    const found = allSources().find((entry) => entry.source.id === chosen.sourceId);
    const source = found?.source;
    if (source !== undefined) {
      if (isMultiEntity(source)) {
        const produced = source.mapAll(input.text);
        for (const [entity, rows] of Object.entries(produced)) {
          if (rows === undefined || rows.length === 0) continue;
          entities.push({
            entity: entity as CanonicalEntity,
            rows,
            report: validateRows(entity as CanonicalEntity, rows),
          });
        }
      } else if (isTextual(source)) {
        const rows = source.mapText(input.text);
        entities.push({ entity: source.entity, rows, report: validateRows(source.entity, rows) });
      } else if (typeof source.map === 'function') {
        const rows = source.map(raw);
        entities.push({ entity: source.entity, rows, report: validateRows(source.entity, rows) });
      }
    }
  }

  return {
    detected: chosen,
    // An explicitly chosen source IS the answer — the tenant said so.
    sure: sourceId === undefined ? isSure(chosen, candidates) : chosen !== null,
    candidates,
    format,
    headers,
    raw,
    entities,
  };
}

/**
 * Is the top candidate worth stating as fact?
 *
 * Two ways it is not. It can be under the certainty line — a gate it cleared on one
 * universal column with nothing corroborating it. Or another PLATFORM can explain
 * the file exactly as well, which makes naming one of them a coin toss wearing a
 * green tick. Rival sources from the same vendor do not count: "contacts or
 * customers, from Wix" is still Wix, and the chosen one carries the right map.
 */
function isSure(best: DetectionCandidate | null, candidates: DetectionCandidate[]): boolean {
  if (best === null) return false;
  if (best.confidence < CERTAIN) return false;
  return !candidates.some(
    (other) =>
      other.vendorSlug !== best.vendorSlug && Math.abs(best.confidence - other.confidence) < 0.001
  );
}

/**
 * Map raw rows with a hand-built column map, for a file nothing recognised.
 *
 * The escape hatch, not the default. `columnMap` is `{ theirHeader: ourField }`, which
 * is the direction the UI builds it in — the tenant looks at their own column and says
 * what it is.
 */
export function mapManually(
  entity: CanonicalEntity,
  raw: SourceRow[],
  columnMap: Record<string, string>
): MappedEntity {
  const rows: CanonicalRow[] = raw.map((source) => {
    const mapped: CanonicalRow = {};
    for (const [theirHeader, ourField] of Object.entries(columnMap)) {
      if (ourField === '') continue;
      const value = (source[theirHeader] ?? '').trim();
      if (value !== '') mapped[ourField] = value;
    }
    return mapped;
  });
  return { entity, rows, report: validateRows(entity, rows) };
}
