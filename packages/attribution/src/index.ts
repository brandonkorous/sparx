/**
 * @sparx/attribution — marketing attribution engine (docs/80).
 * Single source of truth for the UTM taxonomy, the channel classifier, and the
 * validating campaign-link builder. Consumed by capture (apps/web, apps/site)
 * in Phase 1+ and by the Phase 0 launch link generator.
 */
export * from './types';
export * from './taxonomy';
export * from './classify';
export * from './capture';
export * from './links';
export { LAUNCH_LINKS } from './launch-links';
