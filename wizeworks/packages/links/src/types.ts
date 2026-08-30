// The address contract.
//
// One route maps three things onto each other: a readable PATH someone can put
// in a chat message, the workbench SURFACE that path opens, and — where the
// thing is a record the platform indexes — the universal-search ENTITY type that
// names it. Keeping the three in one row is the whole point: search, the
// notification bell, an emailed link and the browser address bar stop being four
// opinions about where an order lives.

/** A path parameter, e.g. `id` in `/commerce/orders/:id`. Always a string. */
export type RouteParams = Readonly<Record<string, string>>;

export interface AppRoute {
  /**
   * The canonical path, with `:name` parameters. This is what `buildPath` emits
   * and what the address bar shows, so it is written for a person to read:
   * `/commerce/orders/:id`, not `/c/o/:id`.
   *
   * A parameter written `:name?` is OPTIONAL — the surface is addressable with
   * it and without it, and both forms resolve here. It exists for a pane whose
   * subject is a parameter rather than its identity: a product's Stock panel is
   * a surface in its own right, and `/commerce/products/stock` opens it set to
   * follow whatever the operator has open, while
   * `/commerce/products/:productId/stock` opens it fixed on one product. The
   * parameterised form is emitted whenever the parameter is supplied, so an
   * address already sent keeps building byte for byte.
   */
  readonly path: string;
  /**
   * The workbench surface key this opens. Exactly one route per surface and one
   * surface per route — `scripts/check-surface-routes.mjs` fails the build
   * otherwise, which is what keeps this table complete as surfaces are added.
   */
  readonly surface: string;
  /**
   * The universal-search / notification `entity_type` this route is the home of,
   * where one exists. At most one route may claim a given entity.
   *
   * A route whose `path` has NO parameter is still a legitimate home for an
   * entity — it means "we can show you where this lives, but there is no detail
   * view to land on" (a review is worked in a queue, a page is authored in the
   * builder). The old `withId: false` flag said this explicitly; here it simply
   * falls out of the path, so the two can never disagree.
   */
  readonly entity?: string;
  /** Plural heading for the command palette's grouped results ("Products"). */
  readonly entityLabel?: string;
  /**
   * Which product this route belongs to, when a path means different things in
   * each. Absent is the default and covers all but one route: the address is the
   * same wherever it is read.
   *
   * It exists because both consoles read THIS table, and each has a Home screen
   * that is not the other's. Every product's front door should be `/home` --
   * that is what a person typing it expects from either -- and one table cannot
   * spell one path twice without a way to say which is which.
   *
   * Resolution is a preference, never a filter: `matchPath` prefers a route
   * carrying the caller's brand and otherwise takes the unbranded one, so a
   * console asking for a path that varies by nothing still gets the one row.
   * That is what lets a single branded route exist without every other row
   * having to declare a brand.
   */
  readonly brand?: string;
  /**
   * Paths that still resolve here but are never emitted. These are the addresses
   * already sitting in people's inboxes — `/settings/billing` went out with
   * every Stripe return, `/chat/:id` with every staff chat notification. A link
   * that was valid when it was sent stays valid.
   */
  readonly aliases?: readonly string[];
}

/** What a path resolved to. */
export interface MatchedLink {
  readonly surface: string;
  /**
   * Path parameters, plus any query parameters that were not consumed by the
   * matcher. Extra query params are handed through deliberately: it is what lets
   * `/settings/billing?billing=success` reach the surface as `params.billing`
   * instead of the surface reaching into `window.location`, which stops working
   * the moment the address bar starts tracking the focused pane.
   */
  readonly params: RouteParams;
  /** The `?site=` the link named (slug or id), when it named one. */
  readonly site?: string;
}

/** Options for building an absolute link someone else's browser will open. */
export interface LinkOptions {
  /** e.g. `https://app.sparx.works`. Omit for a root-relative path. */
  readonly origin?: string;
  /**
   * The site (slug preferred, id accepted) the record belongs to. A link that
   * crosses businesses without this opens the right surface against the wrong
   * data — see the arrival gate in the workbench's deep-link resolver.
   */
  readonly site?: string;
}
