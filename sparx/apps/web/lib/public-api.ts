// The marketing site's one way to read a public api-rest path.
//
// "Not there" and "could not ask" are different answers: a missing listing is a
// 404, but an unreachable api-rest must not become one (a live listing answered
// 404 to a visitor on 2026-10-19). So `getPublic` returns null only when api-rest
// says no, and throws when it does not answer, which keeps the last good ISR page.
// Server-only: it reads `process.env`.

import { readPublicData } from '@wizeworks/app-kit/public-api';

export { orWhenUnavailable } from '@wizeworks/app-kit/public-api';

// In-cluster api-rest URL (k8s/apps/site.yaml injects SPARX_API_REST_URL); the
// public routes need no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

/** The data at a public path, or null when api-rest says there is none. */
export function getPublic<T>(path: string, revalidate = 300): Promise<T | null> {
  return readPublicData<T>(`${API_BASE}${path}`, { revalidate });
}
