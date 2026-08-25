// Saying what a design and its install MEAN, in an owner's words.
//
// Pure presentation vocabulary — no queries, no cache, nothing that needs a
// client boundary. Split out of blueprints-data so the reads stay reads and the
// wording stays in one place the gallery, the detail pane and the wizard can all
// quote from.

import { apiErrorMessage } from '../../lib/api-error';
import type { BlueprintContents } from './blueprints-data';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** What an install's status means, in an owner's words, with the tone that
 *  carries its color on a `<Badge>`. */
export function installState(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'live':
      return {
        label: 'Live',
        tone: 'success',
        detail: 'This design has been published — visitors see it on your site now.',
      };
    case 'installed':
      return {
        label: 'Added as drafts',
        tone: 'info',
        detail:
          'Everything this design adds is on your site as drafts — only you can see it. Review it, then publish it when you are ready.',
      };
    case 'running':
      return {
        label: 'Setting up',
        tone: 'warning',
        detail: 'This design is still being added. Give it a moment, then refresh.',
      };
    case 'failed':
    default:
      return {
        label: 'Setup stopped',
        tone: 'error',
        detail:
          'Something went wrong partway through adding this design. Remove it to clear what was started, then try again.',
      };
  }
}

/** The friendly name for a module slug, for the "what this needs" note. Falls
 *  back to a capitalised slug so an unknown module still reads as words. */
export function moduleLabel(slug: string): string {
  const names: Record<string, string> = {
    builder: 'Site',
    commerce: 'Store',
    cms: 'Content',
    email: 'Email',
    crm: 'Customers',
    b2b: 'Wholesale',
    invoicing: 'Invoicing',
    inventory: 'Inventory',
    scheduling: 'Scheduling',
    dropship: 'Dropshipping',
  };
  return names[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** A short "what it creates" line for a card: the two or three biggest things,
 *  in plain words. Empty designs (a bare starting point) say so rather than
 *  showing nothing. */
export function contentsSummary(contents: BlueprintContents): string {
  const parts = contentsLines(contents);
  if (parts.length === 0) return 'A clean starting point';
  return parts
    .slice(0, 3)
    .map((line) => line.text)
    .join(' · ');
}

export interface ContentsLine {
  key: string;
  text: string;
}

/** What the design brings, split the way the install itself splits it: the
 *  structure it always brings, and the examples that are a choice (issue 098). */
export interface ContentsGroups {
  structure: ContentsLine[];
  examples: ContentsLine[];
}

function counted(
  contents: BlueprintContents,
  keys: [keyof BlueprintContents, string, string][]
): ContentsLine[] {
  const out: ContentsLine[] = [];
  for (const [key, one, many] of keys) {
    const value = contents[key];
    if (typeof value === 'number' && value > 0) {
      out.push({ key, text: `${String(value)} ${value === 1 ? one : many}` });
    }
  }
  return out;
}

/** The two groups, largest concepts first inside each. The pages, the shelves and
 *  the email designs are the design; the stock on the shelves, the articles and
 *  the diary are somebody else's business, kept only if she asks for them. */
export function contentsGroups(contents: BlueprintContents): ContentsGroups {
  return {
    structure: counted(contents, [
      ['pages', 'page', 'pages'],
      ['categories', 'category', 'categories'],
      ['collections', 'collection', 'collections'],
      ['emails', 'email design', 'email designs'],
    ]),
    examples: counted(contents, [
      ['products', 'example product', 'example products'],
      ['content', 'example article', 'example articles'],
      ['schedulingServices', 'example service', 'example services'],
      ['schedulingResources', 'example team member', 'example team members'],
      ['schedulingLocations', 'example place', 'example places'],
    ]),
  };
}

/** Every non-empty "what it creates" count as a labelled line, structure first. */
export function contentsLines(contents: BlueprintContents): ContentsLine[] {
  const groups = contentsGroups(contents);
  return [...groups.structure, ...groups.examples];
}

/** What taking (or leaving) the examples actually does, for a confirm. */
export function examplesSentence(sampleData: boolean): string {
  return sampleData
    ? 'Its example products, articles and bookings come too, so there is something real on every screen to look at and change.'
    : 'Its examples are left out, so nothing arrives that is not yours. The pages and shelves come in empty, ready for your own.';
}

/** The server's own sentence for a 4xx, shown verbatim: the blueprint routes
 *  explain the real problem ("This template is already installed…") far better
 *  than a status code can. A 5xx carries no such sentence, so it falls back to
 *  the caller's wording. */
export function blueprintErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}

/** Medium date, or an em dash for nothing. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
