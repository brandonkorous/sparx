// Server-only Builder API readers. Thin wrappers over the api-rest client used
// by the module's server components. Mutations live in actions.ts.

import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { BuilderPageDto } from '@sparx/builder-schemas';

// The tenant's pages. The list endpoint seeds the curated starter set on the
// tenant's first call (docs/41 §5), so this never returns an empty editor.
// `api.get` is cache:'no-store', so a reload is always ground-truth.
export async function listPages(): Promise<BuilderPageDto[]> {
  const { pages } = await api.get<{ pages: BuilderPageDto[] }>('/v1/builder/pages');
  return pages;
}
