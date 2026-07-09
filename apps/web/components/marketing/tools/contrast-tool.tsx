'use client';

import * as React from 'react';
import { Check, X, ArrowLeftRight } from 'lucide-react';
import { ColorPicker } from '@sparx/ui';
import { Button, Badge } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { contrastRatio, rateContrast } from './lib/color';

function Verdict({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-base-300)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: 'var(--color-base-content)',
        }}
      >
        {label}
      </span>
      <Badge color={pass ? 'success' : 'danger'} variant="soft" size="sm">
        {pass ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        {pass ? 'Pass' : 'Fail'}
      </Badge>
    </div>
  );
}

export function ContrastTool() {
  const [fg, setFg] = React.useState('#3F3F46');
  const [bg, setBg] = React.useState('#FFFFFF');

  const ratio = contrastRatio(fg, bg) ?? 1;
  const rating = rateContrast(ratio);

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
          <Field label="Text color">
            <ColorPicker value={fg} onChange={setFg} ariaLabel="Text color" />
          </Field>
          <Field label="Background color">
            <ColorPicker value={bg} onChange={setBg} ariaLabel="Background color" />
          </Field>
        </Panel>

        <Panel title="Preview">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '28px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: bg,
              border: '1px solid var(--color-base-300)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: fg }}>
              Normal text — the quick brown fox jumps over the lazy dog.
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '24px',
                fontWeight: 700,
                color: fg,
              }}
            >
              Large text — Aa Bb Cc
            </span>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Contrast ratio">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: '44px',
                letterSpacing: '-0.03em',
                color: 'var(--color-module)',
              }}
            >
              {ratio.toFixed(2)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '20px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              : 1
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Verdict label="Normal text — AA (4.5:1)" pass={rating.normalAA} />
            <Verdict label="Normal text — AAA (7:1)" pass={rating.normalAAA} />
            <Verdict label="Large text — AA (3:1)" pass={rating.largeAA} />
            <Verdict label="Large text — AAA (4.5:1)" pass={rating.largeAAA} />
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: '20px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              margin: 0,
            }}
          >
            Large text is 24px+, or 18.66px and bold. AA is the common legal and procurement bar;
            AAA is the stricter target for body text.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
