import * as React from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { AppIcon, SparxMark } from '@sparx/ui';
import { Code, Section, SectionHeader, Text } from '../primitives';
import { CopyValue } from './interactive';

const SIZES = [16, 24, 32, 48] as const;

const USE_MARK = [
  'Anywhere the full wordmark would fall below 16px',
  'Square avatars and social profile marks',
  'As a bullet, a list marker, or the close of a headline',
];

const USE_ICON = [
  'Favicons and browser tabs',
  'App icons and PWA install tiles',
  'Any square slot an operating system will crop for you',
];

export function MonogramSection() {
  return (
    <Section id="monogram" surface="page" padding="lg">
      <div className="flex flex-col gap-14">
        <SectionHeader
          accent="var(--color-primary)"
          headline="The mark"
          lede="When the full wordmark won’t fit, the “x” stands in on its own — the same letterform, the same brand moment. It comes in two forms: the mark, drawn in sparx Ember on whatever surface it lands on; and the app icon, where that same “x” is cut out of a solid Ember field and runs off all four edges."
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Tile label="The mark — on light" theme="light">
            <SparxMark size={72} />
          </Tile>
          <Tile label="The mark — on dark" theme="dark">
            <SparxMark size={72} />
          </Tile>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Tile label="The app icon — on light" theme="light">
            <AppIcon size={72} />
          </Tile>
          <Tile label="The app icon — on dark" theme="dark">
            <AppIcon size={72} />
          </Tile>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Panel title="Anatomy">
            <dl className="m-0 flex flex-col">
              <Row label="Mark fill" value="--color-primary" />
              <Row label="Icon field" value="--color-primary" />
              <Row label="Icon counter" value="--color-secondary" />
              <Row label="Geometry" value="@sparx/brand · SPARK_PATH" />
              <Row label="Source" value="sparx-mark.svg" />
            </dl>
            <Text size={13.5}>
              In product UI the mark renders via <Code>&lt;Spark&gt;</Code> (or its{' '}
              <Code>&lt;SparxMark&gt;</Code> alias) and the icon via <Code>&lt;AppIcon&gt;</Code> —
              both from <Code>@sparx/ui</Code>, drawing paths defined once in{' '}
              <Code>@sparx/brand</Code>. As a favicon, where CSS variables can’t resolve, each app
              ships static files with the hexes inlined, generated from that same geometry by{' '}
              <Code>scripts/generate-brand-icons.mjs</Code>.
            </Text>
          </Panel>

          <Panel title="When to use which">
            <UseList title="The mark" items={USE_MARK} />
            <UseList title="The app icon" items={USE_ICON} />
            <div className="flex flex-wrap items-end gap-7 pt-1">
              {SIZES.map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <AppIcon size={s} />
                  <Text as="span" mono size={11}>
                    {s}px
                  </Text>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Section>
  );
}

// Specimen tile: artwork on a light vs dark surface. Each is its own
// data-theme island (base-100 flips to white / brand navy), so the artwork shows
// on real token surfaces — no hardcoded backgrounds. The exhibit is that the mark
// is a single Ember color across both, and the icon carries its own field.
function Tile({
  label,
  theme,
  children,
}: {
  label: string;
  theme: 'light' | 'dark';
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card data-theme={theme} className="bg-base-100">
        <CardBody className="flex items-center justify-center p-[clamp(40px,7vw,72px)]">
          {children}
        </CardBody>
      </Card>
      <Text as="span" size={13}>
        {label}
      </Text>
    </div>
  );
}

function UseList({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Text as="h4" size={14} weight={500}>
        {title}
      </Text>
      <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
        {items.map((u) => (
          <Text as="li" key={u} size={14} className="flex gap-2.5">
            <span aria-hidden className="text-primary">
              →
            </span>
            <span>{u}</span>
          </Text>
        ))}
      </ul>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <Text as="h3" size={15} weight={500}>
          {title}
        </Text>
        {children}
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-base-300 flex items-center justify-between gap-4 border-t py-[13px]">
      <Text as="dt" size={14}>
        {label}
      </Text>
      <dd className="m-0">
        <CopyValue value={value} tone="strong" />
      </dd>
    </div>
  );
}
