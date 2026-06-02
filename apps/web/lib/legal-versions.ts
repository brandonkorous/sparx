// Re-export of the shared platform legal-doc versions (docs/42 §6). The single
// source of truth now lives in `@sparx/legal` so api-rest + @sparx/auth can
// import the same versions the marketing pages render. Kept as a local alias
// so the page imports (`@/lib/legal-versions`) don't churn.

export * from '@sparx/legal';
