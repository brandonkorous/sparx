# 126 — Builder op protocol: granular edits, real collaboration, immutable publish

Version: 1.6.0
Author: Brandon Korous
Last Updated: 2026-07-20

> **1.6.0 — Phase 4 SHIPPED: multi-editor is ON.** The realtime relay is live on a
> `/ws/builder` socket.io namespace (a second server beside `/ws/chat`, same Redis
> fan-out). Persistence still rides the HTTP sync PUT (Phase 2); after ops persist, the
> route broadcasts them to the site's room, and every other editor applies them through
> the engine's `applyRemoteOps` — echo-suppressed by `batchId`. Presence (who is editing
> and which page, a silicaui `AvatarGroup` in the toolbar) and reconnect **catch-up**
> (the client asks "I'm at seq N, what did I miss?" → `opsSince`) both work. The studio
> acks the load-time seq into the engine so `baseSeq` starts aligned. Verified with a
> two-live-client smoke test against the real DB (auth, forged-token reject, presence
> join/leave/where, op relay, catch-up — 8/8). **The last remaining refinement is
> soft-subtree claim** (deferred — LWW + presence already make concurrent edits correct
> and visible; claim is a nicety, §6). **Every phase of docs/126 is now shipped.**
>
> **1.5.0 — silicaui 0.30 landed; Phases 2 & 3 SHIPPED (host side).** The engine now
> emits `onChange(site, ops, meta)` with causal-ordered ops + `meta.baseSeq`, mints
> fractional `ord` keys on nodes, and takes remote ops via the `BuilderHandle` ref
> (`applyRemoteOps`/`replaceState`/`ackSeq`). **Phase 2 (host):** an append-only op
> log — `builder_page_ops`, migration `20261221000000_builder_page_ops` — recorded in
> the same transaction as the snapshot; the studio buffers ops per debounce, sends
> them with the sync, and `ackSeq`s the returned seq. **One correction from building
> against the real API:** seq is **per-property, not per-page** (§5, §5.6) — the
> engine's `baseSeq` is document-wide, so a per-page seq (the original sketch) could
> not answer the reconnect question. **Phase 3 (`ord`) needs nothing host-side** — the
> engine mints `ord` onto nodes and our `looseObject` tree schema round-trips it
> verbatim (§3.1). **Only Phase 4 (the realtime relay) remains**, and it now has its
> substrate: the seq'd op log the relay reads to catch a reconnecting client up.
>
> **1.4.0 — Phase 5 UI shipped; retention decided.** The publish-history drawer and
> restore are live in the studio, and product deletion now warns which pages pin the
> record (§5.4 put to work). The node index is backfilled on publish, not only on
> sync, so a never-since-edited page is no longer invisible to where-used, and
> where-used answers now carry author-facing names. **Artifact retention is DECIDED:
> a 30-day rolling window with the live release always kept (§5.3.1, §9.4); the
> pruner is specified but deferred until storage warrants it.** Only Phases 2–4
> remain, all with silicaui.
>
> **1.3.0 — Phase 5 is SHIPPED.** Every publish now writes immutable,
> content-addressed artifacts and seals a release (§5.3), so publishing is
> reversible for the first time: `GET /v1/builder/site/releases` is the history and
> `POST /v1/builder/site/releases/:id/restore` republishes a prior manifest forward
> as a new release. Migration `20261220000000_builder_publish_artifacts`
> (`builder_page_artifacts` + `builder_releases`). The publish event now carries
> `{ releaseId, hash }`, and the Pub/Sub publisher was already wired in api-rest —
> `cache-revalidation-worker` consumes `builder.*` today.
>
> **1.2.0 — Phase 0, 1 and 6 are SHIPPED.** Per-page diffing (`pageIds` roster),
> the `pageUpdatedAt` precondition, and the derived node index (§5.4) with its
> where-used queries are live; `builder_node_index` is migration
> `20261214000000_builder_node_index`.
>
> **1.1.0 — revised against the silicaui engine review.** The op vocabulary was
> incomplete (seven gaps, §2.2/§2.3), the `ord` sidecar decision was **reversed**
> (§3.1), symbol deletion needs explicit cascade discipline or it silently corrupts
> (§2.6), and the engine imposes real constraints on remote-op application (§6.2).
> Sequencing in §10 now interlocks with the engine's own phases.

> **What this is.** The specification for replacing the builder's whole-site-replace
> write model with a semantic operation protocol, and the storage lifecycle that sits
> behind it. It resolves §3, §4, §5, §6 and §7 of
> [125-site-data-architecture-critical-issues.md](125-site-data-architecture-critical-issues.md).
>
> **Read-path remediation is a separate track** — see
> [127-site-read-path-remediation.md](127-site-read-path-remediation.md). The two share
> no dependency and should run in parallel; 127 is days of work, this is quarters.
>
> **Scope note.** This changes the `@wizeworks/silicaui` `<Builder>` host contract.
> We own silica, so that is a spec decision rather than a constraint — but it is the
> long pole, and §10 sequences everything so the host work is not blocked on it.

---

## 1. The decision, and why it is not Notion

The originating question was whether to adopt a Notion-style block-per-row model. Notion's design bundles four separable properties:

1. **Granular writes** — write only what changed
2. **Per-entity versioning** — real concurrency detection and history
3. **Recursive / partial reads** — load a subtree, not a document
4. **Blocks as addressable entities** — references, backlinks, where-used

We want 1, 2 and 4. **We explicitly do not want 3**, and it is structurally load-bearing in Notion's design.

Notion optimizes for a document edited constantly by several people and too large to load at once. A site render is the opposite shape: the renderer needs the **entire** page tree, **every** time, and reads outnumber writes by orders of magnitude. That is the ideal case for a single materialized blob — one row, one fetch, no join, no assembly.

