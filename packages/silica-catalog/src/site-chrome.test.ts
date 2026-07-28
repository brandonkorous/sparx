// The site chrome's brand mark — the `site.brand` HOST core.
//
// What these lock is the SORT, not the styling: the mark must be a host node, because a
// stamped mark freezes at publish. That is not hypothetical — it is how tenants who
// published before silica's `Wordmark` could hold a logo ended up with a text-only
// header that no fix to the composite could ever reach. If someone "simplifies" this
// back into a stamped lockup, that whole class of bug returns silently, and these tests
// are the alarm.

import { describe, expect, it } from 'vitest';

import { siteFooter, siteNavbar } from './site-chrome';
import { HOST_COMPONENTS, HOST_KEYS, hostCore } from './host-nodes';

const navBrand = (opts = {}) => {
  const nav = siteNavbar(opts) as { children?: unknown[] };
  return (nav.children ?? [])[0] as Record<string, unknown>;
};

describe('siteNavbar — the brand mark', () => {
  it('seeds the brand as a HOST node, so the platform renders it live', () => {
    const brand = navBrand();
    // `kind: "host"` is the whole point: the tree stores a mount point, so a logo
    // uploaded in Site settings reaches the header with no re-author and no re-publish.
    expect(brand.kind).toBe('host');
    expect(brand.component).toBe(HOST_KEYS.siteBrand);
  });

  it('does NOT lock the brand — the tenant owns where their own mark sits', () => {
    // Unlike a functional core, the brand protects no transaction. Locking it would
    // forbid MOVE as well as remove (silicaui: "a locked node cannot be removed, moved,
    // or reparented"), so the tenant could not center their logo or place it after the
    // nav links. Improvability comes from `kind:"host"`; `locked` is orthogonal.
    expect(navBrand().locked).toBeUndefined();
  });

  it('is the FIRST child of the nav, so the header leads with the brand', () => {
    expect(navBrand({ commerceEnabled: true, schedulingEnabled: true }).component).toBe(
      HOST_KEYS.siteBrand
    );
    // …and independent of which modules are on: the brand is not module-gated.
    expect(navBrand({ commerceEnabled: false, schedulingEnabled: false }).component).toBe(
      HOST_KEYS.siteBrand
    );
  });

  it('carries the registered `show` default, matching a palette insert', () => {
    // A seeded core must behave identically to one dragged from the palette (which gets
    // its defaults from the Inspector). Without this the storefront would be relying on
    // its own fallback, and the two could drift.
    expect(navBrand().props).toEqual({ show: 'both' });
  });

  it('keeps the `wordmark` class — silicaui sizes the mark through it', () => {
    // `.wordmark & :is(svg,img)` is what makes this a real Wordmark rather than a
    // lookalike lockup; dropping the class silently un-sizes every tenant's logo.
    expect(String(navBrand().class)).toContain('wordmark');
  });
});

describe('hostCore — pinning is opt-out, and only the brand opts out', () => {
  it('locks a functional core by default', () => {
    // Safe by omission: a NEW core is protected unless someone deliberately says
    // otherwise, so forgetting `pinned` can never ship a deletable checkout.
    expect(hostCore(HOST_KEYS.commerceCart).locked).toBe('host');
    expect(hostCore(HOST_KEYS.commerceAuth).locked).toBe('host');
  });

  it('leaves an opted-out core unlocked', () => {
    expect(hostCore(HOST_KEYS.siteBrand).locked).toBeUndefined();
  });

  it('only placement-owned cores are unpinned; every transaction core stays pinned', () => {
    // A tripwire, not a style rule: a core that wraps a live transaction the tenant must
    // not be able to delete has to stay pinned. The unpinned set is exactly the cores whose
    // PLACEMENT the tenant legitimately owns — the brand mark, the theme toggle and the
    // legal links (none is a transaction). If a FOURTH name appears here, either a
    // functional core just became deletable or a new placement-owned core landed — both
    // are worth a human look.
    const unpinned = HOST_COMPONENTS.filter((c) => c.pinned === false).map((c) => c.key);
    expect(unpinned).toEqual([
      HOST_KEYS.siteBrand,
      HOST_KEYS.siteThemeToggle,
      HOST_KEYS.siteLegalLinks,
    ]);
  });
});

