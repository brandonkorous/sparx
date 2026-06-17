'use client';

import * as React from 'react';
import { Button, Input, NativeSelect } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { CURRENCIES, formatMoney } from './lib/invoice';

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '18px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: 'var(--color-text-tertiary)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: '24px',
          letterSpacing: '-0.02em',
          color: accent ? 'var(--module-active)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function MarginTool() {
  const [currency, setCurrency] = React.useState('USD');
  const [cost, setCost] = React.useState('40');
  const [price, setPrice] = React.useState('100');
  const [targetMargin, setTargetMargin] = React.useState('60');
  const [fixedCosts, setFixedCosts] = React.useState('');

  const c = Number(cost) || 0;
  const p = Number(price) || 0;
  const profit = p - c;
  const margin = p > 0 ? (profit / p) * 100 : 0;
  const markup = c > 0 ? (profit / c) * 100 : 0;
  const tMargin = Number(targetMargin) || 0;
  const priceForTarget = tMargin < 100 ? c / (1 - tMargin / 100) : 0;
  const fixed = Number(fixedCosts) || 0;
  const breakEven = profit > 0 && fixed > 0 ? Math.ceil(fixed / profit) : null;
  const money = (n: number) => formatMoney(n, currency);
  const pct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Unit economics">
          <Field label="Currency" htmlFor="mc-cur">
            <NativeSelect
              id="mc-cur"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Unit cost" htmlFor="mc-cost" hint="What it costs you.">
              <Input
                id="mc-cost"
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            <Field label="Sale price" htmlFor="mc-price" hint="What you charge.">
              <Input
                id="mc-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Price for a target margin">
          <Field label="Target margin" htmlFor="mc-tm" adornment={`${tMargin}%`}>
            <Input
              id="mc-tm"
              type="number"
              min={0}
              max={99}
              step="1"
              value={targetMargin}
              onChange={(e) => setTargetMargin(e.target.value)}
            />
          </Field>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'var(--color-text-secondary)',
              }}
            >
              Charge{' '}
              <strong style={{ color: 'var(--color-text-primary)' }}>
                {money(priceForTarget)}
              </strong>
            </span>
            <Button
              type="button"
              color="module"
              variant="soft"
              size="sm"
              onClick={() => setPrice(priceForTarget.toFixed(2))}
            >
              Use this price
            </Button>
          </div>
        </Panel>

        <Panel title="Break-even">
          <Field label="Fixed costs" htmlFor="mc-fc" hint="One-off or monthly overhead to cover.">
            <Input
              id="mc-fc"
              type="number"
              min={0}
              step="0.01"
              value={fixedCosts}
              onChange={(e) => setFixedCosts(e.target.value)}
            />
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Results">
          <div className="tool-fieldgrid">
            <StatTile label="Profit margin" value={pct(margin)} accent />
            <StatTile label="Markup" value={pct(markup)} />
          </div>
          <div className="tool-fieldgrid">
            <StatTile label="Profit per unit" value={money(profit)} />
            <StatTile
              label="Break-even units"
              value={breakEven !== null ? String(breakEven) : '—'}
            />
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: '20px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            Margin is profit as a share of price; markup is profit as a share of cost.{' '}
            {breakEven !== null
              ? `At ${money(profit)} profit per unit, you cover ${money(fixed)} of fixed costs after ${breakEven} units.`
              : 'Add fixed costs to see how many units you need to break even.'}
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
