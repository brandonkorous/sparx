// @wizeworks/links — the one address table.
//
// The workbench is a single application with many panes, not a stack of pages,
// so a URL here names ONE destination that arrives on top of whatever the
// operator already has open. This package owns the vocabulary of those
// destinations: what a path means, what a surface's address is, and where an
// indexed record lives.
//
// It is the shared half on purpose. api-rest, the workers and @wizeworks/email all
// need to write links, and none of them can import the workbench's surface
// registry (which pulls in React, every pane, and silicaui). Before this
// existed, each emitter hardcoded a surface key or invented a query string of
// its own — which is how "your post didn't go out" emails came to point at
// `/?surface=social.composer`, a parameter the workbench has never read.

export type { AppRoute, LinkOptions, MatchedLink, RouteParams } from './types';
export { ROUTES } from './routes';
export {
  SITE_PARAM,
  TAB_PARAM,
  buildPath,
  linkTo,
  linkToEntity,
  matchPath,
  normalizePath,
  pathForEntity,
  routeAcceptsId,
  routeForEntity,
  routeForSurface,
} from './resolve';