The read problems in 125 §8 are not caused by the blob. They are caused by `findMany` with no `select` and a `no-store` cache policy. Moving to block-rows without fixing those replaces "24 MB of the wrong rows" with "a recursive CTE over tens of thousands of rows, still uncached."

**So: granular on the write side, materialized on the read side.**

### 1.1 Why not OT, and why not a CRDT

Notion needs operational transform because **text interleaves** — two people typing in one paragraph produce character-level conflicts that must be transformed, not merged. A node tree does not interleave. Two authors work on different sections; the conflict rate on a single node is near zero.

What we want is what design tools actually use:

- **Per-node last-write-wins** — blast radius is one node's props, and that is comprehensible to a non-technical author
- **Fractional indexing** for ordering — concurrent inserts never collide
- **Server-side cycle rejection** on move — the one genuinely unsafe concurrent op
- **Presence and soft subtree claim** — prevent conflicts socially, which is the right layer

Tree CRDTs are a real research area with a known hard case (the concurrent-move paradox), and OT needs a central transform server plus a correctness proof per op pair. Neither is warranted by our conflict profile.

### 1.2 The property that makes this work

Because ops are **semantic**, **addressed by node id** (not by array index), and **ordered by fractional key**, they _commute_ in nearly all cases. Two authors editing different nodes produce op batches that can be applied in either order with the same result — no transform step, no rebase logic.

That is the whole design. Everything below follows from it.

---

## 2. The op vocabulary

### 2.1 Envelope

```ts
interface OpBatch {
  /** Sequence number the client's state was built from. */
  baseSeq: number;
  /** Client-generated, for idempotent retry. */
  batchId: string;
  ops: Op[];
}

interface Op {
  target: OpTarget;
  kind: OpKind;
  /* ...kind-specific fields */
}

type OpTarget =
  | { scope: 'page'; id: string } // BuilderPage row id
  | { scope: 'frame'; id: string } // BuilderLayout row id
  | { scope: 'symbol'; id: string } // symbol key
  | { scope: 'site' }; // theme, saved themes, page collection
```

A single `target` covers page bodies, site chrome, and symbol definitions because all three are node trees. The `site` scope carries the operations that are not tree edits.

### 2.2 Tree ops

| Kind               | Fields                                       | Notes                                                                |
| ------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| `node.insert`      | `parentId, ord, node`                        | `node` is a full subtree; all ids pre-minted client-side             |
| `node.remove`      | `nodeId`                                     | Removes the subtree                                                  |
| `node.move`        | `nodeId, parentId, ord`                      | Cycle-checked server-side                                            |
| `node.setProps`    | `nodeId, patch`                              | **Component props only.** Shallow merge; `null` deletes the key      |
| `node.setAttrs`    | `nodeId, patch`                              | **Element HTML attributes only.** Shallow merge; `null` deletes      |
| `node.setText`     | `nodeId, text`                               | Text child of `nodeId`. See §2.5 — this is the interleaving boundary |
| `node.setTag`      | `nodeId, tag`                                | Retag `div`→`section`                                                |
| `node.setClass`    | `nodeId, class`                              | Whole-string replace                                                 |
| `node.setBinding`  | `nodeId, binding \| null`                    |                                                                      |
| `node.setBehavior` | `nodeId, marker \| null`                     | Behavior root marker; vanilla-output hydration depends on it         |
| `node.setLocked`   | `nodeId, owner: 'host' \| 'author' \| null`  | Two-tier lock; **must replicate** — see below                        |
| `node.setOverride` | `instanceId, masterNodeId, override \| null` | Two node ids, two trees                                              |
| `node.rename`      | `nodeId, name \| null`                       | Author-facing label only                                             |

**`props` and `attrs` are separate namespaces, not one bag.** The engine's `Node` keeps element attributes, component props, and system metadata in distinct slots so they cannot collide — an element node has no `props`, a component node has no `attrs`. Collapsing them into one `setProps` loses that distinction. Both shallow-merge for the same reason: two authors changing different keys on the same node commute, which is the common case when one is editing copy and the other is swapping an image.

**`node.setLocked` must replicate.** A host lock is how a region gets pinned. If it does not travel, one author sees a pinned section that another can freely edit — which is worse than no locking, because the pin reads as a guarantee.

**`node.setOverride` cannot be expressed as `setProps`.** Symbol instances carry per-instance overrides keyed by the _master's_ node id, living in a different tree. The op carries two ids by necessity.

### 2.3 Page and site ops

| Kind                | Fields                       |
| ------------------- | ---------------------------- |
| `page.create`       | `pageId, name, slug, root`   |
| `page.delete`       | `pageId`                     |
| `page.rename`       | `pageId, name`               |
| `page.setSlug`      | `pageId, slug`               |
| `page.reorder`      | `pageId, ord`                |
| `frame.setEditable` | `editable`                   |
| `symbol.set`        | `key, tree`                  |
| `symbol.delete`     | `key` (+ cascade — see §2.6) |
| `theme.set`         | `theme`                      |
| `savedThemes.set`   | `themes`                     |

### 2.3.1 What stays host-side, and the history gap it creates

The engine's `Page` is deliberately flat — `{ id, name, slug, root }`. Everything else sparx keeps on `builder_pages` is **host-owned domain data the engine does not model**:

