'use client';

// Where a scored thing is edited, and the hue that editor wears.
//
// WHY THIS EXISTS. The page check named the things to change and gave no way to
// change any of them: the pane's only buttons were Refresh and Copy a link.
// Gillett Diesel read "a very short title wastes the best chance you have of
// being found" on his About page and had nowhere to go from there (sparx persona
// issue 133). The Piggles console fixed the same gap in its issue 392, and this
// console was left without it, because the parity check compares shared
// components and libraries, not each screen folder.
//
// A pane being READ-ONLY does not make it actionless. It already knows the kind
// of thing and its id, which is everything needed to open the one editor that can
// change what the check complained about.
//
// THE HUE IS THE POINT, not decoration. The jump LEAVES this module, so the
// button wears the module it lands in (Builder for a page, CMS for an article,
// Commerce for a product or a collection) and says where it goes before it is
// taken.

import { useMemo } from 'react';
import { FileText, Layers, Package, PencilRuler, type LucideIcon } from 'lucide-react';
import type { WorkbenchModule } from '../../components/module-scope';
import type { ToolbarAction } from '../../components/pane-toolbar-actions';
import type { SurfaceParams } from '../../lib/surfaces/descriptor';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  moduleIsVisible,
  useKnownModules,
  useReachableModules,
} from '../../lib/surfaces/use-visible-nav';
import { entityLabel, type EntityType } from './data';

export interface FixTarget {
  /** Registry key of the editor that can change what the checks complained about. */
  surface: string;
  params: SurfaceParams;
  /** The module the jump lands in. The button wears its hue. */
  module: WorkbenchModule;
  icon: LucideIcon;
  /** The destination in the person's own words, never "entity" or "record". */
  label: string;
}

/**
 * The editor for one scored thing.
 *
 * The id handed in is the ENTITY's, not the audit row's: `auditDetailParams` puts
 * `entityId` in the address. A `builder_page` id is a `builder_pages` row,
 * `cms_page` a `content_entries` row, `product` a product, `collection` a
 * collection.
 */
export function fixTargetFor(type: EntityType, entityId: string): FixTarget {
  const label = `Edit this ${entityLabel(type).toLowerCase()}`;
  switch (type) {
    case 'cms_page':
      return {
        surface: 'cms.content.detail',
        params: { id: entityId },
        module: 'cms',
        icon: FileText,
        label,
      };
    case 'product':
      return {
        surface: 'commerce.product.detail',
        params: { id: entityId },
        module: 'commerce',
        icon: Package,
        label,
      };
    case 'collection':
      return {
        surface: 'commerce.collection.detail',
        params: { id: entityId },
        module: 'commerce',
        icon: Layers,
        label,
      };
    case 'builder_page':
      // The site editor, opened on this page. It takes `pageId`, not `id`: the one
      // target whose param name differs, and the reason this is a function rather
      // than a record keyed by type.
      return {
        surface: 'builder.studio',
        params: { pageId: entityId },
        module: 'builder',
        icon: PencilRuler,
        label,
      };
  }
}

/** Same modifier contract as every list: a jump opens in a tab, alongside on
 *  shift, in a new window on alt. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * The jump as a toolbar action, or nothing when the destination is out of reach.
 *
 * Gated on the MODULE, as the rail and the command palette are: a module turned
 * off after its pages were scored leaves the scores behind, and a button into a
 * module nobody can open lands nowhere.
 */
export function useFixAction(
  ctx: SurfaceContext,
  type: EntityType,
  id: string
): ToolbarAction | undefined {
  const reachable = useReachableModules();
  const known = useKnownModules();
  return useMemo(() => {
    const target = fixTargetFor(type, id);
    if (!moduleIsVisible(target.module, reachable, known)) return undefined;
    return {
      label: target.label,
      icon: target.icon,
      module: target.module,
      onClick: (event) => {
        ctx.open(target.surface, target.params, { target: targetFor(event) });
      },
    };
  }, [ctx, type, id, reachable, known]);
}
