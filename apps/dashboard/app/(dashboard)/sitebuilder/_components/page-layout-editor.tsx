'use client';

// The per-layout canvas editor (docs/36 §11, P-D). Mounted by
// /sitebuilder/layouts/<id> in the editor shell's inspector column, with the live
// storefront canvas beside it. Generalizes the old per-scope LayoutScopeEditor:
// it configures the shared canvas for the layout's target, then wraps the shared
// SectionBuilder (which owns add / reorder / inline-edit against `pageLayoutId`).
//
// Canvas wiring per target:
//   • product / collection (bound) — sample-data preview (doc 36 §9) against a
//     fixed sample item, and `sparxLayoutKey` forces THIS layout onto the canvas
//     so an alternate layout previews as itself (the storefront resolver would
//     otherwise pick the default for the sample item).
//   • site:home — preview at `/` (the home route renders the home composition).
//   • cms:content-page — preview at `/<slug>` (the slug IS the layout key).
// The flags are cleared on the way out so other scopes aren't affected.

import * as React from 'react';
import { Heading, Text } from '@sparx/ui';
import type { CustomDefinitionDto, SiteSectionDto } from '../_lib/types';
import { SectionBuilder } from './section-builder';
import { useEditorCanvas } from './editor-shell';

export interface PageLayoutEditorProps {
  layout: { id: string; targetId: string; key: string; name: string };
  /** The target's binding (product/collection) or null (home/page). */
  binding: 'product' | 'collection' | null;
  targetLabel: string;
  sections: SiteSectionDto[];
  /** The tenant's custom section definitions, merged into the section library. */
  customDefinitions: CustomDefinitionDto[];
}

export function PageLayoutEditor({
  layout,
  binding,
  targetLabel,
  sections,
  customDefinitions,
}: PageLayoutEditorProps) {
  const canvas = useEditorCanvas();

  React.useEffect(() => {
    if (binding === 'product' || binding === 'collection') {
      const base = binding === 'product' ? '/products' : '/collections';
      canvas.setSampleData(true);
      canvas.setPreviewPath(`${base}/sample`);
      canvas.setLayoutKey(layout.key);
    } else if (layout.targetId === 'cms:content-page') {
      canvas.setPreviewPath(`/${layout.key}`);
      canvas.setLayoutKey(null);
    } else {
      // site:home (and any future static target) previews at the site root.
      canvas.setPreviewPath('/');
      canvas.setLayoutKey(null);
    }
    return () => {
      canvas.setSampleData(false);
      canvas.setLayoutKey(null);
    };
  }, [canvas, binding, layout.targetId, layout.key]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <Text size="xs" variant="muted">
          {targetLabel}
        </Text>
        <Heading level={1}>{layout.name}</Heading>
      </div>
      {binding ? (
        <Text size="sm" variant="muted">
          Previewing with sample {binding} data, so you can design this layout before you have real{' '}
          {binding}s — every {binding} assigned to it renders this way.
        </Text>
      ) : null}
      <SectionBuilder
        pageLayoutId={layout.id}
        targetId={layout.targetId}
        sections={sections}
        customDefinitions={customDefinitions}
        manageCanvasPath={false}
      />
    </div>
  );
}
