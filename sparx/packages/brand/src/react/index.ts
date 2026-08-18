// @sparx/brand/react — the sparx brand marks as React components.
//
// The ONE home for the spark, the wordmark, and the mascot. Every app (dashboard,
// marketing web, market, admin) imports from here instead of re-declaring SVG
// paths — so a brand refresh is a change in ../marks, not a hunt across apps.
//
// Dependency-free leaf components (no @wizeworks/ui, no server graph), safe for the
// marketing bundles that deliberately avoid the component-library shell.

export { Spark, SparxMark, type SparkProps, type SparxMarkProps } from './spark';
export { AppIcon, type AppIconProps } from './app-icon';
export { Wordmark, type WordmarkProps } from './wordmark';
export { SparkMascot, type SparkMascotProps, type SparkExpression } from './spark-mascot';
export { SparkFooterPeek, type SparkFooterPeekProps } from './spark-footer-peek';

// Moved out of `@wizeworks/ui` when that package became `@wizeworks/ui`: the badge
// is built from `BRAND` and says sparx out loud, so it belongs with the marks
// rather than in a brand-blind composition library.
export { MadeWithSparx, type MadeWithSparxProps } from './made-with-sparx';
