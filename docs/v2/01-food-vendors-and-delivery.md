# sparx Platform — Food Vendors & Delivery Platform Integration

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-02

> **Status: PARKED — v2.** Committed in principle, deliberately out of scope until v2 work opens.
> Read [README.md](README.md) for what that means before acting on anything here.
>
> **Depends on v1:** the local-fulfillment primitives specified in
> [107-local-shops.md](../107-local-shops.md) §4.2–§4.4 (fulfillment method on the order, pickup
> locations, delivery zones, and the courier last-mile seam). Almost everything in this document
> either builds on those or is blocked by them. If 107's Phase 2 does not ship, most of §5 here has
> nowhere to attach.

---

## 0. What this is

The complete definition for **making sparx a first-class platform for food vendors of every kind** —
and, as the most visible part of that, giving them **a pre-built interface to the delivery platforms
their customers already order from** (DoorDash, Uber Eats, Grubhub) instead of the four tablets on
the counter they run today.

It covers the segment, the wedge, an honest inventory of what the platform already has, the real
gaps, the two structurally different delivery integrations and their very different gates, where
every piece lands in the repo, and the build order.

**Two framings this document deliberately rejects:**

- **"A restaurant vertical."** Food is not one business. A coffee cart, a wedding caterer, a CSA
  farm box, a ghost kitchen and a wholesale bakery share almost no operational shape. This document
  targets **food vendors of all kinds**, and it says explicitly which capabilities are universal
  (and therefore belong in commerce, unmodified) versus which are genuinely food-shaped.
- **"Delivery is the product."** The delivery marketplaces are a **demand channel**, and an
  expensive one. The product is **one menu, one source of truth, everywhere** — with the vendor's
  own commission-free ordering as the profitable center and the marketplaces as paid reach. Any
  version of this that makes sparx a thin reseller of someone else's courier network has given away
  the margin and kept the support burden.

**A note on the platform's industry-agnostic commitment.** sparx is not commerce-specific and it is
not industry-specific; a food vertical must not become a second baseline the way an auto-parts lens
once threatened to. The discipline applied throughout: **anything that a florist, pharmacy, bakery,
bookshop or parts counter would also want goes into the shared modules** (courier dispatch, pickup
slots, prep time, order-state fan-out). Only the genuinely food-only concepts (menu dayparting,
allergen disclosure, the expo surface) are allowed to be food-shaped, and even those are built as
optional configuration on general primitives rather than as a parallel food stack.

---

## 1. Who "food vendor" means

The segment is wide, and the differences between its members are the whole design problem. Nine
archetypes, what each actually does, and what each needs from us:

| Archetype                        | How they sell                                             | What they need that others don't                                                            | Delivery-marketplace fit |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| **Full-service restaurant**      | Dine-in + takeout + delivery                              | Reservations, menu dayparting, modifiers, prep-time quoting, order throttling during a rush | Core                     |
| **Quick-service / counter**      | Walk-up + pickup + delivery                               | Speed: fast repeat ordering, saved favorites, tight prep-time accuracy                      | Core                     |
| **Coffee / bar / drinks**        | Walk-up, mostly small tickets                             | Heavy modifiers (size, milk, shots, syrups), loyalty, subscription (a monthly coffee tab)   | Marginal — low ticket    |
| **Food truck / cart / pop-up**   | Location changes by day                                   | **Where are we today** as first-class data; pre-order for pickup at a location on a date    | Poor — no fixed address  |
| **Bakery / deli / specialty**    | Counter + custom orders + shipping                        | Lead-time orders ("48h notice on cakes"), deposits, per-item cutoffs, custom-order intake   | Partial                  |
| **Caterer / private chef**       | Quotes, events, per-head pricing                          | Quote → deposit → event; headcount-driven pricing; a delivery _window_, not a courier       | No                       |
| **Ghost / virtual kitchen**      | Delivery-only, often several brands from one kitchen      | **Multiple brands from one inventory**; per-brand menus, per-brand marketplace listings     | Existential              |
| **Grocer / farm stand / CSA**    | Shopping cart of many items, weight-priced, subscriptions | Weight/variable pricing, substitutions, recurring boxes, pickup windows                     | Growing                  |
| **Packaged / cottage / shipped** | Ships nationally; jams, sauces, coffee beans, baked goods | Normal commerce + food labeling; **cottage-food law limits** on what may ship where         | No                       |

**Read across the table and three things fall out.**

