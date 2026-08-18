# 95 — Client Data Fetching (TanStack Query)

Version: 1.0.0
Author: Brandon Korous
Last Updated: 2026-06-13

This is the binding convention for fetching server data on the client. It defines
when to reach for TanStack Query (`@wizeworks/query`) and — just as importantly — when
**not** to. Read it before adding any client-side `fetch`, `useEffect`-fetch, or
`useQuery`.

## 1. The architecture this slots into

sparx is **server-first**. The default data path is:

- **Reads** → React Server Components fetch on the server (often via `@/lib/api-rest-client`).
- **Writes** → Server Actions (`'use server'`) mutate, then `revalidatePath` / `router.refresh()` re-renders.

That is a complete data architecture for the server-rendered majority of the app,
and it is **not** being replaced. TanStack Query is **additive** — it is the blessed
standard for the _client-interactive_ slice that server-first can't express well,
which we were previously hand-rolling with inconsistent `useEffect` + `fetch`.

## 2. The boundary rule (binding)

> **Server-first by default.** Page-level reads → RSC. Writes → Server Actions.
>
> Reach for TanStack Query **only** when the data is **client-owned and changes
> after load**: polling, debounced search-as-you-type, refetch-on-focus, infinite
> scroll, dependent (cascading) selects, or an optimistic cache shared across
> components.
>
> **Never** migrate a server-rendered read into `useQuery` for the sake of
> uniformity — that loses SSR streaming, pushes tenant/RLS context into client
> fetches, adds request waterfalls, and ships more JS for a worse first paint.

### Mutations

Most mutations stay server-first: call the Server Action (or `fetch`), then
`router.refresh()`. Use `useMutation` **only** when the write must update a
TanStack Query **cache** — i.e. there is a live `useQuery` to invalidate or
optimistically patch. A mutation whose only effect is `router.refresh()` of a
server-rendered view gains nothing from `useMutation`; keep it plain.

## 3. The package — `@wizeworks/query`

One import source. Feature code imports hooks from `@wizeworks/query`, never
`@tanstack/react-query` directly (the barrel re-exports the full surface).

| Entry                       | Use from               | Contents                                                                                                                                             |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@wizeworks/query`          | anywhere (RSC-safe)    | `useQuery`, `useMutation`, `keepPreviousData`, `QueryClient`, `dehydrate`, `HydrationBoundary`, … + `queryKeys`, `getQueryClient`, `makeQueryClient` |
| `@wizeworks/query/provider` | client root            | `<QueryProvider>` (carries `'use client'`; owns the browser client + devtools)                                                                       |
| `@wizeworks/query/server`   | Server Components only | `getServerQueryClient` (per-request via `cache()`), `dehydrate`, `HydrationBoundary` (`import 'server-only'`)                                        |
| `@wizeworks/query/keys`     | anywhere               | `queryKeys` factory                                                                                                                                  |

Defaults (`makeQueryClient`): `staleTime` 60s, `gcTime` 5m, `retry` 2 on queries,
`retry` 0 on mutations, refetch on focus + reconnect. The non-zero `staleTime` is
deliberate — it stops server-prefetched data refetching the instant it hydrates.

`<QueryProvider>` is mounted once in each app's root layout. The dashboard mounts
it in `apps/dashboard/app/layout.tsx`.

## 4. Query keys

Every key comes from the `queryKeys` factory in `wizeworks/packages/query/src/keys.ts` — the
single greppable registry. A query and the mutation that invalidates it MUST share
the same factory call. Never hand-write a key array at a call site.

```ts
queryKeys.search.all(term); // ['search','all',term]
queryKeys.fitment.categories(domain); // ['fitment','categories',domain]
```

## 5. SSR hydration pattern

For a `useQuery` that should arrive already-populated (no client loading flash),
prefetch on the server and hand off via `<HydrationBoundary>`:

```tsx
// page.tsx (Server Component)
import { getServerQueryClient, dehydrate, HydrationBoundary } from '@wizeworks/query/server';
import { queryKeys } from '@wizeworks/query/keys';

export default async function Page() {
  const qc = getServerQueryClient();
  await qc.prefetchQuery({ queryKey: queryKeys.foo.bar(id), queryFn: () => loadBar(id) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <ClientThatUsesUseQuery id={id} />
    </HydrationBoundary>
  );
}
```

Purely client-triggered queries (a search box, a dialog cascade, a poll) don't
need prefetch — they have no server-render to seed.

## 6. Canonical examples in the tree

- **Poll + refetch-on-focus** → `apps/dashboard/components/update-notifier.tsx` (the
  refresh-notifier; first adopter).
- **Debounced search + `keepPreviousData`** → `apps/dashboard/app/(dashboard)/_components/command-palette.tsx`.
- **Dependent / cascading queries** → `apps/dashboard/app/(dashboard)/b2b/accounts/[id]/_components/fleet-profile-editor.tsx`.

## 7. Adoption sweep — 2026-06-13

Initial holistic adoption assessed every hand-rolled client-fetch island. Outcome,
applying the boundary rule rather than migrating for uniformity:

**Migrated to TanStack Query:**

- `command-palette.tsx` — debounced deep search; deletes a manual debounce + request-token + `useEffect`, gains per-term cache, dedup, and out-of-order safety.
- `fleet-profile-editor.tsx` — 4-level fitment cascade; deletes 4 `useEffect`s + 4 `useState`s, gains caching so re-opening the dialog / re-selecting a level is instant.

**Deliberately left server-first (boundary rule):**

- `inventory/sources/.../source-form.tsx` — Server-Action create/update feeding a server-rendered list via `onSuccess`/`refresh`. No client cache to manage.
- `cms/media/upload-button.tsx` — presigned upload with **XHR progress**; `useMutation` would obscure the progress model and there's nothing to cache.
- `builder/_brand/.../brand-image-field.tsx` — presigned upload reporting the asset up via `onChange`. A one-shot side-effect, not a query.
- `b2b/invoices/[id]/.../invoice-actions.tsx` — mark-paid / write-off POSTs that `router.refresh()` a server-rendered invoice. Left as plain fetches; only the jarring `alert()` errors were upgraded to `toast`.

`fleet-profile-editor.tsx`'s save was also kept plain (it `router.refresh()`es a
server-rendered page) with `alert()` → `toast` — consistent with §2's mutation rule.

## 8. List & table data flow — decision: keep server-first

The dashboard's list/table pages (products, customers, orders, …) fetch on the
server with **URL-param-driven** filtering/sort/pagination and `revalidatePath`.
This was re-evaluated during adoption and is **deliberately retained**, not moved
to client `useQuery`, because the current approach:

- keeps filters/sort/page **shareable and bookmarkable** (they live in the URL);
- runs queries **server-side**, inside the authenticated request where RLS /
  `current_tenant_id()` context already applies — no re-plumbing into client fetches;
- streams with the page (better first paint, less JS).

Client `useQuery` pagination (e.g. `keepPreviousData` for snappier page-to-page,
infinite scroll) is a _targeted_ future upgrade for a specific high-interaction
table, not a blanket migration. When a table genuinely needs it, adopt it there and
keep the URL as the source of truth for filter state.
