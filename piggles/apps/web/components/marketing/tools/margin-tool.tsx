'use client';

import { useState } from 'react';
import { Card, CardBody } from '@wizeworks/silicaui-react';
import { CURRENCIES, formatMoney } from './lib/document';
import { Aside, Panel, SelectField, TextField, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';
import { marginLines, MARGIN_NOTE } from './lib/margin-email';

/**
 * What should I charge?
 *
 * ── SOLVING FOR WHICHEVER ONE IS MISSING ────────────────────────────────────
 *
 * Most margin calculators have you enter cost and price and tell you the margin.
 * That is the easy direction and it is not the question people actually have.
 * The real question is "I want to make 40% — what do I charge?", which the same
 * three numbers answer from the other end.
 *
 * So the tool asks which number you are missing and works that one out. It is
 * the same arithmetic; the difference is entirely in not making somebody
 * rearrange an equation in their head, which is where the margin-versus-markup
 * confusion does most of its damage.
 */

type Solve = 'price' | 'margin' | 'cost';

const round = (n: number) => Math.round(n * 100) / 100;

export function MarginTool() {
  const [solve, setSolve] = useState<Solve>('price');
  const [currency, setCurrency] = useState('USD');
  const [cost, setCost] = useState('12.50');
  const [price, setPrice] = useState('29.99');
  const [targetMargin, setTargetMargin] = useState('45');
  const [fixedCosts, setFixedCosts] = useState('');

  const costNum = Number(cost) || 0;
  const priceNum = Number(price) || 0;
  const marginNum = Number(targetMargin) || 0;
  const fixedNum = Number(fixedCosts) || 0;

  // Work out the missing one, then derive everything else from the completed set
  // so there is only ever one source of truth for what the numbers are.
  let finalCost = costNum;
  let finalPrice = priceNum;

  if (solve === 'price') {
    // margin = (price - cost) / price ⟹ price = cost / (1 - margin)
    finalPrice = marginNum >= 100 ? 0 : round(costNum / (1 - marginNum / 100));
  } else if (solve === 'cost') {
    finalCost = round(priceNum * (1 - marginNum / 100));
  }

  const profit = round(finalPrice - finalCost);
  const margin = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
  const markup = finalCost > 0 ? (profit / finalCost) * 100 : 0;
  const breakEven = profit > 0 && fixedNum > 0 ? Math.ceil(fixedNum / profit) : null;

  const money = (n: number) => formatMoney(n, currency);
  const impossible = solve === 'price' && marginNum >= 100;

  useReportToolResult(
    !impossible && finalPrice > 0
      ? {
          lines: marginLines({
            currency,
            cost: finalCost,
            price: finalPrice,
            profit,
            margin,
            markup,
            fixedCosts: fixedNum,
            breakEven,
          }),
          note: MARGIN_NOTE,
        }
      : null
  );

  return (
    <ToolLayout
      form={
        <>
          <Panel title="What do you want to work out?">
            <SelectField
              label="The number I am missing"
              value={solve}
              onChange={(v) => setSolve(v)}
              options={[
                { value: 'price', label: 'What should I charge?' },
                { value: 'margin', label: 'What margin am I making?' },
                { value: 'cost', label: 'What can I afford to pay for it?' },
              ]}
            />
            <SelectField
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </Panel>

          <Panel
            title="The numbers"
            description="Only the ones the answer needs — the rest are worked out."
          >
            {solve !== 'cost' ? (
              <TextField
                label="What it costs you"
                hint="Everything that comes out of the sale: what you paid, the packaging, the postage, the payment fee. Not just the purchase price."
                inputMode="decimal"
                value={cost}
                onChange={setCost}
              />
            ) : null}

            {solve !== 'price' ? (
              <TextField
                label="What you sell it for"
                inputMode="decimal"
                value={price}
                onChange={setPrice}
              />
            ) : null}

            {solve !== 'margin' ? (
              <TextField
                label="The margin you want"
                hint="As a percentage of the selling price. If you are used to thinking in markup, the answer below shows both."
                inputMode="decimal"
                value={targetMargin}
                onChange={setTargetMargin}
              />
            ) : null}
          </Panel>

          <Panel
            title="Break even (optional)"
            description="Everything that happens whether you sell anything or not."
          >
            <TextField
              label="Your fixed costs each month"
              hint="Rent, software, insurance, wages — including your own. Leaving your own wage out is why a business can look profitable and feel poor."
              inputMode="decimal"
              value={fixedCosts}
              onChange={setFixedCosts}
            />
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              {impossible ? (
                <>
                  <h2 className="text-2xl font-extrabold">That margin cannot exist</h2>
                  <p className="mt-3 text-base">
                    A margin is a share of the selling price, so it can never reach 100% — that
                    would mean the item cost you nothing. If you are aiming above 50%, you may be
                    thinking of markup, which has no ceiling. Adding 100% to a $12.50 cost gives a
                    $25.00 price and a 50% margin.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold">
                    {solve === 'price'
                      ? 'Charge this'
                      : solve === 'cost'
                        ? 'Pay no more than this'
                        : 'You are making'}
                  </h2>
                  <p className="mt-1 text-5xl font-extrabold">
                    {solve === 'margin'
                      ? `${margin.toFixed(1)}%`
                      : money(solve === 'price' ? finalPrice : finalCost)}
                  </p>
                  <p className="mt-3 text-base">
                    {solve === 'margin'
                      ? `A ${margin.toFixed(1)}% margin is a ${markup.toFixed(1)}% markup — the same deal, described from the other end.`
                      : `That leaves ${money(profit)} on each one, which is a ${margin.toFixed(1)}% margin and a ${markup.toFixed(1)}% markup.`}
                  </p>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">All of it, on one sale</h3>
              <dl className="mt-4 flex flex-col gap-3">
                {[
                  ['What it costs you', money(finalCost)],
                  ['What you charge', money(finalPrice)],
                  ['Profit on each one', money(profit)],
                  ['Margin — share of the price', `${margin.toFixed(1)}%`],
                  ['Markup — added to the cost', `${markup.toFixed(1)}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-base-300 flex items-baseline justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <dt className="text-base">{label}</dt>
                    <dd className="font-mono text-lg font-bold">{value}</dd>
                  </div>
                ))}
              </dl>

              <Aside>
                <strong>Margin and markup are not the same number.</strong> Margin is measured
                against what you sold it for; markup against what it cost you. Aiming for a 50%
                margin by adding 50% leaves you short on every single sale.
              </Aside>
            </CardBody>
          </Card>

          {breakEven !== null ? (
            <Card>
              <CardBody>
                <h3 className="text-lg font-bold">Break even</h3>
                <p className="mt-2 text-4xl font-extrabold">{breakEven}</p>
                <p className="mt-2 text-base">
                  At {money(profit)} profit each, you need to sell {breakEven} a month before{' '}
                  {money(fixedNum)} of fixed costs are covered. Everything after that is yours.
                </p>
                <p className="mt-3 text-base">
                  That works out at about {Math.ceil(breakEven / 30)} a day, or{' '}
                  {Math.ceil(breakEven / 4.33)} a week.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <h3 className="text-lg font-bold">Break even</h3>
                <p className="mt-2 text-base">
                  Put your fixed monthly costs in and this works out how many you have to sell
                  before you are actually ahead. It is usually a smaller number than people fear,
                  and knowing it makes a slow week much less alarming.
                </p>
              </CardBody>
            </Card>
          )}
        </>
      }
    />
  );
}
