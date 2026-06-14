'use client';

/**
 * The pricing switchboard — the page's interactive centerpiece. Flip a module
 * on/off and the sticky plan panel recomputes the live bill, breakdown, and
 * savings. Every module is an independent toggle (no locked base). The only
 * 'use client' island on the pricing page; everything around it is static.
 *
 * Per-module `elsewhere` is the real, published 2026 price of the named tool
 * each module replaces (see the cost-savings ledger on the page for sources).
 */
import { Fragment, useState } from 'react';
import { Display, Spark } from './primitives';

interface Mod {
  key: string;
  name: string;
  desc: string;
  price: number;
  /** Real monthly cost of the named tool this module replaces. */
  elsewhere: number;
  color: string;
  long: string;
  feats: string[];
  replaces: string;
  /** Add-ons render below the core eight under an "Add-ons" divider; they are
   *  priced on top, never part of the "eight modules" story. */
  addon?: boolean;
}

const MODULES: Mod[] = [
  {
    key: 'builder',
    name: 'Builder',
    desc: 'Themes, pages, live URLs',
    price: 10,
    elsewhere: 39,
    color: 'var(--module-builder)',
    long: 'The foundation every Sparx site starts on. Pick a polished theme, edit blocks, point your domain — automatic SSL, edge-cached pages, instant TTFB worldwide. Power users go fully headless against the same API.',
    feats: [
      'Theme-first, customize what matters',
      'Custom domain + automatic SSL',
      'CDN-cached, stale-while-revalidate',
      'Headless SDK for Next, Remix, Astro',
    ],
    replaces: 'Webflow + hosting + a CDN',
  },
  {
    key: 'commerce',
    name: 'Commerce',
    desc: 'Cart, checkout, orders',
    price: 49,
    elsewhere: 399,
    color: 'var(--module-commerce)',
    long: 'Products, inventory, payments, tax, and shipping. A conversion-optimized single-page checkout out of the box, D2C and B2B from the same codebase.',
    feats: [
      'Variants, bundles, real-time inventory',
      'Apple Pay + one-tap checkout',
      'Stripe, PayPal, Klarna, Affirm',
      'Avalara/TaxJar tax · Shippo/EasyPost',
    ],
    replaces: 'Shopify Advanced + tax & shipping apps',
  },
  {
    key: 'cms',
    name: 'CMS',
    desc: 'Words, media, SEO',
    price: 49,
    elsewhere: 99,
    color: 'var(--module-cms)',
    long: 'A real editor with autosave and revisions, structured content types with a typed API, a media library, and SEO scored on every publish. Standalone or paired with your site.',
    feats: [
      'Block editor, autosave + revisions',
      'Structured content types + typed API',
      'Auto WebP/AVIF media library',
      'Per-page SEO + JSON-LD',
    ],
    replaces: 'a headless CMS like Storyblok + a media CDN',
  },
  {
    key: 'crm',
    name: 'CRM',
    desc: 'Customers, pipeline, signal',
    price: 49,
    elsewhere: 300,
    color: 'var(--module-crm)',
    long: 'One customer record across orders, email, support, RFQs, and AI conversations — sitting on the same database as everything else. No sync, no glue, no duplicate records.',
    feats: [
      'One record, no deduping',
      'Dynamic segments from any signal',
      'Pipeline tied to order status',
      'Automations + activity timeline',
    ],
    replaces: 'HubSpot Sales Pro + an automation seat',
  },
  {
    key: 'email',
    name: 'Email',
    desc: 'Transactional + marketing',
    price: 29,
    elsewhere: 165,
    color: 'var(--module-email)',
    long: 'Transactional and marketing email from your own sending domain, with SPF, DKIM, and DMARC auto-configured. Flat price — send 10K or 1M a month, same bill.',
    feats: [
      'Transactional wired into every module',
      'Campaigns + A/B testing',
      'Your domain, your reputation',
      'No per-email pricing, ever',
    ],
    replaces: 'Klaviyo + a transactional email service',
  },
  {
    key: 'b2b',
    name: 'B2B · Fleet',
    desc: 'Wholesale, net terms, fleet',
    price: 99,
    elsewhere: 2400,
    color: 'var(--module-b2b)',
    long: 'Wholesale pricing, net terms, purchase orders, RFQ, fleet accounts, and service scheduling — natively, not a bolt-on. Built for how industrial actually works.',
    feats: [
      'Account-tier + contract pricing',
      'Net 15 / 30 / 60 / 90 + PO checkout',
      'Fleet: vehicles, VIN, cost centers',
      'RFQ + bookable service bays',
    ],
    replaces: 'Shopify Plus for native B2B',
  },
  {
    key: 'ai',
    name: 'AI · MCP',
    desc: 'Native MCP server',
    price: 49,
    elsewhere: 103,
    color: 'var(--module-ai)',
    long: 'The first content + commerce platform built around the Model Context Protocol. Connect any AI client once and read or write live data in plain English. Scoped, audited, revocable.',
    feats: [
      'First-class MCP server, per-tenant',
      'Read & write everything the API can',
      'Per-agent keys, per-tool scopes',
      'Claude, ChatGPT, Copilot, Cursor',
    ],
    replaces: 'Zapier Team + custom integration work',
  },
  {
    key: 'dropship',
    name: 'Dropship',
    desc: 'Suppliers, sync, fulfillment',
    price: 29,
    elsewhere: 60,
    color: 'var(--module-dropship)',
    long: 'Supplier sync, margin math, and automated order routing — on a real platform underneath, not an app stacked on an app. Sell without holding inventory.',
    feats: [
      'Supplier connectors + CSV/FTP/API',
      'Per-supplier margin rules',
      'Automated multi-supplier routing',
      'Real-time stock sync',
    ],
    replaces: 'a dropshipping app like Spocket',
  },
  {
    key: 'invoicing',
    name: 'Invoicing',
    desc: 'Estimates, invoices, AR',
    price: 19,
    elsewhere: 30,
    color: 'var(--module-invoicing)',
    long: 'Author estimates, work orders, and invoices line by line — parts marked up, labor by the hour, deposits and partial payments — through stages you name. Tracks balances and AR aging, and prints on your brand. Included free with Commerce or B2B.',
    feats: [
      'Estimate → invoice workflows you name',
      'Parts, labor, sublet & flat-fee lines',
      'Deposits, partial payments, AR aging',
      'Branded, printable documents',
    ],
    replaces: 'a billing tool like FreshBooks',
    addon: true,
  },
  {
    key: 'chat',
    name: 'Live Chat',
    desc: 'Widget, AI replies, inbox',
    price: 19,
    elsewhere: 74,
    color: 'var(--module-chat)',
    long: 'A themed chat widget on every page, an AI first responder that answers product and policy questions from your own catalog, and a staff inbox for everything it escalates. Leads from sparx.market route here too.',
    feats: [
      'On-site widget in your theme',
      'AI answers from your own catalog',
      'Staff inbox — assign, reply, resolve',
      'Web-push + email notifications',
    ],
    replaces: 'a live-chat + AI inbox like Intercom',
    addon: true,
  },
];