1. **Only about half the segment wants a delivery marketplace at all.** Building the marketplace
   integration first would serve the half with the worst margins and the most competition, while the
   caterer, the CSA and the packaged-goods seller — who are already served well by existing sparx
   commerce — get nothing. That is an argument for sequencing (§8), not against the integration.
2. **The universal needs are not food-specific.** Pickup windows, lead time, prep time, order state
   visible to the customer, on-demand courier, deposits — a florist and a pharmacy want every one of
   those. They belong in commerce and scheduling as general capabilities.
3. **The multi-brand ghost kitchen is the case that breaks naive designs.** One tenant, one kitchen,
   one inventory pool, several public brands each with its own menu, its own site, and its own
   listing on each marketplace. sparx's **per-site model already fits this exactly** — a site is the
   business a customer deals with, and a tenant may own several. Get this right and it is a genuine
   differentiator; assume one-brand-per-tenant and it is unrecoverable later.

---

## 2. The wedge

**The problem, in the vendor's words:** "I have my menu in five places and four of them are wrong."
Their own website, their Google listing, and one tablet per delivery marketplace — each with its own
menu editor, its own idea of what's out of stock, and its own 86'ing workflow. When the kitchen runs
out of the fish, someone has to remember to mark it unavailable in four apps. Usually nobody does,
and the customer's order gets cancelled after they've paid.

**The offer:** _one menu, everywhere._ Edit once in sparx; it lands on the vendor's own site, their
Google listing, and every delivery marketplace they've connected. Mark an item 86'd once; it goes
dark everywhere within seconds. Every order — from any of those sources — arrives in one queue.

That is precisely the story sparx already tells for retail commerce with
[channels](../106-channel-marketplace-strategy.md): one catalog, many channels, one order spine. Food
is the same architecture with different nouns and a much more acute pain, because a restaurant menu
changes daily and a retail catalog does not.

**The commercial argument that actually closes the sale.** Delivery-marketplace commission runs
roughly 15–30% of the ticket. On a food business's margins, that is often the entire profit. Every
vendor knows it and every vendor resents it. So the pitch is not "we get you on DoorDash" — they can
do that themselves in an afternoon. It is:

> **Your own ordering, at 0% commission, on your own site — plus the marketplaces, managed from the
> same screen.** Take the marketplace orders for reach. Convert those customers to your own
> ordering, where you keep the money. sparx is the only place that runs both.

Everything needed for the profitable half of that sentence — site, catalog, cart, checkout,
payments, customer accounts, email, CRM — **sparx already has.** That is the asymmetry worth
exploiting: the commission-free channel is nearly built, and the marketplace channels are the
customer-acquisition argument for adopting it.

**The retention argument.** A vendor's menu, their customer list, their order history and their
ordering site all living in sparx is a far stickier position than a courier integration. The delivery
platforms are replaceable; being the system of record is not.

---

## 3. What the platform already has

An honest inventory, because a surprising amount of this is built. Verified against the tree on
2026-08-02.

### 3.1 The menu is already modelled — via the configurator, not variants

**This is the single most important finding in this document, and it inverts the obvious assumption.**

