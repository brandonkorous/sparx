'use client';

// A pane's icon wherever its TAB is drawn: the tab strip, the open-tabs menu, the
// phone's open sheet.
//
// Usually that is the surface's own icon from the registry. A surface whose
// record says more (a bay is not a person, sparx persona issue 086) declares
// `useTabIcon`, and the tab asks it directly, so the picture is right for a tab
// restored into the dock and never opened, not just for the pane on screen.
//
// The surface's hook runs in its own child component, keyed by the surface, so
// a pane retargeted to a different surface remounts it rather than calling a
// different set of hooks in the same place.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { PaneDescriptor, SurfaceParams } from '../surfaces/descriptor';
import { getSurface } from '../surfaces/registry';

const NO_PARAMS: SurfaceParams = {};

export function TabGlyph({
  descriptor,
  className,
  fallback = null,
}: {
  descriptor: PaneDescriptor | undefined;
  className: string;
  /** Drawn when the surface has no icon at all. */
  fallback?: ReactNode;
}) {
  const definition = descriptor ? getSurface(descriptor.surface) : undefined;
  if (!definition) return fallback;
  const useTabIcon = definition.useTabIcon;
  if (!useTabIcon) return <definition.icon className={className} aria-hidden />;
  return (
    <ResolvedGlyph
      key={definition.key}
      useTabIcon={useTabIcon}
      params={descriptor?.params ?? NO_PARAMS}
      icon={definition.icon}
      className={className}
    />
  );
}

function ResolvedGlyph({
  useTabIcon,
  params,
  icon,
  className,
}: {
  useTabIcon: (params: SurfaceParams) => LucideIcon | undefined;
  params: SurfaceParams;
  icon: LucideIcon;
  className: string;
}) {
  const Glyph = useTabIcon(params) ?? icon;
  return <Glyph className={className} aria-hidden />;
}
