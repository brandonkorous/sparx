'use client';

// An email tree's authored values, as a real stylesheet.
//
// Every visual decision in an email is a NAMED FIELD carrying a literal value —
// a hex, a pixel count — because email HTML cannot ship CSS custom properties
// (Outlook and most clients do not support them). So the canvas cannot express
// these as classes, and it must not write them as `style` props either. It emits
// one stylesheet per canvas instead, scoped by attribute, exactly as the site
// canvas does with its theme.
//
// Every value is passed through `safe`. These strings come from an author typing
// into a colour box, and a stylesheet is the one place a stray `}` stops being a
// typo and starts being a way to write rules for the rest of the page.

import type { Align, EmailNode, FontWeight } from '@wizeworks/silicaui-builder/email';
import { walkEmail } from '../../email/walk';

const WEIGHTS: Record<FontWeight, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/** What `align` means for the node's own content, and for the node in its row. */
const SELF_ALIGN: Record<Align, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/** Strip anything that could end a declaration or open a rule. */
function safe(value: string): string {
  return value.replace(/[;{}<>\\"']/g, '').trim();
}

function px(value: number): string {
  return `${Math.round(value)}px`;
}

function url(value: string): string {
  const cleaned = safe(value);
  return cleaned ? `url("${cleaned}")` : 'none';
}

/** The declarations one node contributes. Empty when it paints nothing itself. */
function declarationsFor(node: EmailNode): string[] {
  switch (node.kind) {
    case 'body':
      return [
        `max-width:${px(node.width)}`,
        `background:${safe(node.contentBg)}`,
        `font-family:${safe(node.fontFamily)}`,
      ];

    case 'section':
      return [
        `background-color:${safe(node.bg)}`,
        ...(node.bgImage ? [`background-image:${url(node.bgImage)}`, 'background-size:cover'] : []),
        `padding:${px(node.paddingY)} ${px(node.paddingX)}`,
        `text-align:${node.align ?? 'center'}`,
        ...(node.radius ? [`border-radius:${px(node.radius)}`] : []),
        ...(node.borderWidth
          ? [`border:${px(node.borderWidth)} solid ${safe(node.borderColor ?? node.bg)}`]
          : []),
        ...(node.marginX || node.marginY
          ? [`margin:${px(node.marginY ?? 0)} ${px(node.marginX ?? 0)}`]
          : []),
      ];

    case 'column':
      return [`flex-basis:${node.widthPct}%`];

    case 'text':
      return [
        `color:${safe(node.color)}`,
        `font-size:${px(node.fontSize)}`,
        `font-weight:${WEIGHTS[node.fontWeight]}`,
        // PIXELS, not a ratio — `TextNode.lineHeight` is a px count and the
        // projector emits it as one. Written unitless it would multiply the font
        // size, and a 16px line would draw 24 lines tall.
        `line-height:${px(node.lineHeight)}`,
        `text-align:${node.align}`,
      ];

    case 'button':
      return [
        node.variant === 'outline' ? 'background:transparent' : `background-color:${safe(node.bg)}`,
        `color:${safe(node.color)}`,
        `border-radius:${px(node.radius)}`,
        `padding:${px(node.paddingY)} ${px(node.paddingX)}`,
        `align-self:${SELF_ALIGN[node.align]}`,
        ...(node.borderWidth || node.variant === 'outline'
          ? [`border:${px(node.borderWidth ?? 1)} solid ${safe(node.borderColor ?? node.bg)}`]
          : []),
      ];

    case 'divider':
      return [`border-top:${px(node.thickness)} solid ${safe(node.color)}`];

    case 'spacer':
      return [`height:${px(node.height)}`];

    case 'image':
    case 'video':
      return [`width:${px(node.width)}`, `align-self:${SELF_ALIGN[node.align]}`];

    case 'social':
      return [`gap:${px(node.gap)}`, `justify-content:${SELF_ALIGN[node.align]}`];

    default:
      return [];
  }
}

/**
 * Every rule this document needs, scoped to one canvas.
 *
 * Keyed by node id rather than by kind: two sections in one email have two
 * different backgrounds, which is the whole point of authoring them separately.
 */
export function emailStylesheet(root: EmailNode, scope: string): string {
  const rules: string[] = [];
  const prefix = `[data-studio-email="${safe(scope)}"]`;

  // The canvas wallpaper — the body's own `bg`, which shows as the margin either
  // side of the content in a wide client.
  if (root.kind === 'body') rules.push(`${prefix}{background-color:${safe(root.bg)}}`);

  walkEmail(root, (node) => {
    const declarations = declarationsFor(node);
    if (!declarations.length) return;
    rules.push(`${prefix} [data-enode="${safe(node.id)}"]{${declarations.join(';')}}`);
  });

  return rules.join('\n');
}
