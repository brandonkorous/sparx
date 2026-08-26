'use client';

import { useState } from 'react';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { AreaField, CodeOut, Panel, TextField, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * Write the two lines Google shows, and see them before the page is live.
 *
 * ── THE COUNTER MEASURES PIXELS, NOT CHARACTERS ─────────────────────────────
 *
 * Every other tool counts characters and draws a bar at 60. Google truncates on
 * WIDTH, so "Illinois lilies" and "WOMAD Workshop" are nothing alike at the same
 * length — a title of capital Ws gets cut fifteen characters earlier than one of
 * lower-case l's. Measuring the rendered width is both more accurate and easier
 * to explain: the preview simply shows where it stops.
 */

const TITLE_LIMIT_PX = 580;
const DESCRIPTION_LIMIT_PX = 990;

export function MetaTool() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('https://bellacafe.example/menu');
  const [siteName, setSiteName] = useState('');

  const shownTitle = title || 'Your page title goes here';
  const shownDescription =
    description ||
    'The couple of lines underneath. This is your advert — say what somebody gets, not what the page contains.';

  const code = [
    `<title>${escapeHtml(title || 'Your page title')}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    '',
    '<!-- What appears when the link is shared -->',
    `<meta property="og:title" content="${escapeHtml(title || 'Your page title')}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:type" content="website">`,
    siteName ? `<meta property="og:site_name" content="${escapeHtml(siteName)}">` : '',
    `<meta property="og:image" content="${escapeHtml(originOf(url))}/share-image.png">`,
    '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  // The two lines go on their own, above the code, because they are the half
  // somebody wants to reread and rewrite. The code is for whoever puts it on the
  // site, which is often a different person on a different day.
  useReportToolResult(
    title.trim()
      ? {
          lines: [
            { label: 'Page title', value: title },
            ...(description.trim() ? [{ label: 'Description', value: description }] : []),
            { label: 'Page address', value: url },
            { label: 'Code to add', value: code },
          ],
          note: 'The code goes inside the <head> of that page. If you are not the one who does that, forward this to whoever looks after your site. Check the preview before you publish — search results cut off by width, so a title full of capitals gets shortened earlier than one without.',
        }
      : null
  );

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="What the page is" description="Both of these are shown in search results.">
            <TextField
              label="Page title"
              hint="Put the thing somebody would search for near the beginning, so it survives being shortened."
              value={title}
              onChange={setTitle}
              placeholder="Wood-fired pizza in Ancoats — Bella Cafe"
            />
            <MeasureBar text={title} limit={TITLE_LIMIT_PX} font="600 20px arial" label="title" />

            <AreaField
              label="Description"
              hint="Write it as an advert, not a summary. It does not affect your ranking — it decides whether the person who already found you clicks."
              value={description}
              onChange={setDescription}
              rows={3}
              placeholder="Sourdough pizza cooked over wood, three minutes from Ancoats tram. Walk-ins welcome, tables bookable from Thursday."
            />
            <MeasureBar
              text={description}
              limit={DESCRIPTION_LIMIT_PX}
              font="400 14px arial"
              label="description"
            />
          </Panel>

          <Panel title="Where it lives">
            <TextField
              label="Page address"
              value={url}
              onChange={setUrl}
              spellCheck={false}
              inputMode="url"
            />
            <TextField
              label="Business name (optional)"
              hint="Shown on the social card above the title."
              value={siteName}
              onChange={setSiteName}
            />
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">In a search result</h3>
              <div className="rounded-box border-base-300 mt-4 border bg-white p-5">
                <p className="truncate font-sans text-sm text-[#202124]">{prettyUrl(url)}</p>
                <p className="mt-1 font-sans text-xl leading-snug text-[#1a0dab]">
                  {truncateToWidth(shownTitle, TITLE_LIMIT_PX, '600 20px arial')}
                </p>
                <p className="mt-1 font-sans text-sm leading-relaxed text-[#4d5156]">
                  {truncateToWidth(shownDescription, DESCRIPTION_LIMIT_PX, '400 14px arial')}
                </p>
              </div>
              <p className="mt-3 text-base">
                Approximate — Google rewrites descriptions when it thinks another part of your page
                answers the search better. That is normal, and usually an improvement.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">When somebody shares it</h3>
              <div className="rounded-box border-base-300 mt-4 overflow-hidden border">
                <div className="bg-base-200 flex h-40 items-center justify-center">
                  <p className="text-base">Your share image goes here — 1200 × 630</p>
                </div>
                <div className="bg-base-100 p-4">
                  <p className="text-base">{originOf(url).replace(/^https?:\/\//, '')}</p>
                  <p className="mt-1 text-base font-bold">{shownTitle}</p>
                  <p className="mt-1 line-clamp-2 text-base">{shownDescription}</p>
                </div>
              </div>
              <p className="mt-3 text-base">
                Without an image, most apps show a bare link or grab whatever picture is nearest the
                top of the page. The share image maker builds a proper one.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">The code</h3>
              <p className="mt-2 text-base">Paste this inside the {'<head>'} of the page.</p>
              <div className="mt-4">
                <CodeOut code={code} language="html" />
              </div>
              <p className="mt-3 text-base">
                No keywords tag. Search engines stopped reading it many years ago after it was
                abused into meaninglessness, and every tool that still emits one is padding.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

/** Width-based length feedback, with the advice attached to the number. */
function MeasureBar({
  text,
  limit,
  font,
  label,
}: {
  text: string;
  limit: number;
  font: string;
  label: string;
}) {
  const width = measure(text, font);
  const pct = Math.min(100, (width / limit) * 100);
  const over = width > limit;
  const veryShort = width > 0 && width < limit * 0.4;

  return (
    <div>
      <div className="bg-base-300 h-2 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${over ? 'bg-warning' : 'bg-module'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-base">
        {text.length === 0 ? (
          `Nothing yet — an empty ${label} means the search engine writes one for you.`
        ) : over ? (
          <>
            <Badge color="warning" variant="soft">
              Will be cut off
            </Badge>{' '}
            Everything past this point gets replaced with an ellipsis. Make sure the important part
            is at the front.
          </>
        ) : veryShort ? (
          `Room for more. A short ${label} wastes space you have been given for free.`
        ) : (
          `Good length — this fits.`
        )}
      </p>
    </div>
  );
}

/**
 * Measure text the way a browser will render it.
 *
 * A canvas measures the same font the search result uses, which is the only way
 * to know where truncation lands. The canvas is created once and kept — making
 * one per keystroke is a surprising amount of garbage for a character counter.
 */
let measureCtx: CanvasRenderingContext2D | null = null;
function measure(text: string, font: string): number {
  if (typeof document === 'undefined') return text.length * 8;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 8;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

function truncateToWidth(text: string, limit: number, font: string): string {
  if (measure(text, font) <= limit) return text;
  let cut = text;
  while (cut.length > 0 && measure(`${cut}…`, font) > limit) cut = cut.slice(0, -1);
  // Trim back to a word boundary — Google does, and a preview that cuts
  // mid-syllable looks wrong in a way that distracts from the point.
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > cut.length - 12 && lastSpace > 0) cut = cut.slice(0, lastSpace);
  return `${cut.trimEnd()}…`;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'https://example.com';
  }
}

/** Google shows the path as breadcrumbs rather than as a raw address. */
function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return [parsed.hostname, ...parts].join(' › ');
  } catch {
    return url;
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