- **SEO** (`seoTitle`, `seoDescription`, `canonical`, `ogImage`, `noindex`) — DB columns, edited in a panel, never a canvas mutation. `page.setSeo` is dropped; there is nothing in the engine to write to.
- **`kind` / `recordType` / `isDefault`** — the collection-template model. Already applied host-side in a second pass after reconcile ([site-service.ts:853-879](../packages/builder/src/services/site-service.ts#L853)).

**`page.setDefault` is dropped from the op vocabulary but is NOT redundant with `page.reorder`.** The engine review proposed dropping it on the grounds that "`pages[0]` is the default," which is true for a home page and wrong for sparx: `isDefault` is scoped _per record type_ — a partial unique on `(tenant, property, record_type) WHERE is_default` — answering "which template renders product pages," not "which page is home." Position cannot express it. It stays a host-side mutation with its own endpoint and its own `updateMany`-then-promote guard.

**The consequence, which is a real decision (§9.6):** the op log is a complete history of the _tree_, not of the _page_. Restoring a page to last Tuesday restores its content and not its SEO fields. Host-side mutations need their own audit rows, and any "page history" surface reconstructs from both streams.

### 2.3.2 The home-page invariant is ours to enforce

Home resolves by **empty normalized slug**, not position:

```ts
// packages/builder/src/services/site-service.ts:221
const row = pages.filter(isSilicaPublished).find((r) => normalizeSlug(r.slug) === '');
```

**Collision is impossible by construction** — the engine's slugify maps `""` → `"/"`, and both its add-page and set-slug paths de-dupe, so there can never be two homes.

**Orphaning is entirely possible.** Nothing guarantees there is _one_. An author renaming the home page to `/about` produces a legal `Site` with zero empty-slug pages, and `getPublishedHome` returns `null` — the site's front page stops existing. Under the ops contract that arrives as an ordinary `page.setSlug`, indistinguishable from any other slug edit.

**This is enforced host-side, in the apply path, not in the engine.** "Home" is a sparx concept; a `Site` with no `/` page is legitimate for another host. Putting the invariant in the engine is the same overreach as putting `isDefault` on `Page`. We already reject slug collisions at apply (§4.1) — "would leave no `/`" is the same check in the same place.

**Two ops can orphan, not one.** The engine review identified `page.setSlug`. **`page.delete` of the home page has identical effect** and needs the same guard. `page.create` and `page.reorder` cannot orphan.

**Validate against server state, not against a client-supplied roster.** The engine offered to carry the full slug roster on `page.setSlug` so the host need not reconstruct it. Declining: under concurrent edit a client's roster is by definition possibly stale — `baseSeq < currentSeq` means another author may have changed a slug the sender has not seen — so validating against it produces both false rejections and missed ones. **Ops carry intent; context is the server's job.** `page.setSlug` stays `{ pageId, slug }`.

**Product gap this exposes.** "Home" being an _implicit consequence of a slug value_ is a developer concept. A non-technical author renaming their front page has no reason to expect it to be special, and a rejection — however well worded — is a dead end unless they can act on it. The builder should carry an explicit **"Make this the home page"** action that moves the `/` slug atomically, so home is something an author _sets_ rather than something they infer. That is host UI work, not protocol work, but it is the thing that makes the invariant humane rather than merely correct.

### 2.4 The escape hatch

```
site.replace { pages, frame, symbols, theme, savedThemes }
```

If the editor performs a mutation the vocabulary cannot express, it emits `site.replace` — semantically identical to today's whole-site PUT. This is **required**, not optional: it guarantees the protocol can never block a product capability, and it makes the migration in §10 strictly additive.

`site.replace` is subject to the existing `wouldClobberSite` guard ([site-service.ts:299](../packages/builder/src/services/site-service.ts#L299)) and is logged with a distinct audit action so its frequency is measurable. **A rising `site.replace` rate is the signal that the vocabulary has a gap.**

### 2.5 `node.setText` and the honest limit of "trees don't interleave"

§1.1 argues that a node tree does not interleave the way text does, and therefore needs no transform layer. That is true of the **tree**. It is not true of the **text inside it**.

In the engine's schema `Child = Node | string`. Text children are bare strings with **no id**. An id-addressed vocabulary structurally cannot reach them, so `node.setText` addresses the _parent_ and replaces its text wholesale — on an element, the whole children array; on a component, `props.label` / `props.text`.

**That makes body copy last-write-wins at paragraph granularity.** Two authors editing the same paragraph: one loses their entire paragraph, not a merged result.

We are accepting this, deliberately. The alternative is a text CRDT, which is a large, subtle subsystem justified only when concurrent same-paragraph editing is a normal workflow rather than an accident. In a page builder it is an accident — authors work in different sections. The mitigations are social, not algorithmic:

- presence and soft claim (§4.2) at the text-node level, so the collision is visible _before_ it happens
- the claim indicator must be legible in the canvas, not only in a layers panel

If concurrent same-paragraph editing turns out to be common in practice, revisit — the op boundary is drawn such that a text CRDT could later slot in behind `node.setText` without changing any other op.

### 2.6 `symbol.delete` is a cascade, and a naive replay corrupts

Deleting a symbol **detaches every instance** — across every page and every other master — into freshly stamped clones. Ids are minted **at detach time**.

So replaying a bare `symbol.delete` on another client re-mints _different_ ids for the same content. The two clients then hold trees that render identically and disagree on every id in the detached subtrees — which desynchronizes React keys, dnd-kit sortable ids, subsequent id-addressed ops, and the persisted tree.

**This is the one place in the protocol where a naive implementation silently corrupts rather than visibly failing.**

The fix is emission discipline, not another op. The engine emits the cascade explicitly:

```
symbol.delete { key }
node.remove   { nodeId: instanceId }        ┐ one pair per instance,
node.insert   { parentId, ord, node }       ┘ carrying the PRE-MINTED subtree
```

in causal order, in one batch. The receiving client applies the minted ids rather than deriving its own. This is §6.2 requirement 2 (causal ordering) doing real work rather than being a formality.

The same hazard applies to **`createSymbol`** (replaces a node in place with an instance) and **`detachInstance`** — both mint ids as a side effect. Same discipline.

### 2.7 Governing rule: ops carry intent; context is the server's job

An op carries **what the receiver cannot derive**, and nothing else. It does not carry ambient state for the receiver's convenience.

The rule came out of declining a proposal to ship the full page-slug roster on `page.setSlug` so the host could validate the home-page invariant without reading its own state (§2.3.2). Under concurrent edit a sender's roster is stale **by construction** — `baseSeq < currentSeq` means another author may have changed a slug the sender has not seen — so validating against it produces both false rejections and missed ones. Server state is authoritative and cheap.

**The one principled exception is randomly-minted content.** `node.insert` carries a full subtree; the `symbol.delete` cascade (§2.6) carries the replacement subtrees. That is not ambient context — it is content the receiver **cannot** derive, because node ids are `crypto.randomUUID()` minted on whichever client created them. A peer replaying "detach every instance" independently would mint _different_ ids for identical content, and the two documents would diverge while looking identical on screen.

So the test is sharp, and it is about derivability rather than payload size:

> **Anything randomly minted must travel. Anything computable must not.**

This subsumes the other id-minting mutations rather than adding to the exception list. `createSymbol` (replaces a node in place with an instance) and `detachInstance` both mint ids as a side effect, and both express that through the ops that already carry minted subtrees — they are compositions of the `node.insert` exception, not new ones.

### 2.8 Invertibility — thin on the wire, fat in the log

Every op must have an inverse computable from the pre-state at apply time.

| Op                | Inverse                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `node.insert`     | `node.remove { nodeId }`                                                                    |
| `node.remove`     | `node.insert { parentId, ord, node }` — captured subtree                                    |
| `node.move`       | `node.move { nodeId, prevParentId, prevOrd }`                                               |
| `node.setProps`   | `node.setProps { nodeId, inversePatch }` — prior values, `null` for keys that did not exist |
| `node.setClass`   | `node.setClass { nodeId, prevClass }`                                                       |
| `node.setBinding` | `node.setBinding { nodeId, prevBinding }`                                                   |
| `page.delete`     | `page.create` with the full captured page                                                   |

**The client sends intent; the server computes and persists the inverse.** The wire payload stays small (a prop change is a few hundred bytes) while the log carries everything needed for undo, redo, and history reconstruction.

This is what makes 125 §6 fall out for free: the op log _is_ the revision history, and it is richer than `ContentRevision` because it records intent and actor per change rather than a periodic snapshot.

---

## 3. Ordering: fractional indexing

Children are ordered by a **fractional index string** (`ord`), not by array position.

- Insert between neighbors `a` and `b` → `generateKeyBetween(a.ord, b.ord)`
- Insert at head → `generateKeyBetween(null, first.ord)`
- Insert at tail → `generateKeyBetween(last.ord, null)`
- Move is `node.move` with a newly generated `ord`; the node row is the only thing touched

The client computes `ord` because it holds the neighbors. The server validates ordering and monotonicity but does not generate.

**Tiebreak.** Two clients can generate the same key between the same neighbors. Resolve deterministically by `(ord, actorId)` — stable across replicas, no coordination.

**This is strictly better than Notion's model here.** Notion stores an ordered `content: [id, id, id]` array on the parent, so two concurrent inserts both rewrite the parent row and contend. Fractional indices make an insert touch only the inserted node.

### 3.1 Where `ord` lives — ON the node

> **Reversed in 1.1.0.** The original spec put `ord` in a sidecar map to keep the node
> type "a pure render concern." The engine review disqualified that, correctly, on three
> counts. Recording the reasoning because the instinct was reasonable and the premise
> was simply false.

```ts
// authoring-metadata band, alongside label / slot / locked / instanceOf / overrides
ord?: string;
```

Why the sidecar fails:

1. **Text children have no id.** `Child = Node | string`, so a `Record<nodeId, string>` cannot express the position of a bare string among its siblings. The map would order _some_ children and not others, which means the `children` array remains the real order — two sources of truth that can disagree. This alone is disqualifying.
2. **Every engine read path is a subtree clone.** `extract()`, `extractSite()`, `duplicate()`, `copy()`, and symbol expansion all move subtrees as self-contained values across ~9 stamp sites. Symbol expansion re-mints ids **on every render**, so a sidecar would need re-keying per frame, not per edit. A parallel structure that must be carried, filtered, and re-keyed at nine call sites is a structure guaranteed to drift silently.
3. **The purity premise was false.** `Node` already carries `label`, `slot`, `locked`, `instanceOf`, and `overrides` — authoring metadata that every projection ignores and that is stripped at publish. `ord` is that same category, and the strip point already exists.

The `children` array stays the render order. `ord` is the **merge key**: any mutation sorts siblings by `ord` before rendering, and publish strips it with the rest of the authoring band.

### 3.2 The cost this does carry

Move is index-based in the engine today, with same-parent shift arithmetic, and the drop-target math in both the canvas and the layers navigator is `(parentId, index)` throughout. Fractional indices are the right fix, but converting means touching the drag-and-drop plumbing in three places — not just the op payload. It gets its own phase in §10 for that reason.

---

## 4. Concurrency

### 4.1 Apply protocol

Client sends `{ baseSeq, batchId, ops }`. Server, inside one transaction:

1. **Idempotency** — if `batchId` is already applied, return the recorded result. Covers retry after a network failure.
2. **`baseSeq == currentSeq`** — fast path. Apply, append, return `newSeq`, broadcast.
3. **`baseSeq < currentSeq`** — intervening ops exist. **Apply anyway**, per §1.2, with three exceptions:
   - an op targeting a node removed by an intervening op is **dropped silently** (legitimate concurrent-delete race; last delete wins)
   - `node.move` that would create a cycle is **rejected**
   - `page.setSlug` colliding with an existing slug is **rejected**

   Return `{ newSeq, applied[], dropped[], rejected[], catchUp: Op[] }` so the client reconciles.

4. **`baseSeq > currentSeq`** — impossible; client is ahead of the server. Force full resync and log it as a bug.

Rejections surface to the author in plain language. `page.setSlug` collision is the only one a non-technical author can act on, and it must say so — "Another page already uses /about", not an error code.

### 4.2 Presence and soft claim

Reuse the **existing socket.io server with Redis adapter in `api-rest`** (docs/56 live chat, docs/96 product activity). A new `/builder` namespace, rooms keyed by `propertyId`. No new infrastructure.

- **Presence** — actor id, display name, assigned color, current selection `nodeId`
- **Soft claim** — selecting a node claims its subtree for 30s, renewed on activity
- Claims are **advisory**. They render as "Sam is editing this section," never as a hard block.

Hard locks frustrate authors and produce stuck-lock support load. The claim exists to prevent collisions socially, which is where the actual conflict rate drops to near zero.

### 4.3 What an author sees

Per [feedback_non_technical_audience], none of the above surfaces as jargon:

- avatars on the section someone else is in
- "Sam is editing this section" on hover
- on a dropped op: "Sam deleted this section while you were editing it."
- on a rejected slug: "Another page already uses /about."

No sequence numbers, no conflict dialogs, no merge UI.

---

## 5. Storage lifecycle

```
builder_page_ops        append-only  (property_id, seq, batch_id, actor_id, owner_kind, owner_id, op_kind, op)  SHIPPED
builder_page_snapshot   materialized  — NOT built; silica_draft_tree IS the snapshot for now (§5.5)
builder_page_artifacts  immutable    (property_id, owner_kind, owner_id, hash, tree, created_at)                SHIPPED
builder_releases        append-only  (property_id, hash, manifest, page_count, source, actor_id)               SHIPPED
builder_node_index      derived      (owner_kind, owner_id, node_id, type, symbol_id, binding_*)               SHIPPED
```

The op log's key differs from the original sketch above in two ways learned from building against silicaui 0.30 (§5.6): **seq is per-property, not per-page**, and there is **no `inverse` column** — the engine owns undo (its own snapshot stack, or a host `HistoryDelegate` in a shared session), so the host does not store inverse ops to replay undo itself.

### 5.1 Draft read

`snapshot.tree` + replay of `ops WHERE seq > snapshot.seq`. Bounded by the compaction threshold, so replay cost is constant.

### 5.2 Compaction

Materialize a new snapshot when either: 200 ops have accumulated since the last one, or a publish occurs. Ops are **retained**, not pruned — they are the history, they are small, and retention policy is a product decision (§9) rather than a storage necessity.

### 5.3 Publish → immutable artifact — **SHIPPED**

Publish content-addresses each part of the silica `Site` and inserts it. **Artifacts are never updated, only inserted.** The property points at a hash.

This is what resolves 125 §7 and unblocks 125 §8:

- **the hash is the cache key** — CDN-cacheable, and the surface-CSS class-set hash ([surface-css-service.ts:118](../packages/builder/src/services/surface-css-service.ts#L118)) is computed once at publish instead of on every storefront request
- **rollback is republishing a prior manifest** — no data movement
- **artifact creation is a real event** with a real payload, giving SEO audit, search indexing, and cache purge a correct place to hang instead of the current dead-path wiring

`builder.page.published` now carries `{ propertyId, scope, pages, releaseId, hash }`, the Pub/Sub publisher is installed in api-rest ([index.ts](../services/api-rest/src/index.ts)), and `cache-revalidation-worker` maps `builder.*` to its own `builder:` scope.

**The release, not the page, is the restorable unit.** Two implementation decisions that departed from the sketch above, both for the same reason — the parts of a site are coupled:

1. **`builder_releases` sits above the artifacts.** `publish()` is atomic across pages, chrome, theme and symbols. Rolling one page back to yesterday while the symbols stay at today reproduces exactly the corruption the artifact table exists to prevent, so a restore reinstates a whole manifest. A per-page pointer column would have invited the broken operation.
2. **A restore publishes FORWARD as a new release**, tagged `source='restore'` with `restoredFromId`. History is append-only, so undoing is itself auditable and itself undoable. Nothing in the service deletes a release.

Two consequences of (1) worth naming, both surfaced in the restore result rather than left to be discovered: a page created _after_ the restored release gets **unpublished** (its draft untouched — leaving it live would produce a site that never existed), and a manifest entry whose page was **deleted since** is skipped rather than resurrected.

**Content addressing is canonical-JSON, not `JSON.stringify`.** Postgres JSONB does not preserve object key order — `{kind, tag}` comes back as `{tag, kind}`, verified against the database. Hashing the raw stringification would therefore give a round-tripped tree a different address than the one just authored, and every publish would store a fresh copy of every unchanged page while the history showed edits that never happened. `canonicalJson` sorts keys at every depth (array order is document order and is preserved). This is what makes republishing cheap: storage grows with what **changed**, not with how often Publish was pressed.

The artifact tables run **parallel** to `silica_published_tree` — the storefront still reads the columns, both are written in one transaction so they cannot disagree, and Phase 6 flips reads onto the artifacts and drops the columns (§5.5).

### 5.3.1 Retention — a 30-day window, deferred pruner

Publish history is not kept forever. The policy (§9 decision 4) is a **30-day rolling window** with one hard floor: **the currently-live release is never pruned**, regardless of age.

The pruner is **not yet built** — the tables are append-only and nothing enforces the window today. Content-addressing keeps storage growth tied to what _changed_, not to publish frequency, so there is no forcing function yet. When one appears, the pruner is a scheduled tick with two ordered steps:

1. **Delete stale releases.** `builder_releases` older than 30 days, EXCEPT the newest release per property (the live one — identified as the max `created_at`, which is what the storefront serves). Restore-created releases are ordinary releases here; a rollback older than 30 days is as prunable as any other.
2. **GC orphaned artifacts.** A `builder_page_artifacts` row is deletable once **no surviving release's manifest names its `(owner_kind, owner_id, hash)`**. This is the step that must run second and must be exact: artifacts are shared across releases by content address, so a hash an old release used may still be the live one. Deleting an artifact a surviving manifest points at would make that release unrestorable — the one thing this whole subsystem exists to prevent.

Both steps are per-tenant under RLS (the pruner sets `app.tenant_id` per tenant, like any FORCE-RLS batch job). Neither touches `silica_published_tree`, so pruning history can never affect what renders.

### 5.4 The derived node index

The one thing block-per-row would give natively and this design must build. Maintained on op apply, which is cheap because the apply step already knows which nodes changed.

It buys:

- **where-used for symbols** — kills 125 §9.3's unconditional wipe, and makes "what breaks if I change this?" answerable
- **where-used for bound records** — impact analysis before deleting a product or collection
- **targeted SEO and search work** — instead of walking every tree
- **component placement upgrade as a query** rather than the current load-every-page fan-out ([component-service.ts:432-473](../packages/builder/src/services/component-service.ts#L432))

### 5.5 What happens to the existing columns

`draft_tree` / `published_tree` (sparx) and `silica_draft_tree` / `silica_published_tree` all retire. `silica_draft_tree` becomes `builder_page_snapshot.tree`; `silica_published_tree` becomes the artifact. The legacy sparx pair is dropped outright — they hold a blank stub for silica pages today ([site-service.ts:414](../packages/builder/src/services/site-service.ts#L414)), and dropping them **forces** the SEO / component / search integrations to move rather than silently no-op against a stub.

**Not done yet.** `silica_draft_tree` is still the authoritative snapshot the editor loads and the storefront (via publish) serves. The op log runs parallel to it — the same parallel-run discipline the artifacts used — and the event-sourced read (snapshot + replay, §5.1) is a later cutover, not part of Phase 2.

### 5.6 Two things the real engine changed about the op log — **SHIPPED**

Built against silicaui 0.30, two details of the §5 sketch turned out wrong, and the code follows the engine, not the sketch:

- **Seq is per-property, not per-page.** The engine tracks ONE document-wide sequence per editing session: `meta.baseSeq` is "the seq this client last had applied" across its whole site, and `ackSeq(seq)` advances that single counter. A per-page seq (the sketch's `(page_id, seq)`) could not answer the question the reconnect path actually asks — "this client is at seq N, what did it miss?" — because "at seq N" is not per-page. So `builder_page_ops` carries a per-property monotonic `seq`, and `owner_kind`/`owner_id` merely record which tree an op's `target` addressed. The unique `(tenant, property, seq)` index is both the order and the concurrency guard.

- **No `inverse` column; the engine owns undo.** The sketch stored an inverse op per row to replay undo host-side. 0.30 makes that the engine's job — a local snapshot stack for a single author, or a host `HistoryDelegate` the engine drives in a shared session (§6). The host records what happened; it does not need to know how to reverse it, so the column is gone.

The server validates each op at the **envelope only** (`target` + `kind`) and stores it verbatim as JSONB. This is deliberate: silicaui owns the op vocabulary, and adding an op kind must never require a host schema change to keep recording history. The full `Op` union lives in `@wizeworks/silicaui-builder/react` and is the dashboard's authority; the wire pins only the two fields the log is keyed on.

---

## 6. The silicaui `<Builder>` contract

The host contract changes from state-out to state-and-intent-out.

```ts
// today
onChange(site: Site): void

// specified
onChange(site: Site, ops: Op[], meta: { baseSeq: number }): void
```

Requirements on the engine:

1. **Every mutation emits at least one op.** An unexpressible mutation emits `site.replace` (§2.4). The engine must never mutate silently.
2. **Ops are emitted in causal order** within a batch.
3. ~~**Node ids are minted by the engine** and are globally unique.~~ **Already satisfied** — the engine mints `crypto.randomUUID()` at stamp time, never a counter. The counter footgun documented in [CLAUDE.md](../CLAUDE.md) is ours, in `_builder/model.ts`, not the engine's. Retained here only so the requirement is not re-raised.
4. **The engine accepts inbound ops** — `applyRemoteOps(ops: Op[]): void` — to render collaborators' edits without a reload. This is the piece with no equivalent today.
5. **The engine accepts a resync** — `replaceState(site, seq)` — for the §4.1 case 4 fallback.
6. **Undo/redo delegates to the host** when a session is collaborative, so undo does not revert another author's work. Local-only undo is correct for a single-author session and wrong for a shared one.

Point 6 is the subtle one and worth deciding early: local undo stacks in a collaborative editor routinely revert other people's changes, which reads as data loss.

It is also load-bearing for a reason the original spec missed. Undo today swaps the whole `Site` and emits a `replace`. Under the new contract, a local undo **must** emit inverse ops — otherwise every undo in a single-author session ships a full-site payload, reintroducing exactly what this protocol removes. Splitting undo (inverse-op for single-author, host-delegated when collaborative) lets the engine ship the first half without blocking on the second.

### 6.2 Engine constraints on remote-op application

The engine review answered the "is state addressable enough to apply a remote op without a full re-render?" question: **no, and it does not do one for local edits either.** That is better news than it sounds — there is a single mutation chokepoint, no memoization to invalidate, and no partial-update machinery to fight, so the canvas needs no changes. But it sets a hard constraint:

**Every commit performs three full `structuredClone`s of the entire `Site`** (history push, extract, onChange relay), then re-resolves and re-walks the tree. One remote op therefore costs one full site clone.

- **Burst batching is mandatory, not an optimization.** A stream of remote ops from an active collaborator must coalesce into one commit and one emit.
- **This is also a latent local-editing ceiling.** Three whole-site clones per commit — including on selection — is what will make a large page feel sluggish before anything else does. It is out of scope here, but it is the next perf conversation, and the op protocol does not fix it.

Four integration blockers, all plumbing rather than architecture:

| #   | Blocker                                                                                                                                                                  | Fix                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | **No ingress.** `document` is captured to a ref at mount; post-mount prop changes are inert by design                                                                    | Imperative ref handle exposing `applyRemoteOps` / `replaceState`                 |
| 2   | **Remote ops would enter local history.** History is whole-site snapshots with no attribution, so a remote op landing there means local undo reverts someone else's work | A `commitRemote` sibling that skips history push                                 |
| 3   | **`onChange` echoes.** The relay fires on every commit, so a host wiring `onChange` → broadcast creates a loop                                                           | Suppression flag during remote application                                       |
| 4   | **The IndexedDB draft silently beats server state.** Snapshots carry `savedAt` and nothing else — no seq, no revision — and on boot the local draft wins unconditionally | **Stamp `seq` into the draft snapshot.** Do not solve it with `persistKey: null` |

Blocker 4 is the same bug class we have already hit: our own studio reads `document` once at mount, so a server-side heal gets overwritten by the client's next autosave ([\_lib/actions.ts:90-93](<../apps/dashboard/app/(dashboard)/builder/_lib/actions.ts#L90>)). Under multi-editor it upgrades from "a heal is lost" to "a returning collaborator's stale draft clobbers authoritative state, undetectably." Stamping the seq is the fix; dropping crash recovery to dodge it is not. (Shipped: our studio runs `persistKey: null` — server-authoritative — and acks the load-time seq into the engine on mount, so its `baseSeq` never starts at a stale 0.)

### 6.3 How the relay was actually built — **SHIPPED**

The one architectural decision Phase 4 forced: **persistence stays on the HTTP sync PUT; the socket relays, it does not write.** There is one durable path (the PUT appends ops + snapshot in a transaction, Phase 2), and the socket is a fan-out over it — never a second writer of the same truth. Concretely:

- **`/ws/builder`** is a second socket.io server beside `/ws/chat`, same staff-JWT handshake and same Redis adapter for cross-replica fan-out. The client also hands it the `propertyId`, verified against the tenant before the socket joins that site's room (`builder:<propertyId>`).
- **The write path broadcasts.** After `siteService.sync` appends a batch, the api-rest route hands the persisted `{ batchId, seq, ops }` to a `BuilderBroadcaster` (the same module-singleton pattern as the chat broadcaster) which emits `ops:relay` to the room. The service stays socket-agnostic; the route strips the relay payload from the HTTP response so the sender isn't shipped its own ops back over HTTP.
- **Echo suppression is by `batchId`, not socket identity.** The originator is in the room and receives its own echo; it drops it because it minted that `batchId`. This keeps the HTTP path free of any socket coupling — it never needs to know which socket sent the save. Suppression is load-bearing, not an optimization: re-applying one's own `node.insert` would duplicate the node.
- **Catch-up closes the load→join gap.** On connect the client asks `catchup(baseSeq)`; the server returns `opsSince(baseSeq)` and the client applies + `ackSeq`s. The load-time seq (a new `GET /v1/builder/site/seq`) seeds the client's `baseSeq` so this window is exactly "what landed between the HTTP load and the socket joining."
- **Presence** rides `fetchSockets()` (adapter-aware, correct across replicas), rendered as a silicaui `AvatarGroup` in the toolbar — peers on the _same page_ get a ring, since that's the edit most likely to collide.

**Deferred: soft-subtree claim.** The design (§1.1) names presence _and_ a soft claim. Presence shipped; the claim did not. Per-node LWW already makes concurrent edits correct, and presence makes them visible, so a claim is a refinement (reserve a subtree, show it locked to peers) rather than a correctness requirement. Recorded as the one open item so it does not read as an oversight.

---

## 7. Validation

The protocol is the opportunity to close 125 §2, because ops are small enough to validate properly without the cost that walking a whole tree on every autosave would incur.

- **`node.insert`** validates the inserted subtree structurally — node ids present and unique, types resolvable or explicitly forward-compat, class string within bounds
- **`node.setProps`** validates against the registry `PropSpec` for that node's type. This is the first point in the system's history where per-type prop validation is affordable, because the payload is one node's patch rather than a whole site
- **Unknown node types** are accepted on insert (forward-compat, per `import-export.ts:10-11`) but **recorded in the node index**, so "which pages contain types this renderer cannot draw" becomes a query rather than a silent `null` render

That last point does not fix [render-leaf.tsx:899](../packages/builder-render/src/render-leaf.tsx#L899) — it makes the problem _visible_, which is the prerequisite. The renderer fix belongs in 127.

---

## 8. What this does not solve

Stated plainly so it is not assumed:

- **Read path.** Nothing here fixes unselected `findMany`, `no-store`, unbatched CMS pins, or `limit: 24` truncation. That is [127](127-site-read-path-remediation.md), and at the entity volumes we are targeting it is the wall we hit first.
- **Binding fan-out at scale.** A 100k-product catalog is a query and cache problem, not a tree problem — the tree stores the _query_, never the results.
- **The two-walker drift risk** between `SilicaBody` and `SilicaChrome` (125 §9.5).
- **Property scoping gaps** on `Redirect` and `SeoAudit` (125 §9.9).

---

## 9. Open decisions

1. **Op retention.** Keep forever (history is a feature and ops are small) or window it (90d)? Affects whether "restore this page to last Tuesday" is a product promise.
2. **Undo semantics in a shared session** — §6.6. Recommend host-delegated.
3. **Does presence ship with the protocol or after?** It is separable, but shipping granular writes into a real multi-editor situation _without_ presence means silent LWW with no social signal — arguably worse than today, because edits get finer-grained and therefore less noticeable.
4. **Artifact retention** — ~~how many published versions per page before pruning~~. **DECIDED (2026-07-20): a 30-day rolling window, plus a hard floor that the currently-live release is never pruned regardless of age.** The window covers the realistic "I want the old one back" span (including the slower seasonal/handoff case that 14 days would already have deleted) while content-addressing keeps the cost trivial. The floor exists because the live release _is_ the site: a tenant who published once and never again must keep that one release even at six months old, or a prune would orphan their live history. **Not yet built** — the tables are append-only and nothing enforces the window; storage is nowhere near a forcing function, so the pruner (a scheduled tick that deletes releases older than 30 days whose hash isn't the live one, then GCs the artifacts no surviving release references) is deferred until there is a reason to run it. See §5.3.1.
5. **Does the frame get its own op stream or ride the site stream?** Separate streams are cleaner; one stream is simpler to broadcast.
6. **Host-side mutations and the history gap** (§2.3.1). SEO and record-type-default edits live outside the op log. Do they get their own audit stream that a "page history" surface reconstructs from, or do we accept that restore-to-a-point-in-time covers content only?
7. **Text LWW** (§2.5). Recommending we accept paragraph-granularity last-write-wins and mitigate with presence. Confirm — this is the one place the protocol has a user-visible sharp edge.
8. **Is the email builder in scope?** It is a **second, fully separate engine** with the same shape and none of this touches it. Emails are single-author, so collaboration is not the driver — but history and granular writes still apply, and left alone the two engines diverge permanently. Recommend an explicit decision now rather than discovering the divergence later.

---

## 10. Sequencing

Ordered so that nothing is blocked on the silica engine change, and each phase ships value alone.

Host and engine phases interlock. The engine's `onChange(site, ops, meta)` is **additive** — hosts ignoring the new arguments keep working — so nothing here is a breaking release until we choose to make it one.

| Phase    | Host work                                                                                                     | Engine work                                                                                                                                                                                                                                                                      | Unblocks                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0**    | Per-page diff at the `syncBuilderSite` boundary — write only changed pages                                    | **Emission hygiene** (prerequisite): eight methods bypass the commit chokepoint with a manual history push, and four emit **twice per user action** — `createSymbol` fires `onChange` twice today. Route everything through one chokepoint; batch a logical action into one emit | Kills write amplification; drops payload under the 1MB ceiling; shrinks LWW blast radius to one page. **Without engine Phase 0, causal ordering within a batch is unimplementable** |
| **1**    | `updatedAt` precondition per page + reject-and-resync                                                         | —                                                                                                                                                                                                                                                                                | Makes 125 §5 non-catastrophic while the protocol is built                                                                                                                           |
| **2** ✅ | `builder_page_ops` append-only log (per-property seq); studio buffers ops per debounce, sends + `ackSeq`s     | **Ops out** (silicaui 0.30): op union, `onChange(site, ops, meta)`, symbol-cascade discipline (§2.6)                                                                                                                                                                             | History (125 §6); granular-write substrate. **SHIPPED** — seq is per-property not per-page (§5.6); envelope-only validation                                                         |
| **3** ✅ | Nothing — `ord` rides the node tree JSON, preserved by the `looseObject` schema (§3.1)                        | **`ord`** (silicaui 0.30): field on `Node`, key generation in insert/move/duplicate, publish-time strip                                                                                                                                                                          | Conflict-free concurrent insert/reorder. **SHIPPED free host-side**                                                                                                                 |
| **4** ✅ | `/ws/builder` namespace + presence + reconnect catch-up + relay via `applyRemoteOps`; soft-claim deferred     | **Ops in** (silicaui 0.30): `applyRemoteOps` / `replaceState` / `ackSeq` / `setHistoryDelegate` on the handle                                                                                                                                                                    | **Multi-editor turns on. SHIPPED** — two-client smoke test green. Soft-subtree claim is the one deferred nicety (LWW + presence already cover correctness + the social signal)      |
| **5** ✅ | Immutable content-addressed artifact; wire the publisher; `cache-revalidation-worker` consumes builder topics | —                                                                                                                                                                                                                                                                                | 125 §7; unblocks caching for 127. **SHIPPED** — plus publish history + restore, which the sketch did not anticipate as a product surface                                            |
| **6**    | Derived node index; retire `site.replace` as the common path; drop legacy columns                             | Inverse-op undo (single-author) + host-delegated undo (collaborative)                                                                                                                                                                                                            | Where-used, impact analysis, component upgrade as a query                                                                                                                           |

Engine phases 0–3 are the long pole and are largely mechanical. Phase 4 carries the remaining design risk on both sides.

**One item with no op and no owner:** `copy()` is the single engine mutation that emits nothing. It is clipboard-only view state, so it correctly stays op-less — recorded here so it does not read as a coverage gap during audit.

**Phase 0 is a day's work and reversible.** It is worth doing immediately regardless of whether the rest of this document is approved — it decouples the write-amplification fix from the engine timeline, and it tells us empirically whether per-page granularity is sufficient before we commit to per-node.

**Phase 1 is the multi-editor stopgap.** Given multi-editor is confirmed real, shipping 0 and 1 before anything else is the correct risk posture.

---

## Related

- [125-site-data-architecture-critical-issues.md](125-site-data-architecture-critical-issues.md) — the findings this resolves
- [127-site-read-path-remediation.md](127-site-read-path-remediation.md) — the parallel track
- [118-builder-silicaui-html-migration.md](118-builder-silicaui-html-migration.md) — the cutover this completes
- [55-blueprint-updates.md](55-blueprint-updates.md) — the node-id-keyed three-way merge that this design makes easier, not harder
- [56-live-chat-module.md](56-live-chat-module.md), [96-realtime-product-activity.md](96-realtime-product-activity.md) — the socket.io + Redis transport being reused
- [98-builder-customization-rebuild.md](98-builder-customization-rebuild.md) — composition model and layout invariants