The naive read is that a menu item with modifiers ("choose a size — required; choose up to 12
toppings at +$0.75 each") does not fit sparx's product model, because sparx models options as
**variants**: a cartesian matrix where a burger with 12 optional toppings would be 4,096 rows. That
read is wrong, because the variant matrix is not the only option system in commerce.

[`ConfigurationTemplate`](../../packages/db/prisma/schema/38-commerce-bundles.prisma) — the
configurator built for play structures, gift sets, and custom crates — **is a modifier engine
already**:

| Menu concept                           | Configurator field                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Modifier group                         | `ConfigurationOption`                                                        |
| Choose exactly one (size, protein)     | `type: 'single_choice'` + `required: true`                                   |
| Choose up to N (toppings)              | `type: 'multi_choice'` + `minSelections` / `maxSelections`                   |
| Add / remove (extra cheese, no onion)  | `type: 'toggle'`                                                             |
| Quantity of a modifier (3 extra shots) | `type: 'quantity'`                                                           |
| Upcharge per choice                    | `ConfigurationChoiceInput.priceDeltaCents` (signed — discounts too)          |
| Group heading, ordering                | `groupHeader`, `position`                                                    |
| Conditional modifiers                  | `ConfigurationRule` — `when option A in [...] then B required/hidden/±price` |
| A modifier that consumes real stock    | `ConfigurationChoiceInput.variantId` / `addOnVariantId`                      |
| Free-text ("write on the cake")        | `type: 'text'` + `metadataPayload`                                           |

The resolved selection already rides the cart on `CartItem.configurationPayload`, and pricing already
resolves through `configuratorService`. **The hard, expensive part of a menu system exists.** What is
missing is not the engine — it is a food-shaped authoring surface over it (§4.1) and a handful of
fields.

### 3.2 The channel contract already fits a delivery marketplace

[`wizeworks/packages/channels/src/types.ts`](../../packages/channels/src/types.ts) defines `ChannelAdapter`
with three shapes; a delivery marketplace is `shape: 'order'`, the same as the retail marketplaces
already modelled. The mapping is close to exact:

| Delivery-marketplace operation      | Existing `ChannelAdapter` member                               |
| ----------------------------------- | -------------------------------------------------------------- |
| Push the menu                       | `pushProduct` → `ChannelProductRef`                            |
| Remove an item                      | `removeProduct`                                                |
| 86 an item / restore it             | `pushInventory` (`availableQuantity`)                          |
| Inbound order (webhook)             | `ingestOrder` + `verifyWebhook` + `webhookShopId`              |
| Inbound order (poll fallback)       | `fetchOrders` + `ChannelOrderPollCursor`                       |
| Order ready / picked up             | `pushFulfillment`                                              |
| Commission taken by the marketplace | `NormalizedChannelOrder.channelFeeCents` — already on the type |
| Store-level OAuth                   | `connectUrl` / `exchangeCode` / `refresh`                      |
| Multi-tenant webhook routing        | `webhookShopId` + the shop directory                           |
| Sales reporting                     | `getAnalytics`                                                 |

[`channel-sync-worker`](../../services/channel-sync-worker/) already owns every database write, with
adapters as pure I/O and tokens resolved by the worker from Secret Manager. Adding a channel is an
adapter file plus a `ChannelSlug` and a
[catalog](../../packages/channels/src/catalog.ts) entry, with **no change to the dispatch core.**
The extensions actually needed are enumerated in §5.2 and they are modest.

### 3.3 Everything else that already applies

- **Sites, catalog, cart, checkout, payments, tax, customers, email, CRM, search** — the whole
  commerce spine. A food vendor's own ordering site is mostly an authoring and presentation problem,
  not a platform problem.
- **Per-site scoping.** A tenant may own several sites, and switching sites swaps the entire
  identity. This _is_ the multi-brand ghost-kitchen model (§1) — already built.
- **[Scheduling](../../packages/scheduling/)** — resources, services, availability rules, resource
  hours, exceptions, deposits, bookings, notifications, iCal/CalDAV. Restaurant **reservations** are a
  scheduling configuration, not new work. Resource hours also give us an hours model to build store
  hours and dayparting on.
- **[Subscriptions](../../packages/commerce/)** — the coffee tab, the weekly CSA box, the meal-prep
  plan. Recurring food is an existing capability.
- **[Inventory](../../packages/inventory/)** with a real ledger, safety buffers and multi-location —
  more than a typical food vendor needs, and exactly what a commissary or wholesale bakery does.
- **[B2B](../../packages/b2b/)** — wholesale bakery to café, farm to restaurant, distributor to
  kitchen. Already the strongest module for the supply side of food.
- **[Integration framework](../../packages/integration-framework/)** — provider registry, OAuth,
  encrypted per-tenant secrets, webhook router, and the existing provider kinds (payment, shipping,
  tax, dropship). A courier provider is a new kind alongside these (§5.1).
- **[Social](../../packages/social/)** — food is the most visually driven retail category there is;
  posting the daily special is a real workflow and it already exists.

### 3.4 What is planned but not yet built, that this depends on

[107-local-shops.md](../107-local-shops.md) is **PLANNED, not built** — verified: no
`fulfillmentMethod`, no pickup location and no delivery zone tables exist in the schema today. Its
Phase 2 commits exactly the primitives food needs:

- `Order.fulfillmentMethod` — `ship | local_pickup | local_delivery | market_pickup`
- `MarketPickupLocation` — location, hours, pickup time slots
- `MarketDeliveryZone` — radius or postal zones, fee, order minimum, delivery windows
- the checkout state-machine fork per method
- a `MarketDeliveryProvider` seam for courier last-mile, explicitly deferred to its Phase 4

Its `market_pickup` method — reserve for pickup at an event on a date — is also, unmodified, **the
food-truck model** from §1.

**Conclusion: food does not need its own fulfillment stack. It needs 107 Phase 2 to ship, and then
it needs the courier seam filled in.** Any food work that starts before 107 P2 will either duplicate
those tables or build a food-only fork of them, and both outcomes are worse than waiting.

---

## 4. The gaps

What genuinely must be built. Each is marked **[universal]** (wanted by non-food businesses too, so
it belongs in a shared module) or **[food]** (genuinely food-shaped).

### 4.1 A menu authoring surface — **[food]** (thin), over an existing engine

The configurator engine is right; its _authoring_ surface is built for a product configurator and
would be miserable for someone updating a lunch menu on a Tuesday morning. What's needed:

- A **menu-shaped editor**: sections (Breakfast, Sides, Drinks) → items → modifier groups, with
  reorder by drag, inline price edits, and a duplicate-item action. This is a presentation layer over
  `ConfigurationTemplate`, not a new data model.
- **Reusable modifier groups.** A "Choose your milk" group applies to eleven drinks. Today
  `ConfigurationOption` is owned by exactly one template (`@@unique([templateId, key])`), so the group
  would be copied eleven times and edited eleven times. **This is the one real schema change in the
  menu area**: a tenant-level shared modifier group with a per-item override, plus a join. Everything
  else is authoring UX.
- **Bulk price edit** across a section — a category-wide increase is a routine food operation and a
  rare retail one.
- **Import an existing menu.** Adoption friction is almost entirely "I'm not retyping 90 items."
  Ingesting a menu from a PDF or a URL is the single highest-leverage onboarding investment in this
  document — and it is a natural fit for the `ai` module under a **tenant's own** key (BYOK; sparx
  never runs an LLM on a platform credential).