const DEFAULT_ON = new Set(['builder', 'commerce', 'cms']);

// Dependency graph — mirrors the server (@sparx/modules). REQUIRES co-enables +
// locks a separately-billed provider (Commerce/CMS/Email need Builder; B2B needs
// Commerce, transitively Builder). BUNDLED_FREE makes a capability $0 while a
// provider is on (Invoicing rides with Commerce/B2B).
const REQUIRES: Record<string, string[]> = {
  commerce: ['builder'],
  cms: ['builder'],
  email: ['builder'],
  b2b: ['commerce'],
};
const BUNDLED_FREE: Record<string, string[]> = {
  invoicing: ['b2b', 'commerce'],
};
const moduleName = (key: string): string => MODULES.find((x) => x.key === key)?.name ?? key;
const activeBundlers = (on: Record<string, boolean>, key: string): string[] =>
  (BUNDLED_FREE[key] ?? []).filter((p) => on[p]);
const activeRequirers = (on: Record<string, boolean>, key: string): string[] =>
  Object.keys(REQUIRES).filter((k) => (REQUIRES[k] ?? []).includes(key) && on[k]);
const requiredKeys = (key: string): string[] => {
  const out = new Set<string>();
  const visit = (k: string): void => {
    for (const dep of REQUIRES[k] ?? []) {
      if (!out.has(dep)) {
        out.add(dep);
        visit(dep);
      }
    }
  };
  visit(key);
  return [...out];
};
const joinNames = (slugs: string[]): string => {
  const names = slugs.map(moduleName);
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
};
const lockOfState = (on: Record<string, boolean>, key: string): 'included' | 'required' | null => {
  if (activeBundlers(on, key).length > 0) return 'included';
  if (activeRequirers(on, key).length > 0) return 'required';
  return null;
};

