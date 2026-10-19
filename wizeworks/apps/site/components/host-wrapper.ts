// The class a host core's wrapper wears in the chrome walk (`silica-chrome.tsx`).
//
// Plain TS rather than part of the walk so it can be tested without a JSX transform.

import { HOST_KEYS } from '@wizeworks/silica-catalog';

/** The cores whose component paints itself with the node's class (`silica-host-cores`
 *  hands it on as `className`). Their wrapper must not wear the same class a second
 *  time: the account link drew as a button inside a button, double padded, which made
 *  "Brynn" 95px wide and pushed a phone header's logo to 0px (sparx persona issue 291).
 *  Their wrapper is `contents`, so the component's own element is the one the bar
 *  lays out, and every class on the node applies exactly once. */
export const CLASS_FORWARDING_CORES: ReadonlySet<string> = new Set([
  HOST_KEYS.siteBrand,
  HOST_KEYS.siteAccountLink,
  HOST_KEYS.siteSocialLinks,
]);

/** The wrapper class a host node's `<div>` wears in the chrome walk. */
export function hostWrapperClass(node: { component?: string; class?: string }): string | undefined {
  if (!node.class) return undefined;
  return node.component && CLASS_FORWARDING_CORES.has(node.component) ? 'contents' : node.class;
}