### 4.2 Availability and 86'ing — **[universal]**

Marking an item unavailable must be **one action with a fan-out**, not four apps. The inventory
ledger is the wrong primitive for most of it — a kitchen does not count portions of soup, it decides
the soup is done for the day.

- An item-level **availability state**: available / unavailable-until-tomorrow / unavailable
  indefinitely, with an optional auto-restore at the next daypart or opening.
- Availability at the **modifier-choice** level too (out of oat milk), which the marketplace APIs
  model natively and which a variant-only design cannot express.
- A **fan-out on change** — publish an event, let the channel worker push to every connected
  marketplace and revalidate the site cache. This is the existing event-driven pattern, and the
  latency target matters: a customer ordering a sold-out item is the failure this feature exists to
  prevent, so seconds, not the next sync cycle.

### 4.3 Hours, dayparting, prep time, throttling — **[universal]**

- **Store hours per site**, with holiday exceptions and a manual "closed now" override. Scheduling's
  resource-hours and exception model is the right substrate; this is a second consumer of it, not a
  new one. A florist, a pharmacy and a barber want the identical feature.
- **Dayparting** — an item or a section is orderable only during a window (breakfast until 11).
  Genuinely food-flavoured, but expressed as a general availability-window rule.
- **Prep / lead time**, at two scales: minutes (a sandwich) and days (a wedding cake, with a cutoff
  time and a deposit — both of which scheduling already does). This drives the quoted ready-time, and
  quoting it accurately is what determines whether the courier arrives at the right moment.
- **Order throttling** — cap orders per N-minute slot so a rush cannot bury the kitchen. This is
  capacity-per-time-window, which is _conceptually the same thing_ as scheduling's availability
  slots; the same primitive should serve both rather than a second bespoke implementation.

### 4.4 Tips and gratuity — **[universal]**, and legally sensitive

There is **no tip or gratuity concept in commerce today** (verified: no such field in the schema).
Needed:

- A tip line on the cart/order that is **not vendor revenue** — it must not flow into revenue
  reporting, must not be part of the tax base, and must be visible as a separate settlement line.
- Presets and a custom amount, at checkout and (for card-present or post-service flows) after.
- Service charges and auto-gratuity for large parties or catering — a _different_ thing from a tip,
  usually taxable, and frequently mishandled.

**Flag for counsel before building.** Tip handling touches wage-and-hour law, tip-pooling rules, and
sales-tax treatment that varies by state. Getting the _modelling_ right up front (tip is a distinct,
non-revenue, separately-settled amount) is cheap; retrofitting it after tips have been recorded as
revenue is not.

### 4.5 A food order lifecycle and the expo surface — **[food]** for the surface, **[universal]** for the states

The retail order lifecycle (placed → paid → fulfilled → shipped) does not describe a kitchen. Food
needs: **received → accepted (with a quoted ready-time) → in progress → ready → handed off /
collected / out for delivery → completed**, plus **rejected** with a reason, and the timings that
make the courier hand-off work.

