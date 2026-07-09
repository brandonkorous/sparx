import { SparxMark } from '@sparx/ui';
import { Section, SectionHeader } from '../primitives';
import { CopyValue } from './interactive';

const SIZES = [16, 24, 32, 48] as const;

const USE = [
  'Favicons and browser tabs',
  'App icons and PWA install tiles',
  'Square avatars and social profile marks',
  'Anywhere the full wordmark would fall below 16px',
];

export function MonogramSection() {
  return (
    <Section id="monogram" surface="page" padding="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        <SectionHeader
          accent="var(--color-primary)"
          headline="The monogram mark"
          lede="When the full wordmark won’t fit, the “sx” monogram stands in. The “s” adopts the current text color so it flips between light and dark surfaces; the “x” stays sparx Indigo, carrying the same brand moment as the wordmark."
        />

        <div className="mkt-grid-2-1">
          <Tile label="On light" background="var(--color-base-100)" ink="#18181B" border />
          <Tile label="On dark" background="#0A0A0A" ink="#FAFAFA" />
        </div>

        <div className="mkt-grid-2-1">
          <Panel title="Anatomy">
            <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
              <Row label="The “s”" value="currentColor" />
              <Row label="The “x”" value="--color-primary" />
              <Row label="Source" value="sparx-mark.svg" />
            </dl>
            <p style={{ ...note, margin: 0 }}>
              In product UI it renders via <code style={code}>&lt;SparxMark&gt;</code> from{' '}
              <code style={code}>@sparx/ui</code>. As a favicon — where CSS variables can’t resolve
              — each app ships a static <code style={code}>app/icon.svg</code> that inlines the hex
              plus a <code style={code}>prefers-color-scheme</code> rule.
            </p>
          </Panel>

          <Panel title="When to use it">
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '11px',
              }}
            >
              {USE.map((u) => (
                <li
                  key={u}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    lineHeight: '21px',
                    color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  }}
                >
                  <span aria-hidden style={{ color: 'var(--color-primary)' }}>
                    →
                  </span>
                  <span>{u}</span>
                </li>
              ))}
            </ul>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '28px',
                flexWrap: 'wrap',
                paddingTop: '4px',
              }}
            >
              {SIZES.map((s) => (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-base-content)',
                  }}
                >
                  <SparxMark size={s} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                    }}
                  >
                    {s}px
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

function Tile({
  label,
  background,
  ink,
  border,
}: {
  label: string;
  background: string;
  ink: string;
  border?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(40px, 7vw, 72px)',
          background,
          color: ink,
          border: border ? '1px solid var(--color-base-300)' : 'none',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <SparxMark size={72} />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '28px',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '15px',
          color: 'var(--color-base-content)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '13px 0',
        borderTop: '1px solid var(--color-base-300)',
      }}
    >
      <dt
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0 }}>
        <CopyValue value={value} tone="strong" />
      </dd>
    </div>
  );
}

const note: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13.5px',
  lineHeight: '21px',
  color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
};

const code: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12.5px',
  color: 'var(--color-base-content)',
  backgroundColor: 'var(--color-base-200)',
  padding: '1px 5px',
  borderRadius: 'var(--radius-sm)',
};
