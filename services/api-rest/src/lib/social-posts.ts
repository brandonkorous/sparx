// MOVED to @sparx/social (docs/133) — the social post service now lives in the
// shared package so every transport (REST + MCP) drives ONE implementation
// (API-first / one service, many transports). This file is a thin re-export so
// existing api-rest importers keep their `./social-posts.js` path unchanged.

export * from '@sparx/social/service';