- The **states themselves are universal** — a pharmacy counter and a parts desk have the same shape.
  They belong in the order spine as an optional lifecycle, not a food fork of `Order`.
- The **expo surface** is food-shaped: a single always-on screen showing live tickets across _every_
  source (own site, each marketplace, phone-in), sorted by promised time, with big touch targets,
  audible alerts on a new ticket, and one-tap accept / ready / 86. It must be usable on a cheap
  tablet on a hot counter by someone with wet hands — which means it is a **dedicated surface with
  its own layout constraints**, not a workbench pane squeezed onto a tablet.
- **Customer-facing order status.** "Accepted, ready at 6:40, driver on the way" is table stakes and
  is largely already served by the existing order + email/SMS infrastructure once the states exist.

### 4.6 Compliance and disclosure — **[food]**

Not glamorous, and the reason a serious food platform is trusted. **All of this needs legal review at
build time; the notes below are scope-setting, not legal advice, and the specifics change.**

- **Allergens.** Per-item allergen tagging against the major-allergen set (nine in the US since
  sesame was added in 2023), surfaced on the item and carried onto the ticket so the kitchen sees it.
  Federal packaged-food labeling law and restaurant menu practice differ, and several states and
  cities impose their own notice requirements.
- **Calorie / nutrition disclosure.** The FDA menu-labeling rule applies to chains at or above a
  location threshold — most sparx tenants will be well below it, but the **fields should exist from
  day one** so a growing chain never has to migrate, and so vendors who want to disclose voluntarily
  can.
- **Alcohol.** Delivery is state-by-state, generally requires ID verification at hand-off, and the
  marketplaces gate it behind their own flags and agreements. Model an item as
  age-restricted early; do not treat alcohol as a launch requirement.
- **Cottage food.** Home-kitchen producers operate under state cottage-food laws that typically
  restrict what may be sold, where, and whether it may ship at all. For the "packaged/shipped"
  archetype this determines whether a sale is even legal, so it belongs in onboarding, not in a
  footnote.
- **Menu accuracy.** Prices and availability shown on a marketplace are the vendor's legal
  representation to the customer. This raises the stakes on §4.2's fan-out latency from "nice" to
  "the thing we are liable for."

### 4.7 Point of sale — **[universal]**, and explicitly out of scope here

Most food vendors take money in person. sparx has **no POS** — no card-present flow, no terminal, no
cash drawer, no shift/close-out. This is a large, distinct product with hardware, certification and
payments-compliance dimensions of its own, and it is **not** part of this document.

It is named here because it is the most likely objection in a sales conversation and because
pretending otherwise would make the phasing dishonest. Two viable answers, both deferrable: sparx is
the **online** system of record alongside whatever POS they run, or POS becomes its own v2+ program
with its own document. Note that the order lifecycle in §4.5 and the tips model in §4.4 are both
prerequisites for it either way — building them well here makes a later POS materially cheaper.

---

## 5. The delivery integrations

Two integrations get conflated constantly. They are structurally different, they serve different
vendors, and their gates differ by roughly an order of magnitude in effort. Building the wrong one
first is the main planning risk in this document.

### 5.1 On-demand courier — "you bring the order, we bring a driver"

**DoorDash Drive, Uber Direct**, and equivalents. The customer orders on the **vendor's own sparx
site**. sparx then dispatches a courier to carry it. No marketplace listing, no menu sync, **no
commission** — a per-delivery fee.

**This is the commission-free half of the wedge in §2**, and it is the more valuable integration to
build first even though it is the less obvious one.

**It is not a `ShippingProvider`.** The existing contract in
[`shipping-provider.ts`](../../packages/integration-framework/src/shipping-provider.ts) is
label-centric — `buyLabel` returns a base64 PDF/PNG/ZPL to print and stick on a box, and `track`
returns carrier scan events. On-demand courier has no label, no carrier scans, and a completely
different lifecycle: quote → dispatch → courier assigned → courier at pickup → picked up → courier at
dropoff → delivered, with a live courier position, a tip to the courier, and cancellation windows.

So this is a **new provider kind** in the integration framework — `DeliveryProvider` — registered
next to payment/shipping/tax/dropship, which is exactly what 107 anticipated with its
`MarketDeliveryProvider` seam. Shape:

