// The sparx wordmark now lives in @sparx/brand (the single source of truth for
// brand mark geometry — the spark, the wordmark, and the mascot). This re-export
// keeps `import { Wordmark } from '@sparx/ui'` working for the whole dashboard.
export { Wordmark, type WordmarkProps } from '@sparx/brand/react';