export function PricingSwitchboard() {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.key, DEFAULT_ON.has(m.key)]))
  );
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Dependency model mirrors the server (@sparx/modules graph): Commerce/CMS/Email
  // require Builder, B2B requires Commerce (and transitively Builder); a required
  // provider is co-enabled, billed, and locked on. Invoicing is BUNDLED_FREE with
  // Commerce/B2B — $0 ("Included") while either is on, else a $19 add-on.
  const effectiveOn = (key: string): boolean =>
    !!on[key] || activeBundlers(on, key).length > 0 || activeRequirers(on, key).length > 0;
  const lockOf = (key: string): 'included' | 'required' | null => lockOfState(on, key);
  // The reason a row is locked, naming its providers — mirrors Settings → Modules.
  const reasonOf = (key: string): string | null => {
    const lock = lockOf(key);
    if (lock === 'included') return `Included with ${joinNames(activeBundlers(on, key))}`;
    if (lock === 'required') return `Required by ${joinNames(activeRequirers(on, key))}`;
    return null;
  };
  // Bundled invoicing contributes $0 to both the bill and the savings ledger —
  // it's a free rider, not part of the comparison.
  const billed = (m: Mod): number => (lockOf(m.key) === 'included' ? 0 : m.price);
  const elsewhereOf = (m: Mod): number => (lockOf(m.key) === 'included' ? 0 : m.elsewhere);

  const toggle = (key: string): void =>
    setOn((s) => {
      if (lockOfState(s, key) !== null) return s; // bundled or required — locked on
      const next = { ...s, [key]: !s[key] };
      if (next[key]) for (const dep of requiredKeys(key)) next[dep] = true; // co-enable requirements
      return next;
    });

  const active = MODULES.filter((m) => effectiveOn(m.key));
  const total = active.reduce((s, m) => s + billed(m), 0);
  const elsewhere = active.reduce((s, m) => s + elsewhereOf(m), 0);
  const save = Math.max(0, elsewhere - total);

  return (
    <div className="mkt-switchboard">
      {/* Left rail: heading + module toggles */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div>
          <Display as="h1" size={60} lineHeight={60}>
            Switch on
            <br />
            what you use
            <Spark />
          </Display>
          <p
            style={{
              margin: '18px 0 0',
              maxWidth: '480px',
              fontFamily: 'var(--font-sans)',
              fontSize: '17px',
              lineHeight: '27px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Every module is one toggle. Flip it and the bill on the right changes the instant you do
            — one platform, one invoice, nothing you&apos;re not using. Tap a row for the details.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {MODULES.map((m, i) => {
            const isOn = effectiveOn(m.key);
            const lock = lockOf(m.key);
            const reason = reasonOf(m.key);
            const isOpen = openKey === m.key;
            const firstAddon = !!m.addon && (i === 0 || !MODULES[i - 1]?.addon);
            return (
              <Fragment key={m.key}>
                {firstAddon ? (
                  <div
                    style={{
                      padding: '16px 4px 6px',
                      marginTop: '8px',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: '13px',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    Add-ons
                  </div>
                ) : null}
                <div
                  style={{
                    borderBottom:
                      i === MODULES.length - 1
                        ? undefined
                        : '1px solid var(--color-border-default)',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => setOpenKey(isOpen ? null : m.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenKey(isOpen ? null : m.key);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 9999,
                        backgroundColor: m.color,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                            fontSize: '16px',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {m.name}
                        </span>
                        <Chevron open={isOpen} />
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '13px',
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        {m.desc}
                      </span>
                      {reason ? (
                        <span
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontFamily: 'var(--font-sans)',
                            fontSize: '11px',
                            fontWeight: 500,
                            lineHeight: '16px',
                            backgroundColor:
                              lock === 'included'
                                ? 'var(--color-success-tint)'
                                : 'var(--color-bg-muted, #f1f1f3)',
                            color: lock === 'included' ? '#065F46' : 'var(--color-text-secondary)',
                          }}
                        >
                          {reason}
                        </span>
                      ) : null}
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: isOn ? 500 : 400,
                        fontSize: lock === 'included' ? '13px' : '15px',
                        width: '78px',
                        flexShrink: 0,
                        textAlign: 'right',
                        color:
                          lock === 'included'
                            ? 'var(--color-success-text, #065F46)'
                            : isOn
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-tertiary)',
                      }}
                    >
                      {lock === 'included' ? 'Included' : `+ $${m.price}`}
                    </span>
                    {lock === 'included' ? (
                      // Bundled — nothing to toggle. Hold the switch's width so the
                      // price column stays aligned with the rows above and below.
                      <span style={{ width: 44, flexShrink: 0 }} aria-hidden />
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        aria-disabled={lock ? true : undefined}
                        aria-label={m.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(m.key);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isOn ? 'flex-end' : 'flex-start',
                          width: 44,
                          height: 26,
                          borderRadius: 9999,
                          padding: '0 3px',
                          border: 'none',
                          background: isOn ? m.color : '#e4e4e7',
                          cursor: lock ? 'not-allowed' : 'pointer',
                          opacity: lock ? 0.55 : 1,
                          flexShrink: 0,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 9999,
                            backgroundColor: '#fff',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
                          }}
                        />
                      </button>
                    )}
                  </div>

                  {isOpen ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px',
                        padding: '2px 4px 24px 30px',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          maxWidth: '580px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '14px',
                          lineHeight: '22px',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {m.long}
                      </p>
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          padding: 0,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '10px 28px',
                        }}
                      >
                        {m.feats.map((f) => (
                          <li
                            key={f}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '9px',
                              width: '260px',
                              maxWidth: '100%',
                              fontFamily: 'var(--font-sans)',
                              fontSize: '13.5px',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 9999,
                                backgroundColor: m.color,
                                flexShrink: 0,
                              }}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '13px',
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        Replaces {m.replaces} — about{' '}
                        <b style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                          ${m.elsewhere}/mo
                        </b>{' '}
                        bought separately.
                      </div>
                    </div>
                  ) : null}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Sticky plan panel */}
      <aside
        className="mkt-pricing-plan"
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '16px',
          boxShadow: '0 16px 44px rgba(15, 15, 20, 0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '28px 26px 22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '15px',
                color: 'var(--color-text-primary)',
              }}
            >
              Your plan
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#4338CA',
                backgroundColor: '#EEF2FF',
                padding: '3px 9px',
                borderRadius: 9999,
              }}
            >
              {active.length} {active.length === 1 ? 'module on' : 'modules on'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '84px',
                lineHeight: '80px',
                letterSpacing: '-0.04em',
                color: 'var(--color-text-primary)',
              }}
            >
              ${total}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '22px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              /mo
            </span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Billed monthly · one invoice for everything
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '13px',
            padding: '20px 26px',
            borderTop: '1px solid #F1F1F3',
            backgroundColor: '#FCFCFD',
          }}
        >
          {active.length === 0 ? (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Flip on a module to start.
            </span>
          ) : (
            active.map((m) => (
              <div
                key={m.key}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 9999,
                      backgroundColor: m.color,
                      flexShrink: 0,
                    }}
                  />
                  {m.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '14px',
                    color:
                      lockOf(m.key) === 'included'
                        ? 'var(--color-success-text, #065F46)'
                        : 'var(--color-text-primary)',
                  }}
                >
                  {lockOf(m.key) === 'included' ? 'Included' : `$${m.price}`}
                </span>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '11px',
            padding: '18px 26px',
            borderTop: '1px solid #F1F1F3',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
              }}
            >
              Same stack, stitched together
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-tertiary)',
                textDecoration: 'line-through',
              }}
            >
              ${elsewhere}/mo
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '10px 12px',
              backgroundColor: 'var(--color-success-tint)',
              borderRadius: '8px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '13px',
              color: '#065F46',
            }}
          >
            <CheckIcon />
            You save ${save}/mo on one bill
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px 26px 26px',
          }}
        >
          <button type="button" className="mkt-launch">
            Start 14-day free trial
            <ArrowIcon />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              textAlign: 'center',
            }}
          >
            No card to start · cancel anytime
          </span>
        </div>
      </aside>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        color: '#c4c4cc',
        flexShrink: 0,
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 0.2s ease',
      }}
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#059669"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