```
quote(ctx, { pickup, dropoff, readyAt, itemValue, requiresAgeCheck }) → DeliveryQuote[]
dispatch(ctx, quoteRef | request) → DeliveryJob      // returns externalJobId + tracking URL
cancel(ctx, externalJobId, reason) → void
getJob(ctx, externalJobId) → DeliveryJobStatus       // courier, ETA, position, proof of delivery
verifyWebhook(req) / parseWebhook(req) → DeliveryJobStatus   // status pushes
```

Notes that matter for correctness:

- **The quote must be bound to the promised ready-time** (§4.3), not to "now." Dispatching a courier
  who arrives twelve minutes before the food does is the classic failure of naive integrations, and
  it is the vendor who takes the rating hit.
- The **courier tip is distinct from the vendor tip** (§4.4) and settles to a different party.
- The seam should stay **provider-agnostic** — a vendor may want one courier network in one city and
  a different one elsewhere, and the quote step is naturally multi-provider.
- **Access:** a developer account and a commercial agreement, not a partner program. Materially
  easier than §5.2, and achievable without anyone's approval queue.
- **Not food-specific.** A florist, a pharmacy, a bakery, a bookshop and a parts counter running a
  part across town all want same-day local courier. Built as a general `DeliveryProvider` on 107's
  `local_delivery` method, this earns its keep even if every remaining line of this document is
  never built. That property is why it is Phase 1.

### 5.2 Delivery marketplaces — menu out, orders in

**DoorDash Marketplace, Uber Eats, Grubhub.** The vendor's menu is listed **on** the marketplace, the
marketplace owns the customer and the demand, and orders are injected into sparx. Commission is
roughly 15–30%.

Architecturally this is a `shape: 'order'` `ChannelAdapter` (§3.2). The extensions the existing
contract needs:

| Need                                    | Change                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Menus are not flat catalogs             | A menu-tree push alongside `pushProduct` — sections → items → modifier groups → choices, projected from the configurator |
| Store open/closed + hours               | New optional adapter methods (`pushStoreStatus`, `pushHours`) — no retail channel needs these                            |
| Accept / reject with a quoted prep time | New optional `respondToOrder` — retail channels have no accept step; food orders time out if unanswered                  |
| Order-state pushes                      | Extend `pushFulfillment` semantics, or a `pushOrderStatus`, for ready / picked-up                                        |
| Cancellations and refunds inbound       | A cancellation ingest path; retail channels currently model orders as forward-only                                       |
| Choice-level availability               | `pushInventory` keyed to a modifier choice, not only a SKU                                                               |

All are **additive optional members** on an adapter contract explicitly designed for per-channel
variation, plus new `ChannelSlug` values. The dispatch core does not change.

**The real blocker is not engineering — it is partner approval.** Production credentials for menu
push and order injection require becoming an approved integration partner. Both major platforms run
a partner track that vets you as a POS/middleware vendor (because you are injecting orders into their
network and their brand carries the failure), typically including a technical certification pass
before go-live. Sandbox access generally comes earlier than production. The third platform has
historically been the most gated of the three.

Practical consequences:

- **Start the applications early and in parallel with build.** The paperwork clock is the critical
  path, and it costs nothing to start it running.
- **Expect months, not weeks**, and expect the certification pass to surface required behaviours
  (accept/reject timeouts, status pushes, cancellation handling) that are cheaper to design in now
  than to retrofit — which is why they are in the table above.
- **Do not promise a vendor a marketplace connection until credentials exist.** This is the single
  most likely way to burn early trust in the segment.
- **Verify every specific at build time.** These programs, their API surfaces and their onboarding
  requirements change; nothing in this section should be treated as current without re-checking.

### 5.3 Build versus buy

A category of **third-party delivery-integration middleware** exists whose entire product is this
one-menu-to-many-marketplaces problem. Integrating with one of them would get several marketplaces on
a single contract and a single API, side-stepping the partner queues in §5.2.

- **For:** dramatically faster to market; someone else absorbs each platform's API churn and partner
  politics; the approval burden moves to them.
- **Against:** a per-location monthly fee against the vendor's margin; a hard dependency on a vendor
  in an adjacent business who could become a competitor; and it forfeits the _architectural_ asset —
  because the channel contract we already own is most of the work, and outsourcing it means we never
  own the relationship or the data path.

**Recommendation: build direct, but treat middleware as a hedge, not a fallback.** Because §5.2's
work sits behind a `ChannelAdapter`, a middleware provider can be implemented as _one more adapter_
without disturbing anything above it. That makes the decision reversible and defers it to the moment
we know how the partner applications actually went. Specific vendors are deliberately not named here;
that is a procurement shortlist, made separately when the decision is live.

### 5.4 The free channel nobody remembers

