'use client';

// Drawing an email tree as real DOM.
//
// An approximation, and honestly so: the thing a recipient opens is table-based
// HTML shaped by Outlook's quirks, and the Preview is where that is checked. What
// this has to get right is what the AUTHOR is deciding — the order of the blocks,
// their colors, their spacing, and what their merge tags say. Everything the
// author typed is drawn from the document; nothing is invented.
//
// STYLING RULE (hard): every class here is a LITERAL string, so a consuming app's
// Tailwind `@source` scan safelists it. Authored values arrive through the
// stylesheet in `style.ts`, never as a `style` prop.

import type { ReactNode } from 'react';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import { emailChildren } from '../../email/walk';
import type { EmailPreviewHost } from '../host';
import { resolveMergeTags } from './tokens';

export interface EmailRenderContext {
  /** How this canvas resolves bindings and merge tags. Undefined draws them as authored. */
  preview: EmailPreviewHost | undefined;
  selectedIds: readonly string[];
  hoverId: string | null;
  /** Where a drop would land, drawn as an edge or a ring while dragging. */
  dropHint: EmailDropHint | null;
  /**
   * The block currently in the air on a press-and-hold drag.
   *
   * A mouse drag carries the browser's own ghost and needs nothing; a finger drag
   * has no ghost, so without this the only evidence the hold had registered was a
   * drop indicator somewhere else in the email.
   */
  liftedId?: string | null;
}

