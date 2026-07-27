// @sparx/app-kit — the framework glue every sparx Next.js app needs.
//
// Deliberately NOT @sparx/ui: nothing here has an appearance, a variant, or a
// token. @sparx/ui is the composition layer an app's designers work in; this is
// the layer beneath it that keeps the tab alive. Mixing the two is what left
// four apps carrying four copies of the same stale-build detector, one of which
// then drifted out of date without anyone noticing.

export { isChunkLoadError, reloadOnceForStaleBuild } from './chunk-error';
export { ChunkReloadGuard } from './chunk-reload-guard';
