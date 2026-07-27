// @sparx/brand/react — the sparx brand marks as React components.
//
// The ONE home for the spark, the wordmark, and the mascot. Every app (dashboard,
// marketing web, market, admin) imports from here instead of re-declaring SVG
// paths — so a brand refresh is a change in ../marks, not a hunt across apps.
//
// Dependency-free leaf components (no @sparx/ui, no server graph), safe for the
// marketing bundles that deliberately avoid the component-library shell.

export { Spark, SparxMark, type SparkProps, type SparxMarkProps } from './spark';
export { AppIcon, type AppIconProps } from './app-icon';
export { Wordmark, type WordmarkProps } from './wordmark';
export { SparkMascot, type SparkMascotProps, type SparkExpression } from './spark-mascot';
