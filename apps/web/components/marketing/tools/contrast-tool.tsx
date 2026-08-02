'use client';

import * as React from 'react';
import { Check, X, ArrowLeftRight } from 'lucide-react';
import {
  Badge,
  Button,
  List,
  ListColGrow,
  ListRow,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
} from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, HexColorField } from './ui-kit';
import { contrastRatio, rateContrast } from './lib/color';

/** One WCAG threshold and whether the current pair clears it. */
function Verdict({ label, pass }: { label: string; pass: boolean }) {
  return (
    <ListRow>
      <ListColGrow className="text-md">{label}</ListColGrow>
      <Badge color={pass ? 'success' : 'danger'} variant="soft" size="sm">
        {pass ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        {pass ? 'Pass' : 'Fail'}
      </Badge>
    </ListRow>
  );
}

/** Labeled hex entry — the shared swatch+input control inside a `Field`. */
function HexField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  id: string;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <HexColorField id={id} label={label} value={value} onChange={onChange} />
    </Field>
  );
}

export function ContrastTool() {
  const [fg, setFg] = React.useState('#3F3F46');
  const [bg, setBg] = React.useState('#FFFFFF');

  const ratio = contrastRatio(fg, bg) ?? 1;
  const rating = rateContrast(ratio);
  const summary = rating.normalAAA
    ? 'Clears every WCAG level'
    : rating.normalAA
      ? 'Clears AA for all text sizes'
      : rating.largeAA
        ? 'Large text only — too low for body copy'
        : 'Below every WCAG level';

  return (
    <Workbench>
      <ControlsPane>
        <Panel
          title="Colors"
          action={
            <Button
              type="button"
              variant="ghost"
              color="neutral"
              size="sm"
              onClick={() => {
                setFg(bg);
                setBg(fg);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Swap
            </Button>
          }
        >
          <HexField id="contrast-fg" label="Text color" value={fg} onChange={setFg} />
          <HexField id="contrast-bg" label="Background color" value={bg} onChange={setBg} />
        </Panel>

        <Panel title="Preview">
          {/* The surface fill IS the color under test — the one legitimately
              dynamic value here; the hairline and radius come from utilities. */}
          <div
            className="border-base-300 flex flex-col gap-3 rounded-lg border p-7"
            style={{ backgroundColor: bg }}
          >
            <span className="text-md" style={{ color: fg }}>
              Normal text — the quick brown fox jumps over the lazy dog.
            </span>
            <span className="text-2xl font-bold" style={{ color: fg }}>
              Large text — Aa Bb Cc
            </span>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Contrast ratio">
          <Stats vertical className="w-full">
            <Stat>
              <StatTitle>Measured ratio</StatTitle>
              <StatValue className="text-module text-4xl">{ratio.toFixed(2)} : 1</StatValue>
              <StatDesc>{summary}</StatDesc>
            </Stat>
          </Stats>

          <List>
            <Verdict label="Normal text — AA (4.5:1)" pass={rating.normalAA} />
            <Verdict label="Normal text — AAA (7:1)" pass={rating.normalAAA} />
            <Verdict label="Large text — AA (3:1)" pass={rating.largeAA} />
            <Verdict label="Large text — AAA (4.5:1)" pass={rating.largeAAA} />
          </List>

          <p className="text-md m-0">
            Large text is 24px+, or 18.66px and bold. AA is the common legal and procurement bar;
            AAA is the stricter target for body text.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
