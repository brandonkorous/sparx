'use client';

// Saved pieces — a design made once and placed everywhere.
//
// TWO STORES, one idea. The tenant LIBRARY (`/v1/builder/components`) is shared by
// every site the business owns; a site's OWN pieces (`/v1/builder/site/symbols`)
// belong to one site. A page refers to a library piece under the derived id
// `tenant:<key>` and to a site piece under silica's own minted id, and that colon is
// the only thing that tells them apart — so every write here routes on it rather
// than asking the caller to remember which kind it is holding.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import type { Node } from '@wizeworks/silicaui-html';
import { api } from '../api/client';
import { pieceKeyOf, tenantSymbolId } from '../../surfaces/builder/studio/saved-pieces';

/** A site-owned saved piece as the server stores it. `saved-pieces.ts` types the
 *  same shape with an `unknown` root because it only ever re-emits them; a canvas
 *  has to RENDER this one, so here it is a real node. */
export interface SiteSymbol {
  id: string;
  name: string;
  root: Node;
}

export const SITE_SYMBOLS_KEY = ['studio', 'site-symbols'] as const;
export const PIECES_KEY = ['builder', 'silica-pieces'];

/** One saved piece, whichever store it came from. */
export interface PieceRow {
  /** The SYMBOL id — `tenant:<key>` for a library piece, a minted id for a site one. */
  id: string;
  name: string;
  root: Node;
  /** True when the master is shared with every other site this business owns. */
  shared: boolean;
}

/** The site's own pieces. The tenant library is read by `useSilicaPieces`. */
export function useSiteSymbols() {
  return useQuery({
    queryKey: SITE_SYMBOLS_KEY,
    queryFn: () =>
      api
        .get<{ symbols: Record<string, SiteSymbol> }>('/v1/builder/site/symbols')
        .then((r) => r.symbols)
        // A failed read means the canvas cannot draw site-owned pieces. Degrading to
        // an empty map is wrong here — it would render them as deleted — so this is
        // left to fail and the pane reports it.
        .catch(() => {
          throw new Error('Your saved pieces could not be loaded. Reload to try again.');
        }),
    staleTime: 30_000,
  });
}

/** Save one piece's master, to whichever store owns it. */
export function useSavePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string; root: Node }) => {
      const key = pieceKeyOf(input.id);
      if (key) {
        await api.patch<unknown>(`/v1/builder/components/${encodeURIComponent(key)}`, {
          name: input.name,
          silicaTree: input.root,
        });
        return;
      }
      await api.put<unknown>(`/v1/builder/site/symbols/${encodeURIComponent(input.id)}`, {
        name: input.name,
        root: input.root,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PIECES_KEY });
      void queryClient.invalidateQueries({ queryKey: SITE_SYMBOLS_KEY });
    },
  });
}

/** One place a piece is used, named the way an author would name it. */
export interface PiecePlacement {
  ownerKind: 'page' | 'layout' | 'symbol';
  ownerId: string;
  label: string;
  count: number;
}

/**
 * Where a piece is placed.
 *
 * Read on demand rather than with the list: it is only ever needed at the moment
 * someone reaches for Delete, and asking for every piece's placements up front
 * would be a query per piece to answer a question nobody asked.
 */
export function fetchPiecePlacements(symbolId: string): Promise<PiecePlacement[]> {
  return api.get<PiecePlacement[]>(
    `/v1/builder/site/symbols/${encodeURIComponent(symbolId)}/usages`
  );
}

/**
 * Delete a piece.
 *
 * Every placement DETACHES rather than disappearing: the design stays on the page
 * and simply stops following a master. That is silica's own behaviour and the honest
 * one — deleting a master should not delete work from pages nobody was looking at.
 */
export function useDeletePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const key = pieceKeyOf(id);
      if (key) {
        await api.delete(`/v1/builder/components/${encodeURIComponent(key)}`);
        return;
      }
      await api.delete(`/v1/builder/site/symbols/${encodeURIComponent(id)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PIECES_KEY });
      void queryClient.invalidateQueries({ queryKey: SITE_SYMBOLS_KEY });
    },
  });
}

/**
 * Make a new piece out of a design.
 *
 * It goes to the tenant library, not to this site — a business that builds a "call
 * us" band on one site almost always wants it on the next one too, and moving a
 * piece between stores later is not something the console offers.
 */
export function useCreatePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; root: Node }) => {
      const key = pieceKey(input.name);
      await api.post<unknown>('/v1/builder/components', {
        key,
        name: input.name,
        // `content` is the catch-all of the three the schema allows. The console does
        // not ask an author to file their own design under a taxonomy they never see.
        group: 'content',
        icon: 'box',
        surfaces: ['page', 'site'],
        silicaTree: input.root,
      });
      return { id: tenantSymbolId(key), name: input.name, root: input.root, shared: true };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PIECES_KEY });
    },
  });
}

/** A stable library key from a name, with enough entropy that two pieces called
 *  "Contact" from two sites do not collide into one master. */
function pieceKey(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'piece';
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}