// ─── The footer's legal links ───────────────────────────────────────────────
//
// This locks a shipped bug: the footer hardcoded `Privacy → /privacy-policy` and
// `Terms → /terms-of-service`, so EVERY site built on the starter advertised two legal
// pages that do not exist until the tenant creates them in Content → Legal pages. A
// brand-new site shipped with two guaranteed 404s in its footer, and the tenant had no
// way to know — the links look right in the builder.
//
// It fails the other way too: a tenant who publishes a cookie policy or a returns
// policy gets no link to either, because the frame was stamped before those pages
// existed. Static links cannot track a document set the tenant owns; only a live core
// can, which is why the fix is `site.legal-links` and not a longer hardcoded list.

/** Every host-core key in a chrome tree. */
function hostKeys(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== 'object') return;
    const rec = n as { kind?: string; component?: string; children?: unknown[] };
    if (rec.kind === 'host' && rec.component) out.push(rec.component);
    if (rec.children) rec.children.forEach(visit);
  };
  visit(node);
  return out;
}

describe('siteFooter — legal links are live, never hardcoded', () => {
  it('mounts the legal-links core instead of authoring the links', () => {
    expect(hostKeys(siteFooter({ commerceEnabled: true }))).toContain(HOST_KEYS.siteLegalLinks);
    // …on a content-only site too. Legal obligations are not a commerce feature.
    expect(hostKeys(siteFooter({ commerceEnabled: false }))).toContain(HOST_KEYS.siteLegalLinks);
  });

  it('links to NO legal page directly — those routes may not exist', () => {
    // The regression tripwire. Any href that looks like a legal document means someone
    // re-authored the column and re-introduced the 404s.
    const legalish = hrefs(siteFooter({ commerceEnabled: true })).filter((h) =>
      /privacy|terms|cookie|returns?|shipping|refund/i.test(h)
    );
    expect(legalish).toEqual([]);
  });

  it('carries the registered heading default, matching a palette insert', () => {
    // Same contract as the brand mark's `show`: a seeded core must behave identically to
    // one dragged from the palette, or the storefront falls back to its own default and
    // the two drift.
    const core = find(
      siteFooter(),
      (n) => n.kind === 'host' && n.component === HOST_KEYS.siteLegalLinks
    );
    expect(core?.props).toEqual({ heading: 'Legal' });
  });
});

// ─── Reachability ───────────────────────────────────────────────────────────
//
// These lock the two ways the starter chrome shipped BROKEN, both of which were
// invisible to every automated check we had because the markup was perfectly valid:
//
//   1. The link row was `hidden … @2xl:flex` with nothing on the other side of the
//      breakpoint, so on a narrow bar the header was a wordmark and one button. Every
//      tenant site built on the starter had NO navigation on a phone.
//   2. The call to action was `atom('Button')`, which lowers to a `<button>` with no
//      handler — the most prominent control on the site did nothing when clicked.
//
// Neither is a styling preference; both make the site unusable, so they are asserted
// structurally rather than left to a visual pass.

/** Every anchor href in a chrome tree, in document order. */
function hrefs(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== 'object') return;
    const rec = n as { tag?: string; attrs?: { href?: string }; children?: unknown[] };
    if (rec.tag === 'a' && rec.attrs?.href) out.push(rec.attrs.href);
    if (rec.children) rec.children.forEach(visit);
  };
  visit(node);
  return out;
}

