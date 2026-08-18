// What a brand-new workbench opens with.
//
// Kept deliberately small — two panes, not a pre-built six-pane "productivity
// dashboard". The premise of this app is that the operator arranges their own
// screen; opening with someone else's arrangement would undercut that on the
// very first impression, and a dense unfamiliar grid is intimidating besides.
// Start with one thing to look at, and let them build from there.

import type { SurfaceParams } from '../surfaces/descriptor';

export interface DefaultLayoutEntry {
  surface: string;
  params?: SurfaceParams;
}

export const DEFAULT_LAYOUT: readonly DefaultLayoutEntry[] = [{ surface: 'workbench.home' }];
