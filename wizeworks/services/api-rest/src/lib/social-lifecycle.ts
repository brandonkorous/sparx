// MOVED to @wizeworks/social (docs/133) — the social post lifecycle service now lives
// in the shared package so every transport (REST + MCP) drives ONE implementation.
// Thin re-export so existing api-rest importers keep their `./social-lifecycle.js`
// path unchanged (including the `readRequireApproval` unit test).

export * from '@wizeworks/social/service';
