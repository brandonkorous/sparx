// The email layer list, as rows.
//
// Pure, so the interesting part — what a row is CALLED — is testable without a
// browser. That matters more here than on a site: an email is a stack of near
// identical bands, and "Section, Section, Section" is a list that tells an author
// nothing. So a row falls back to a snippet of its own content, which is how
// someone finds the paragraph they meant.

import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import { emailChildren } from '../../email/walk';

export interface EmailLayerRow {
  id: string;
  label: string;
  icon: string;
  depth: number;
  locked: boolean;
  /** Can this row hold others? Drives the drop band and the twisty. */
  container: boolean;
}

const ICONS: Record<EmailNode['kind'], string> = {
  body: 'page',
  section: 'section',
  columns: 'columns',
  column: 'columns',
  link: 'link',
  text: 'text',
  image: 'image',
  button: 'button',
  divider: 'divider',
  spacer: 'spacer',
  social: 'share',
  video: 'video',
  html: 'code',
};

const KIND_LABELS: Record<EmailNode['kind'], string> = {
  body: 'Email',
  section: 'Band',
  columns: 'Columns',
  column: 'Column',
  link: 'Link group',
  text: 'Text',
  image: 'Picture',
  button: 'Button',
  divider: 'Divider',
  spacer: 'Space',
  social: 'Social links',
  video: 'Video',
  html: 'Custom code',
};

/** The first few words of a block's own content, tags stripped. */
function snippet(node: EmailNode): string | undefined {
  const text = node.kind === 'text' ? node.html : node.kind === 'button' ? node.label : undefined;
  if (!text) return undefined;
  const words = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return undefined;
  return words.length > 32 ? `${words.slice(0, 32)}…` : words;
}

export function emailRowLabel(node: EmailNode): string {
  const named = node.name?.trim();
  if (named) return named;
  return snippet(node) ?? KIND_LABELS[node.kind];
}

/**
 * Every node as a row, parents before children.
 *
 * The body is included: it is the document's own root, and selecting it is how an
 * author reaches the email's width, its wallpaper and its typeface — the same way
 * selecting a page reaches its address.
 */
export function emailLayerRows(root: EmailNode): EmailLayerRow[] {
  const rows: EmailLayerRow[] = [];
  const step = (node: EmailNode, depth: number): void => {
    rows.push({
      id: node.id,
      label: emailRowLabel(node),
      icon: ICONS[node.kind],
      depth,
      locked: Boolean(node.locked),
      container: 'children' in node,
    });
    for (const child of emailChildren(node)) step(child, depth + 1);
  };
  step(root, 0);
  return rows;
}
