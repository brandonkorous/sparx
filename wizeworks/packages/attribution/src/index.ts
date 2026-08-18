/**
 * @wizeworks/attribution — marketing attribution engine (docs/80).
 * Single source of truth for the UTM taxonomy, the channel classifier, and the
 * validating campaign-link builder. Consumed by capture (sparx/apps/web, wizeworks/apps/site)
 * in Phase 1+ and by the Phase 0 launch link generator.
 *
 * BRAND-BLIND. Everything reachable from this barrel is a mechanism — a cookie
 * name, a taxonomy, a classifier, a link BUILDER — and states no brand's value.
 * That is what lets both consoles capture first-touch attribution from one copy.
 *
 * `LAUNCH_LINKS` is deliberately NOT re-exported. It is a data file of one
 * brand's own campaign URLs and campaign names, so it sat in this barrel stating
 * `https://sparx.works` inside a package Piggles imports. It is reachable at the
 * `./launch-links` subpath, by the brand that owns it.
 */
export * from './types';
export * from './taxonomy';
export * from './classify';
export * from './capture';
export * from './links';
