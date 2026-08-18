// "sparky", the sparx mascot, now lives in @sparx/brand (the single source of
// truth for brand mark geometry — the spark, the wordmark, and the mascot). This
// re-export keeps the marketing import path stable. Its idle-bob / blink motion
// classes (`.spark-mascot*`) ship WITH the component in @sparx/brand/mascot.css,
// imported from app/globals.css — marketing.css used to carry a second copy.
export { SparkMascot, type SparkMascotProps, type SparkExpression } from '@sparx/brand/react';