Menus can be published as **structured data** on the vendor's own site — `schema.org` menu markup —
and to their **business profile listing**, which drives the "menu" panel customers see in map and
search results. No partnership, no commission, no approval. For a food vendor, that listing is
frequently their **highest-traffic surface**, and it is usually years out of date.

sparx already emits JSON-LD from the site render path and audits it with `@wizeworks/seo-audit`
([50-seo-aio-discoverability.md](../50-seo-aio-discoverability.md)).
Emitting menu structured data from the menu model is a small amount of work with an outsized,
immediate, demonstrable payoff — the kind of thing a vendor can _see_ working in a week. It should
ship alongside the menu model, not wait for any of §5.

> **Historical note:** the end-to-end "order food directly in search results" programs run by the
> large search platforms were discontinued. Do not plan around one returning; the value here is
> discovery and menu accuracy, not order capture.

---

## 6. Where everything lands

No new top-level architecture. Every piece attaches to an existing seam.

| Capability                        | Home                                                                                | Shape                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Menu model + modifier reuse       | `@wizeworks/commerce` + `@wizeworks/commerce-schemas`, over `ConfigurationTemplate` | Shared modifier groups + a join; the rest is authoring UX |
| Menu authoring surface            | `sparx/apps/workbench`                                                              | New panes; menu editor, modifier library                  |
| Item availability / 86            | `@wizeworks/commerce`, event-published                                              | New availability state + a fan-out event                  |
| Store hours, dayparting, prep     | `@wizeworks/scheduling` primitives, consumed by commerce                            | Second consumer of resource-hours + exceptions            |
| Order throttling                  | `@wizeworks/scheduling` capacity windows                                            | Same primitive as booking slots                           |
| Tips / gratuity                   | `@wizeworks/commerce` + `@wizeworks/payments`                                       | New non-revenue order line + settlement handling          |
| Food order lifecycle              | Order spine, optional lifecycle                                                     | New states; not a fork of `Order`                         |
| Expo / kitchen screen             | New surface (own app or a dedicated workbench route)                                | Tablet-first, always-on, its own layout rules             |
| Fulfillment method, pickup, zones | **107 Phase 2** — prerequisite, not built here                                      | `Order.fulfillmentMethod`, pickup locations, zones        |
| On-demand courier                 | `@wizeworks/integration-framework` — **new `DeliveryProvider` kind**                | quote / dispatch / cancel / status + webhooks             |
| Courier provider implementations  | `packages/provider-*` (matching `provider-shippo`, `provider-easypost`)             | One package per network                                   |
| Delivery marketplaces             | `@wizeworks/channels` — new `ChannelSlug`s + adapters                               | `shape: 'order'` + the §5.2 optional members              |
| Marketplace sync + order ingest   | `services/channel-sync-worker`                                                      | Existing worker; new job types only                       |
| Menu structured data              | `wizeworks/apps/site` render path (JSON-LD), checked by `@wizeworks/seo-audit`      | Emit from the menu model                                  |
| Allergens / nutrition             | `@wizeworks/commerce` product metadata                                              | Fields + ticket display                                   |
| Ordering site surfaces            | `@wizeworks/builder-schemas` catalog + `@wizeworks/silica-catalog`                  | Menu blocks as composed node trees — never new node types |

### 6.1 Module strategy — no `food` module

**Recommendation: do not add a `food` module** to the `ModuleSlug` union. Almost everything above is
either a commerce capability that non-food vendors want (courier, pickup, prep time, tips, order
lifecycle, throttling) or a scheduling capability that already exists. A `food` flag would gate
capabilities that a florist should be able to buy, which contradicts how modules are meant to work —
they gate **capabilities**, never customer segments.

The one genuinely food-only cluster is menu dayparting, allergen/nutrition disclosure and the expo
surface. Two viable homes, to be decided when the work is live:

- **Preferred: an industry starter plus commerce configuration.** `@wizeworks/modules` already has an
  `IndustryStarter` registry; "food service" becomes a starter that seeds a menu-shaped catalog,
  turns on the right commerce configuration, and installs the ordering blueprint. No new flag, no new
  billing line, and it composes with whatever else the tenant enables.
- **Alternative: a small `menu` module**, if the expo surface and menu authoring grow enough to be
  worth billing separately. Decide on evidence, not in advance.

Either way this stays consistent with the platform rule: a new tenant starts with **zero** modules
on, and a food vendor turns on exactly what they want.

---

## 7. Risks and things that go wrong

