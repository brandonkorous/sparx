// The hero's "product in use" device — a faithful small business vignette
// (window chrome + AI check-in card) standing in for the mockup's business
// demo card. Split out of hero.tsx so the headline column and the device
// illustration stay independently readable/editable.

export function BusinessDemoCard() {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          borderRadius: '22px',
          backgroundColor: 'var(--color-base-100)',
          boxShadow: '0 40px 100px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '13px 16px',
            borderBottom: '1px solid var(--color-base-300)',
          }}
        >
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <span
              key={c}
              style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: c }}
            />
          ))}
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '11.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            Bloom &amp; Co. &middot; sparx Assistant
          </span>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.02em',
                color: 'var(--color-base-content)',
              }}
            >
              Good morning, Jess.
            </h3>
            <span
              style={{
                padding: '6px 10px',
                borderRadius: 9999,
                backgroundColor:
                  'color-mix(in oklab, var(--color-success) 15%, var(--color-base-100))',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '11px',
                color: 'var(--color-success)',
                whiteSpace: 'nowrap',
              }}
            >
              Business online
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 'clamp(20px, 2.4vw, 26px)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--color-base-content)',
            }}
          >
            &ldquo;What needs my attention today?&rdquo;
          </p>

          <div
            style={{
              padding: '18px',
              borderRadius: '14px',
              backgroundColor: 'var(--color-base-200)',
              border: '1px solid var(--color-base-300)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '14.5px',
                color: 'var(--color-base-content)',
              }}
            >
              Three things. I&apos;ve already handled two.
            </p>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              Saturday inventory is running low, a caf&eacute; asked about wholesale pricing, and
              yesterday&apos;s abandoned carts are ready for a follow-up.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '14px',
              }}
            >
              <DemoAction label="Review inventory" sub="12 bundles remaining" />
              <DemoAction label="Open wholesale lead" sub="$620 potential order" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '10.5px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              Handled by sparx
            </span>
            <ActivityRow text="Sent pickup reminders to 14 customers" />
            <ActivityRow text="Published today's availability to your site" />
          </div>
        </div>
      </div>

      <div
        className="mkt-hide-on-mobile"
        style={{
          position: 'absolute',
          right: '-28px',
          bottom: '36px',
          width: '150px',
          padding: '16px',
          borderRadius: '16px',
          backgroundColor: 'var(--color-secondary)',
          color: 'var(--color-secondary-content)',
          boxShadow: '0 22px 55px rgba(0, 0, 0, 0.3)',
          transform: 'rotate(-4deg)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            opacity: 0.85,
          }}
        >
          This week
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '-0.03em',
            margin: '2px 0',
          }}
        >
          +24%
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            opacity: 0.85,
          }}
        >
          online orders
        </span>
      </div>
    </div>
  );
}

function DemoAction({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '10px',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '12.5px',
          color: 'var(--color-base-content)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          marginTop: '2px',
        }}
      >
        {sub}
      </span>
    </div>
  );
}

function ActivityRow({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: 7,
          backgroundColor: 'var(--color-primary)',
          flexShrink: 0,
        }}
      >
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12L10 17L19 7"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        {text}
      </span>
    </div>
  );
}
