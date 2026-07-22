import * as React from 'react';
import { CardBody } from '@wizeworks/silicaui-react';
// Server-safe class builder (package root is a 'use client' bundle).
import { clickableCardClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Spark, Text } from '../primitives';
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
    preview: <OfficialWordmark variant="color" className="w-[170px]" />,
  },
  {
    name: 'Wordmark — reversed',
    format: 'SVG · for dark',
    href: '/brand/sparx-wordmark-light.svg',
    bg: 'dark',
    preview: <OfficialWordmark variant="light" className="w-[170px]" />,
  },
  {
    name: 'Wordmark — black',
    format: 'SVG · one-color',
    href: '/brand/sparx-wordmark-black.svg',
    bg: 'light',
    preview: <OfficialWordmark variant="black" className="w-[170px]" />,
  },
  {
    name: 'Wordmark — white',
    format: 'SVG · one-color',
    href: '/brand/sparx-wordmark-white.svg',
    bg: 'dark',
    preview: <OfficialWordmark variant="white" className="w-[170px]" />,
  },
  {
    name: 'Wordmark — color',
    format: 'PNG · 512px',
    href: '/brand/sparx-wordmark.png',
    bg: 'light',
    preview: <OfficialWordmark variant="color" className="w-[170px]" />,
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
      data-theme="dark"
      className="px-page py-section-xl bg-base-100 scroll-mt-20"
    >
      <Container className="flex flex-col gap-14">
        <div className="flex max-w-[760px] flex-col gap-6">
          <Display size={72} lineHeight={68}>
            Take the assets
            <Spark />
          </Display>
          <Text size={18}>
            The wordmark, monogram, and icon set, ready to drop in. Keep the “x” its spark color,
            keep the clear space, and don’t recolor the letterforms. Need editable source, a
            one-color variant, or something bespoke? Email{' '}
            <a href="mailto:brand@sparx.works" className="text-base-content">
              brand@sparx.works
            </a>
            .
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((a) => (
            // A real <a> wearing the clickable-card classes, NOT
            // `<ClickableCard render={<a/>}>` — this is a Server Component, so a
            // `render` element crosses the RSC boundary as a lazy client
            // reference (its `.type` is undefined) and cloneElement throws.
            <a
              key={`${a.name}-${a.format}`}
              href={a.href}
              download
              // The whole band is a data-theme="dark" island, so the tile lifts off
              // the surface with token surfaces/borders — no literal dark hexes.
              className={clickableCardClasses({
                className: 'bg-base-200 overflow-hidden no-underline',
              })}
            >
              <CardBody className="flex flex-col p-0">
                <div
                  // Specimen stage: show the mark on a light vs dark surface as its
                  // own nested theme island, so both backgrounds are real tokens.
                  data-theme={a.bg}
                  className="border-base-300 bg-base-100 flex min-h-[120px] items-center justify-center border-b p-7"
                >
                  {a.preview}
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="flex flex-col gap-0.5">
                    <Text as="span" size={14} weight={500} tone="default">
                      {a.name}
                    </Text>
                    <Text as="span" mono size={11} tone="subtle">
                      {a.format}
                    </Text>
                  </span>
                  <span aria-hidden>
                    <Text as="span" size={13} color="var(--color-primary)">
                      Download ↓
                    </Text>
                  </span>
                </div>
              </CardBody>
            </a>
          ))}
        </div>

        <div className="border-base-300 flex flex-wrap items-center justify-between gap-6 border-t pt-8">
          <Text as="span" size={13} tone="subtle">
            © 2026 WizeWorks, Inc. · sparx is a registered trademark of WizeWorks.
          </Text>
          <a href="mailto:brand@sparx.works">
            <Text as="span" mono size={12} tone="muted" className="no-underline">
              brand@sparx.works
            </Text>
          </a>
        </div>
      </Container>
    </section>
  );
}
