import * as React from 'react';
import { Container, Display, Spark } from '../primitives';
import { OfficialWordmark, OfficialMark } from './assets';

interface Asset {
  name: string;
  format: string;
  href: string;
  bg: 'light' | 'dark';
  preview: React.ReactNode;
}

const ASSETS: Asset[] = [
  {
    name: 'Wordmark — color',
    format: 'SVG · vector',
    href: '/brand/sparx-wordmark.svg',
    bg: 'light',
    preview: <OfficialWordmark variant="color" style={{ width: '170px' }} />,
  },
  {
    name: 'Wordmark — reversed',
    format: 'SVG · for dark',
    href: '/brand/sparx-wordmark-light.svg',
    bg: 'dark',
    preview: <OfficialWordmark variant="light" style={{ width: '170px' }} />,
  },
  {
    name: 'Wordmark — black',
    format: 'SVG · one-color',
    href: '/brand/sparx-wordmark-black.svg',
    bg: 'light',
    preview: <OfficialWordmark variant="black" style={{ width: '170px' }} />,
  },
  {
    name: 'Wordmark — white',
    format: 'SVG · one-color',
    href: '/brand/sparx-wordmark-white.svg',
    bg: 'dark',
    preview: <OfficialWordmark variant="white" style={{ width: '170px' }} />,
  },
  {
    name: 'Wordmark — color',
    format: 'PNG · 512px',
    href: '/brand/sparx-wordmark.png',
    bg: 'light',
    preview: <OfficialWordmark variant="color" style={{ width: '170px' }} />,
  },
  {
    name: 'Monogram — color',
    format: 'SVG · vector',
    href: '/brand/sparx-mark.svg',
    bg: 'light',
    preview: <OfficialMark variant="color" size={56} />,
  },
  {
    name: 'Monogram — reversed',
    format: 'SVG · for dark',
    href: '/brand/sparx-mark-light.svg',
    bg: 'dark',
    preview: <OfficialMark variant="light" size={56} />,
  },
  {
    name: 'App icon',
    format: 'PNG · 512px',
    href: '/brand/sparx-mark.png',
    bg: 'light',
    preview: <OfficialMark variant="color" size={56} />,
  },
  {
    name: 'Favicon',
    format: 'ICO · multi-size',
    href: '/brand/sparx-favicon.ico',
    bg: 'light',
    preview: <OfficialMark variant="color" size={40} />,
  },
];

export function DownloadsSection() {
  return (
    <section
      id="downloads"
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
        scrollMarginTop: '80px',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '760px' }}>
          <Display size={72} lineHeight={68} color="#FFFFFF">
            Take the assets
            <Spark color="#818CF8" />
          </Display>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              lineHeight: '29px',
              color: '#A1A1AA',
              margin: 0,
            }}
          >
            The wordmark, monogram, and icon set, ready to drop in. Keep the “x” indigo, keep the
            clear space, and don’t recolor the letterforms. Need editable source, a one-color
            variant, or something bespoke? Email{' '}
            <a href="mailto:brand@sparx.works" style={{ color: '#fff' }}>
              brand@sparx.works
            </a>
            .
          </p>
        </div>

        <div className="mkt-grid-3-2-1">
          {ASSETS.map((a) => (
            <a
              key={`${a.name}-${a.format}`}
              href={a.href}
              download
              style={{
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                border: '1px solid #2A2A2A',
                borderRadius: 'var(--radius-xl)',
                overflow: 'hidden',
                backgroundColor: '#0F0F0F',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '120px',
                  padding: '28px',
                  borderBottom: '1px solid #1A1A1A',
                  backgroundColor: a.bg === 'light' ? '#FFFFFF' : '#0A0A0A',
                }}
              >
                {a.preview}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '16px 20px',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '14px', color: '#FFFFFF' }}>
                    {a.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#52525B' }}>
                    {a.format}
                  </span>
                </span>
                <span aria-hidden style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#818CF8' }}>
                  Download ↓
                </span>
              </div>
            </a>
          ))}
        </div>

        <div
          className="mkt-cluster"
          style={{
            justifyContent: 'space-between',
            gap: '24px',
            paddingTop: '32px',
            borderTop: '1px solid #1A1A1A',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#52525B' }}>
            © 2026 WizeWorks, Inc. · sparx is a registered trademark of WizeWorks.
          </span>
          <a
            href="mailto:brand@sparx.works"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#A1A1AA', textDecoration: 'none' }}
          >
            brand@sparx.works
          </a>
        </div>
      </Container>
    </section>
  );
}
