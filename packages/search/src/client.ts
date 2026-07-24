// Typesense client factory. Reads connection config from env so the
// indexer worker, api-rest, and dashboard ⌘K palette all reach the same
// cluster the same way.

import { Client } from 'typesense';

export interface TypesenseConfig {
  /** Host (or comma-separated host list). Defaults to `typesense` — the
   *  in-cluster Service name when running on GKE. */
  nodes: { host: string; port: number; protocol: 'http' | 'https' }[];
  apiKey: string;
  connectionTimeoutSeconds?: number;
}

/** Empty / whitespace env → undefined, so a `?? default` actually fires (an empty
 *  string is not nullish, so `'' ?? x` yields `''`). */
function cleanEnv(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

/**
 * Resolve the Typesense port defensively.
 *
 * Kubernetes auto-injects `TYPESENSE_PORT=tcp://<clusterIP>:<port>` for the
 * in-cluster Service named `typesense` (the Docker-legacy "service links"), which
 * SHADOWS the numeric port the app expects. Because that string isn't nullish, the
 * old `Number(process.env.TYPESENSE_PORT ?? 8108)` produced `NaN` and every search
 * built an `http://typesense:null/...` URL → 500 on the whole storefront `/shop`
 * PLP and the ⌘K palette. Accept ONLY a clean positive integer; the `tcp://…`
 * string / empty / NaN all fall back to Typesense's default 8108.
 */
export function resolveTypesensePort(raw: string | undefined = process.env.TYPESENSE_PORT): number {
  const n = Number(cleanEnv(raw));
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8108;
}

/** Host, guarding against the same service-link `tcp://…` shape for safety
 *  (k8s injects it on `TYPESENSE_PORT`, but be defensive). Defaults to the
 *  in-cluster Service name. */
export function resolveTypesenseHost(raw: string | undefined = process.env.TYPESENSE_HOST): string {
  const host = cleanEnv(raw);
  return host && !host.includes('://') ? host : 'typesense';
}

/** Protocol — only `https` opts out of the in-cluster default `http` (an empty
 *  `TYPESENSE_PROTOCOL` must not become an invalid protocol). */
export function resolveTypesenseProtocol(
  raw: string | undefined = process.env.TYPESENSE_PROTOCOL
): 'http' | 'https' {
  return cleanEnv(raw) === 'https' ? 'https' : 'http';
}

export function configFromEnv(): TypesenseConfig {
  const apiKey = process.env.TYPESENSE_API_KEY;
  if (!apiKey) {
    throw new Error('TYPESENSE_API_KEY env var is required');
  }
  return {
    nodes: [
      {
        host: resolveTypesenseHost(),
        port: resolveTypesensePort(),
        protocol: resolveTypesenseProtocol(),
      },
    ],
    apiKey,
    connectionTimeoutSeconds: Number(cleanEnv(process.env.TYPESENSE_TIMEOUT_SECONDS) ?? 5),
  };
}

let cached: Client | null = null;

export function getClient(config?: TypesenseConfig): Client {
  if (cached && !config) return cached;
  const resolved = config ?? configFromEnv();
  const client = new Client({
    nodes: resolved.nodes,
    apiKey: resolved.apiKey,
    connectionTimeoutSeconds: resolved.connectionTimeoutSeconds ?? 5,
  });
  if (!config) cached = client;
  return client;
}

/** Test-only: reset the cached client between cases. */
export function _resetClientForTest(): void {
  cached = null;
}