/** Find the first node matching a predicate. */
function find(
  node: unknown,
  pred: (n: Record<string, unknown>) => boolean
): Record<string, unknown> | null {
  let hit: Record<string, unknown> | null = null;
  const visit = (n: unknown): void => {
    if (hit) return;
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== 'object') return;
    const rec = n as Record<string, unknown>;
    if (pred(rec)) {
      hit = rec;
      return;
    }
    if (Array.isArray(rec.children)) rec.children.forEach(visit);
  };
  visit(node);
  return hit;
}

describe('siteNavbar — reachable on a phone', () => {
  it('carries a phone menu holding every destination the desktop row offers', () => {
    const nav = siteNavbar({ commerceEnabled: true });
    const menu = find(nav, (n) => n.tag === 'details');
    expect(menu, 'no phone menu in the navbar').not.toBeNull();

    // Shown only where the inline row is hidden — the two must not both appear.
    expect(String(menu!.class)).toContain('@2xl:hidden');

    // NOT the `Collapse` component: it is an accordion panel whose `.details-content`
    // sets an explicit display, overriding the browser's hiding of a closed
    // <details> — the menu then renders permanently open. Raw elements only.
    expect(String(menu!.class)).not.toMatch(/(^|\s)(details|collapse)(\s|$)/);
    const summary = find(menu, (n) => n.tag === 'summary');
    expect(summary, 'phone menu has no summary to tap').not.toBeNull();

    // The panel must carry NO display utility. A closed <details> hides its
    // non-summary children via a UA-stylesheet `display: none`, and ANY author
    // display class (`flex`, `grid`, `block`) outranks it — which renders the menu
    // permanently open, spilling every link into the header. This is invisible in
    // markup review and only shows on a phone.
    const panel = (menu!.children as Record<string, unknown>[]).find((c) => c.tag === 'div');
    expect(panel, 'phone menu has no panel').toBeTruthy();
    expect(String(panel!.class)).not.toMatch(/(^|\s)(flex|grid|block|inline-flex|table)(\s|$)/);

    const menuHrefs = hrefs(menu);
    expect(menuHrefs).toEqual(expect.arrayContaining(['/shop', '/about', '/contact']));
  });

  it('offers the same destinations in the phone menu, the desktop row and the footer', () => {
    const opts = { commerceEnabled: true, schedulingEnabled: true };
    const nav = siteNavbar(opts);
    const menu = find(nav, (n) => n.tag === 'details');
    const inlineRow = find(
      nav,
      (n) => typeof n.class === 'string' && n.class.includes('@2xl:flex')
    );

    const unique = (xs: string[]) => [...new Set(xs)].sort();
    // The phone menu carries the same DESTINATIONS as the desktop row, plus the account
    // sign-in link — a shopper on a phone reaches their account from the menu, whereas the
    // desktop surfaces sign-in in the header's right-hand cluster instead of the nav row.
    const ACCOUNT = '/account/login';
    const destOnly = (xs: string[]) => unique(xs.filter((h) => h !== ACCOUNT));
    expect(destOnly(hrefs(menu))).toEqual(destOnly(hrefs(inlineRow)));
    expect(hrefs(menu)).toContain(ACCOUNT);
    // The footer's Explore column is built from the same source list.
    expect(unique(hrefs(siteFooter(opts)))).toEqual(
      expect.arrayContaining(destOnly(hrefs(inlineRow)))
    );
  });

  it('respects the module flags in the phone menu, not just the desktop row', () => {
    // A content-only tenant must not be offered a shop on any surface.
    const nav = siteNavbar({ commerceEnabled: false });
    const menu = find(nav, (n) => n.tag === 'details');
    expect(hrefs(menu)).not.toContain('/shop');
  });

  it('makes the call to action a real link, not a dead button', () => {
    const nav = siteNavbar();
    const cta = find(nav, (n) => typeof n.class === 'string' && n.class.includes('btn-primary'));
    expect(cta, 'no primary call to action found').not.toBeNull();
    // A `<button>` here renders an inert control: clicking it does nothing at all.
    expect(cta!.tag).toBe('a');
    expect((cta!.attrs as { href?: string })?.href).toBe('/contact');
  });
});
