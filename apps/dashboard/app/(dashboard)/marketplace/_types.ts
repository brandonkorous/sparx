// Shared marketplace catalog types (docs/60). Kept in a plain module (NOT the
// 'use server' actions file, which may only export async functions) so both server
// pages and client components can import them.

export interface CatalogContents {
  products: number;
  categories: number;
  collections: number;
  content: number;
  pages: number;
  emails: number;
  components: number;
  theme: string;
  hasLayout: boolean;
}

export interface CatalogInstall {
  id: string;
  status: string;
  version: string;
  update_available: boolean;
}

/** A catalog row — identity + counts + this tenant's install state. */
export interface CatalogItem {
  key: string;
  version: string;
  name: string;
  summary: string;
  vertical: string;
  preview?: string;
  requiresModules: string[];
  contents: CatalogContents;
  install: CatalogInstall | null;
}

export interface BrowseFacets {
  vertical: Record<string, number>;
  modules: Record<string, number>;
  status: { installed: number; available: number };
}

/** The faceted, paged browse response (docs/60 §6). */
export interface BrowseResponse {
  items: CatalogItem[];
  total: number;
  facets: BrowseFacets;
  next_cursor: string | null;
}
