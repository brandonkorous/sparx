// The sparx marks now live in @sparx/brand (the single source of truth for brand
// mark geometry). `Spark` is the inline glyph — the "x", standing alone, in one
// color; `SparxMark` is retained as a back-compat alias for it so existing
// `import { SparxMark } from '@sparx/ui'` call sites keep working. `AppIcon` is
// the separate favicon / install-tile lockup: a full-bleed field of brand color
// with the "x" knocked OUT of it.
export { Spark, SparxMark, type SparkProps, type SparxMarkProps } from '@sparx/brand/react';
export { AppIcon, type AppIconProps } from '@sparx/brand/react';
