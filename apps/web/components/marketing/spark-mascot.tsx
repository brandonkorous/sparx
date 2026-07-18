// "sparky", the sparx mascot, now lives in @sparx/brand (the single source of
// truth for brand mark geometry — the spark, the wordmark, and the mascot). This
// re-export keeps the marketing import path stable. Its idle-bob / blink motion
// classes (`.spark-mascot*`) live in apps/web/app/marketing.css.
export { SparkMascot, type SparkMascotProps, type SparkExpression } from '@sparx/brand/react';