export interface EmailDropHint {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

/** The outline utilities a node wears for its current state. Outline, never
 *  border: it takes no space, so highlighting a block cannot move its neighbour. */
function stateClasses(ctx: EmailRenderContext, node: EmailNode): string {
  const classes: string[] = [];

  if (ctx.selectedIds.includes(node.id)) {
    classes.push('outline-(--studio-select) outline outline-2 -outline-offset-2');
  } else if (ctx.hoverId === node.id) {
    classes.push(
      'outline-[color-mix(in_oklab,var(--studio-select)_50%,transparent)] outline outline-1 -outline-offset-1'
    );
  }

  // Faded because it is ELSEWHERE — held under a finger. This is the hole it left.
  if (ctx.liftedId === node.id) classes.push('opacity-50');

  if (ctx.dropHint?.targetId === node.id) {
    classes.push(
      ctx.dropHint.position === 'inside'
        ? 'outline-(--studio-drop) outline outline-2 outline-dashed -outline-offset-2'
        : 'outline-(--studio-drop) outline outline-2 -outline-offset-2'
    );
  }

  return classes.join(' ');
}

/** The attributes every drawn node carries: its address, and whether it can move. */
function frameProps(ctx: EmailRenderContext, node: EmailNode, base: string) {
  return {
    'data-enode': node.id,
    draggable: !node.locked,
    className: [base, stateClasses(ctx, node)].filter(Boolean).join(' '),
  };
}

/** A bound node's value, from sample data, so a bound line reads as a real name. */
function boundValue(ctx: EmailRenderContext, node: EmailNode): string | undefined {
  if (node.data?.kind !== 'value') return undefined;
  return ctx.preview?.resolveBinding?.(node.data.ref, node.data.attr);
}

export function renderEmailNode(node: EmailNode, ctx: EmailRenderContext): ReactNode {
  switch (node.kind) {
    case 'body':
      return (
        <div {...frameProps(ctx, node, 'mx-auto flex min-h-full flex-col')} draggable={false}>
          {renderChildren(node, ctx)}
        </div>
      );

    case 'section':
      return (
        <div key={node.id} {...frameProps(ctx, node, 'flex flex-col gap-3')}>
          {emailChildren(node).length ? (
            renderChildren(node, ctx)
          ) : (
            <EmptySlot label="This band is empty — drop something into it" />
          )}
        </div>
      );

    case 'columns':
      return (
        <div key={node.id} {...frameProps(ctx, node, 'flex flex-wrap gap-3')}>
          {renderChildren(node, ctx)}
        </div>
      );

    case 'column':
      return (
        <div key={node.id} {...frameProps(ctx, node, 'flex min-w-32 grow flex-col gap-3')}>
          {emailChildren(node).length ? (
            renderChildren(node, ctx)
          ) : (
            <EmptySlot label="Empty column" />
          )}
        </div>
      );

    case 'link':
      return (
        <div key={node.id} {...frameProps(ctx, node, 'flex cursor-pointer flex-col gap-2')}>
          {renderChildren(node, ctx)}
        </div>
      );

    case 'text':
      return (
        <div
          key={node.id}
          {...frameProps(ctx, node, 'whitespace-pre-wrap')}
          dangerouslySetInnerHTML={{
            __html: resolveMergeTags(boundValue(ctx, node) ?? node.html, ctx.preview),
          }}
        />
      );

    case 'button':
      return (
        <span key={node.id} {...frameProps(ctx, node, 'inline-block cursor-pointer font-medium')}>
          {resolveMergeTags(boundValue(ctx, node) ?? node.label, ctx.preview)}
        </span>
      );

    case 'image':
      return <EmailImage key={node.id} node={node} ctx={ctx} />;

    case 'video':
      return (
        <span key={node.id} {...frameProps(ctx, node, 'relative inline-block')}>
          <Thumbnail src={node.thumbnail} alt="Video" />
          {node.showPlayButton ? (
            <span className="bg-base-100/80 text-base-content absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full text-lg">
              ▶
            </span>
          ) : null}
        </span>
      );

    case 'divider':
      return <div key={node.id} {...frameProps(ctx, node, 'w-full')} />;

    case 'spacer':
      return <div key={node.id} {...frameProps(ctx, node, 'w-full')} aria-hidden />;

    case 'social':
      return (
        <div key={node.id} {...frameProps(ctx, node, 'flex flex-wrap')}>
          {node.links.map((link, index) => (
            <span
              key={`${link.platform}-${index}`}
              className="bg-base-300 text-base-content rounded-full px-3 py-1 text-sm capitalize"
            >
              {link.platform}
            </span>
          ))}
        </div>
      );

    case 'html':
      return (
        <div
          key={node.id}
          {...frameProps(ctx, node, 'whitespace-pre-wrap')}
          // The author's own markup, drawn as authored. The projector emits it
          // verbatim too, so this is the one node where the canvas is exact.
          dangerouslySetInnerHTML={{ __html: resolveMergeTags(node.html, ctx.preview) }}
        />
      );
  }
}

/** An image field the author has not filled yet says so, rather than drawing a
 *  broken-image glyph that reads as a fault in the editor. */
function EmailImage({
  node,
  ctx,
}: {
  node: EmailNode & { kind: 'image' };
  ctx: EmailRenderContext;
}) {
  const src = boundValue(ctx, node) ?? node.src;
  return (
    <span {...frameProps(ctx, node, 'inline-block')}>
      <Thumbnail src={src} alt={node.alt} />
    </span>
  );
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <span className="border-base-content/25 text-base-content bg-base-200 flex min-h-24 items-center justify-center rounded border border-dashed p-4 text-sm">
        Choose a picture
      </span>
    );
  }
  // A plain `<img>`, not a framework image component: this package is
  // framework-neutral, and the source is an arbitrary author-supplied URL that no
  // optimiser has a loader for anyway.
  return <img src={src} alt={alt} className="block h-auto w-full" />;
}

function EmptySlot({ label }: { label: string }) {
  return (
    <span className="border-base-content/25 text-base-content bg-base-200 rounded border border-dashed p-4 text-sm">
      {label}
    </span>
  );
}

function renderChildren(node: EmailNode, ctx: EmailRenderContext): ReactNode {
  return emailChildren(node).map((child) => renderEmailNode(child, ctx));
}
