'use client';

// Live Surface utility preview for the editor canvas (docs/61 §10; the temp.css
// path, docs/47 §5.2).
//
// The class-first model styles every node with a literal `class` string. To make
// authored Tailwind-native utilities (`grid-cols-4`, `rounded-box`, `animate-fade-up`)
// render in the canvas the way they will on the live site, we collect the working
// tree's class set, compile it server-side (compileSurfacePreview → the real
// Tailwind compiler, allowlist-filtered), and inject the result.
//
// The compiled output carries generic utilities (`.flex`, `.gap-6`) and a theme
// var block that would collide with the dashboard's own Tailwind chrome, so — like
// the static canvas sheet (scope-canvas.mjs) — we wrap it in `@scope (.bx-canvas)`
// and retarget the `:root, :host` theme primitives to `:scope`. Every rule then
// only matches inside the preview canvas.

import * as React from 'react';
import type { BuilderNode } from '@sparx/builder-schemas';
import { compileSurfacePreview } from '../_lib/actions';

/** Every distinct class token authored across a node tree, sorted (stable key). */
function collectTreeClasses(root: BuilderNode): string[] {
  const set = new Set<string>();
  const visit = (node: BuilderNode): void => {
    if (node.class) {
      for (const token of node.class.split(/\s+/)) if (token) set.add(token);
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return [...set].sort();
}

/** Confine compiled utility CSS to the editor canvas — the same `@scope` trick the
 *  static canvas sheet uses (scope-canvas.mjs), so tenant utilities never repaint
 *  the dashboard's own Tailwind. */
export function scopeToCanvas(css: string): string {
  return `@scope (.bx-canvas) {\n${css.replaceAll(':root, :host', ':scope')}\n}`;
}

/**
 * Live-compile the working tree's authored utility classes into `@scope`-d canvas
 * CSS. Debounced and keyed on the class SET, so edits that don't change the class
 * set don't recompile. Returns the CSS string to inject, or '' when nothing is
 * authored (or the compile is in flight on first paint).
 */
export function useSurfacePreview(tree: BuilderNode): string {
  const classKey = collectTreeClasses(tree).join(' ');
  const [css, setCss] = React.useState('');

  React.useEffect(() => {
    if (!classKey) {
      setCss('');
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      void compileSurfacePreview(classKey.split(' ')).then((res) => {
        if (!cancelled && res.ok && res.data) setCss(scopeToCanvas(res.data.css));
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [classKey]);

  return css;
}
