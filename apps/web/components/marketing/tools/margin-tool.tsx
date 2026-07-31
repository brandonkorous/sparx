'use client';

import * as React from 'react';
import {
  Button,
  Input,
  NativeSelect,
  Stat,
  Stats,
  StatTitle,
  StatValue,
  Text,
} from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { CURRENCIES, formatMoney } from './lib/invoice';

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Stat>
      <StatTitle>{label}</StatTitle>
      <StatValue className={accent ? 'text-module' : undefined}>{value}</StatValue>
    </Stat>
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
          <div className="flex items-center justify-between gap-3">
            <Text as="span" className="text-ink-muted">
              Charge <strong>{money(priceForTarget)}</strong>
            </Text>
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
          <Stats className="w-full grid-flow-row grid-cols-1 sm:grid-cols-2">
            <Metric label="Profit margin" value={pct(margin)} accent />
            <Metric label="Markup" value={pct(markup)} />
            <Metric label="Profit per unit" value={money(profit)} />
            <Metric label="Break-even units" value={breakEven !== null ? String(breakEven) : '—'} />
          </Stats>
          <Text className="text-ink-muted m-0">
            Margin is profit as a share of price; markup is profit as a share of cost.{' '}
            {breakEven !== null
              ? `At ${money(profit)} profit per unit, you cover ${money(fixed)} of fixed costs after ${breakEven} units.`
              : 'Add fixed costs to see how many units you need to break even.'}
          </Text>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
