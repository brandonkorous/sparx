// The sparx mark now lives in @sparx/brand (the single source of truth for brand
// mark geometry). The mark is the single-color spark; `SparxMark` is retained as
// a back-compat alias for `Spark` so existing `import { SparxMark } from
// '@sparx/ui'` call sites keep working.
export { Spark, SparxMark, type SparkProps, type SparxMarkProps } from '@sparx/brand/react';