| Risk                                                                                       | Mitigation                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Partner approval never lands**, and the marketplace half is dead                         | Sequence so Phases 1–2 are valuable standalone; every one of them serves non-food vendors too. Keep the middleware hedge (§5.3) live.            |
| **Menu-sync drift** — sparx and the marketplace disagree; customers order sold-out food    | Treat menu push as reconciled state, not fire-and-forget: periodic full re-push, drift detection, a visible per-channel "last synced / in sync". |
| **Order injection is real-time and unforgiving** — an unanswered ticket auto-cancels       | Accept/reject with a hard timer, audible alerting, and an explicit auto-accept mode the vendor opts into knowingly.                              |
| **Courier arrives before the food is ready** (or long after)                               | Dispatch off the promised ready-time (§4.3), and feed real prep-time history back into the quote.                                                |
| **We become a support desk for someone else's courier network**                            | Never obscure who owns a failure: surface the marketplace's / courier's own order id and support path on every ticket.                           |
| **Food becomes a de-facto second baseline**, the way an auto-parts lens once threatened to | §6's assignment table is the guard: universal capabilities land in shared modules and must be justified for a non-food vendor.                   |
| **Tips modelled as revenue**                                                               | Model as a distinct non-revenue settlement line before the first tip is ever recorded (§4.4). Not retrofittable.                                 |
| **POS objection stalls sales** (§4.7)                                                      | Answer it honestly and position sparx as the online system of record; do not improvise a POS mid-program.                                        |
| **Commission economics make the marketplace half unattractive to the best vendors**        | That is the wedge, not a problem — §2. Lead with commission-free ordering; the marketplaces are reach.                                           |
| **The multi-brand ghost kitchen is designed out by accident**                              | Every menu, listing and connection is **site-scoped**, not tenant-scoped, from the first table. This is the expensive one to get wrong.          |

---

## 8. Phasing

Build order by dependency and standalone value. **Phases are sequencing, not scope tiers** — the
whole surface is committed. Every phase before the marketplaces is deliberately chosen to be
valuable on its own, and valuable to non-food vendors, so the program cannot be held hostage by
someone else's approval queue.

**Phase 0 — prerequisite (not this program).**
[107](../107-local-shops.md) Phase 2: `Order.fulfillmentMethod`, pickup locations, delivery zones,
the checkout fork. Nothing here starts cleanly before it.

**Phase 1 — on-demand courier.** The `DeliveryProvider` kind, the first provider package, dispatch
wired to 107's `local_delivery`, live tracking on the order, courier status to the customer. **No
partner gate.** Serves every local business on the platform, not just food. Start the §5.2 partner
applications on the same day this phase starts — the clock is the critical path.

**Phase 2 — the menu.** Shared modifier groups, the menu authoring surface, availability + 86 with
event fan-out, store hours + dayparting + prep time, menu structured data (§5.4), allergen fields.
Ends with a food vendor able to run **commission-free ordering on their own sparx site** — the
profitable half of the wedge, complete.

**Phase 3 — the kitchen.** The food order lifecycle, the expo surface, tips and gratuity, order
throttling, customer-facing order status. Ends with a vendor able to actually **operate** on sparx
during a rush rather than merely take orders.

**Phase 4 — the marketplaces.** Channel-contract extensions (§5.2), one adapter per platform as
credentials land, menu-tree projection, order injection, accept/reject, status push, reconciliation
and drift detection. Ships per platform, as approvals arrive — not as one release.

**Phase 5 — the long tail.** Multi-brand ghost-kitchen tooling on the per-site spine, catering quote
flows on the existing quote engine, food-truck location-of-the-day on 107's `market_pickup`, loyalty,
and — if the evidence supports it — the POS question of §4.7 as its own program.

---

## 9. Open decisions

To settle when v2 opens, not before:

1. **Direct or middleware** for the delivery marketplaces (§5.3) — decide after the partner
   applications have actually been through a round.
2. **Industry starter or a `menu` module** (§6.1) — decide on how large the food-only surface
   actually grows.
3. **Where the expo surface lives** — a dedicated app, or a workbench route with its own layout
   rules. Driven by whether it needs offline tolerance, which is a real question for a tablet on a
   restaurant counter.
4. **POS: partner, build, or decline** (§4.7) — its own program with its own document either way.
5. **Which courier network first**, and whether multi-provider quoting is Phase 1 or a fast-follow.
6. **Whether menu import justifies the `ai` module dependency** in Phase 2 — it is the strongest
   adoption lever in the document, and it is BYOK by construction.
