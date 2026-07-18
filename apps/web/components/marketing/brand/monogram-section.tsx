import * as React from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { SparxMark } from '@sparx/ui';
import { Code, Section, SectionHeader, Text } from '../primitives';
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
      <div className="flex flex-col gap-14">
        <SectionHeader
          accent="var(--color-primary)"
          headline="The spark mark"
          lede="When the full wordmark won’t fit, the spark stands in on its own. One shape, one color — sparx Ember — the same brand moment as the wordmark’s “x”, holding from a hero down to a 16px favicon on any surface, light or dark."
        />

        <div className="mkt-grid-2-1">
          <Tile label="On light" theme="light" />
          <Tile label="On dark" theme="dark" />
        </div>

        <div className="mkt-grid-2-1">
          <Panel title="Anatomy">
            <dl className="m-0 flex flex-col">
              <Row label="Fill" value="--color-primary" />
              <Row label="Geometry" value="@sparx/brand · SPARK_PATH" />
              <Row label="Source" value="sparx-mark.svg" />
            </dl>
            <Text size={13.5}>
              In product UI it renders via <Code>&lt;Spark&gt;</Code> (or its{' '}
              <Code>&lt;SparxMark&gt;</Code> alias) from <Code>@sparx/ui</Code>, which draws the
              same path defined once in <Code>@sparx/brand</Code>. As a favicon — where CSS
              variables can’t resolve — each app ships a static <Code>app/icon.svg</Code> with the
              Ember hex inlined; one mark serves both light and dark.
            </Text>
          </Panel>

          <Panel title="When to use it">
            <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
              {USE.map((u) => (
                <Text as="li" key={u} size={14} className="flex gap-2.5">
                  <span aria-hidden className="text-primary">
                    →
                  </span>
                  <span>{u}</span>
                </Text>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-7 pt-1">
              {SIZES.map((s) => (
                <div key={s} className="text-base-content flex flex-col items-center gap-2">
                  <SparxMark size={s} />
                  <Text as="span" mono size={11} tone="subtle">
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

// Specimen tile: the mark on a light vs dark surface. Each is its own
// data-theme island (base-100 flips to white / brand navy), so the mark shows
// on real token surfaces — no hardcoded backgrounds. The mark itself is a
// single Ember color across both, which is the point of the exhibit.
function Tile({ label, theme }: { label: string; theme: 'light' | 'dark' }) {
  return (
    <div className="flex flex-col gap-3">
      <Card data-theme={theme} className="bg-base-100">
        <CardBody className="flex items-center justify-center p-[clamp(40px,7vw,72px)]">
          <SparxMark size={72} />
        </CardBody>
      </Card>
      <Text as="span" size={13} tone="subtle">
        {label}
      </Text>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <Text as="h3" size={15} weight={500} tone="default">
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
