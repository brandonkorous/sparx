'use client';

import { useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { useLocalStorage } from './lib/use-local-storage';
import { copyText } from './lib/download';
import { Aside, CodeOut, Panel, Problem, SelectField, TextField, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * Build a link that tells you where somebody came from.
 *
 * ── THE HISTORY IS THE POINT ────────────────────────────────────────────────
 *
 * The tags are case-sensitive and nothing warns you, so "Instagram" and
 *"instagram" become two rows in a report and each looks half as good as the
 * truth. Six weeks later nobody remembers which spelling they used.
 *
 * Keeping every link you have built on this device — and offering your own past
 * spellings as you type — solves the actual problem. The URL-assembly part was
 * never hard; the consistency is the whole job.
 */

interface SavedLink {
  url: string;
  built: string;
  campaign: string;
}

const PRESETS: { label: string; source: string; medium: string }[] = [
  { label: 'Instagram post', source: 'instagram', medium: 'social' },
  { label: 'Instagram bio link', source: 'instagram', medium: 'bio' },
  { label: 'Facebook post', source: 'facebook', medium: 'social' },
  { label: 'TikTok', source: 'tiktok', medium: 'social' },
  { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { label: 'Newsletter', source: 'newsletter', medium: 'email' },
  { label: 'Google Ads', source: 'google', medium: 'cpc' },
  { label: 'Meta Ads', source: 'facebook', medium: 'paid-social' },
  { label: 'Printed flyer', source: 'flyer', medium: 'print' },
  { label: 'Business card', source: 'card', medium: 'print' },
  { label: 'A partner’s website', source: 'partner', medium: 'referral' },
  { label: 'QR code in the shop', source: 'in-store', medium: 'qr' },
];

export function UtmTool() {
  const [base, setBase] = useState('');
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [term, setTerm] = useState('');
  const [saved, setSaved] = useLocalStorage<SavedLink[]>('piggles.tools.utm', []);

  const problems = useMemo(() => {
    const found: string[] = [];
    if (base && !/^https?:\/\//i.test(base)) {
      found.push(
        'The address needs to start with https:// — otherwise the link will not work when somebody taps it.'
      );
    }
    for (const [label, value] of [
      ['source', source],
      ['medium', medium],
      ['campaign', campaign],
    ] as const) {
      if (value !== value.toLowerCase()) {
        found.push(
          `“${value}” has capital letters in it. Analytics tools treat ${value} and ${value.toLowerCase()} as two different things, splitting one number in half. Lower case, always.`
        );
      }
      if (/\s/.test(value)) {
        found.push(
          `“${value}” has a space in it. Use a hyphen — spaces get mangled in a web address.`
        );
      }
      void label;
    }
    return found;
  }, [base, source, medium, campaign]);

  const built = useMemo(() => {
    if (!base) return '';
    try {
      const url = new URL(/^https?:\/\//i.test(base) ? base : `https://${base}`);
      const set = (key: string, value: string) => {
        if (value.trim()) url.searchParams.set(key, value.trim());
      };
      set('utm_source', source);
      set('utm_medium', medium);
      set('utm_campaign', campaign);
      set('utm_content', content);
      set('utm_term', term);
      return url.toString();
    } catch {
      return '';
    }
  }, [base, source, medium, campaign, content, term]);

  // The tags go out beside the link, not only buried inside it. Six weeks later
  // the question is never "what was the link" but "did I write instagram or
  // Instagram", and a spelled-out tag is the answer to that one.
  useReportToolResult(
    built
      ? {
          lines: [
            { label: 'Your tagged link', value: built },
            ...(source.trim() ? [{ label: 'Where it is going (source)', value: source }] : []),
            ...(medium.trim() ? [{ label: 'What kind of place (medium)', value: medium }] : []),
            ...(campaign.trim()
              ? [{ label: 'What you are running (campaign)', value: campaign }]
              : []),
            ...(content.trim() ? [{ label: 'Which version (content)', value: content }] : []),
            ...(term.trim() ? [{ label: 'Search words (term)', value: term }] : []),
          ],
          note: 'Use this link wherever you are sharing it, and use exactly these spellings next time. The tags are case-sensitive, so instagram and Instagram become two rows in your reports and each one looks half as good as the truth.',
        }
      : null
  );

  const knownSources = [
    ...new Set(saved.map((s) => new URL(s.url).searchParams.get('utm_source')).filter(Boolean)),
  ];

  return (
    <ToolLayout
      form={
        <>
          <Panel title="The link" description="Where you want people to land.">
            <TextField
              label="Web address"
              hint="The page on your own site. Never tag a link between two of your own pages — that wipes out the record of how they actually found you."
              value={base}
              onChange={setBase}
              spellCheck={false}
              inputMode="url"
              placeholder="https://bellacafe.example/menu"
            />
          </Panel>

          <Panel
            title="Where you are putting it"
            description="Pick the closest one and it fills in the first two."
          >
            <SelectField
              label="Ready-made"
              value=""
              onChange={(value) => {
                const preset = PRESETS.find((p) => p.label === value);
                if (preset) {
                  setSource(preset.source);
                  setMedium(preset.medium);
                }
              }}
              options={[
                { value: '', label: 'Choose one, or fill them in below' },
                ...PRESETS.map((p) => ({ value: p.label, label: p.label })),
              ]}
            />

            <TextField
              label="Source — where exactly"
              hint={
                knownSources.length > 0
                  ? `You have used: ${knownSources.join(', ')}. Match one of those rather than inventing a new spelling.`
                  : 'instagram, newsletter, the-flyer. The specific place it lives.'
              }
              value={source}
              onChange={setSource}
              spellCheck={false}
            />
            <TextField
              label="Medium — what kind of thing"
              hint="social, email, print, cpc. The category it belongs to, so you can ask “how is social doing?” as well as “how is Instagram doing?”."
              value={medium}
              onChange={setMedium}
              spellCheck={false}
            />
            <TextField
              label="Campaign — which push"
              hint="spring-menu, opening-week. What ties several links together as one effort."
              value={campaign}
              onChange={setCampaign}
              spellCheck={false}
            />
          </Panel>

          <Panel
            title="Telling two versions apart"
            description="Only needed if you are running the same campaign in two forms."
          >
            <TextField
              label="Content"
              hint="Which of two buttons, which of two images. Leave it empty unless you are comparing."
              value={content}
              onChange={setContent}
              spellCheck={false}
            />
            <TextField
              label="Term"
              hint="The keyword, for paid search. Most ad platforms fill this in for you — leave it alone unless yours does not."
              value={term}
              onChange={setTerm}
              spellCheck={false}
            />
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Your link</h3>
              {built ? (
                <>
                  <div className="mt-4">
                    <CodeOut code={built} />
                  </div>
                  <Button
                    color="module"
                    size="lg"
                    block
                    className="mt-4"
                    onClick={() => {
                      setSaved(
                        [
                          { url: built, built: new Date().toISOString(), campaign },
                          ...saved.filter((s) => s.url !== built),
                        ].slice(0, 25)
                      );
                      void copyText(built);
                    }}
                  >
                    Copy and keep it
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-base">
                  Put an address in on the left and the tagged version appears here.
                </p>
              )}

              {problems.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3">
                  {problems.map((p) => (
                    <Problem key={p}>{p}</Problem>
                  ))}
                </div>
              ) : null}

              <Aside>
                The tags are visible in the address bar and do nothing to the page — it opens
                exactly as normal. For something printed or read aloud, point a QR code at the
                tagged address instead; the tracking still works and nobody sees it.
              </Aside>
            </CardBody>
          </Card>

          {saved.length > 0 ? (
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold">Links you have built</h3>
                  <button
                    type="button"
                    className="text-base font-semibold underline underline-offset-4"
                    onClick={() => setSaved([])}
                  >
                    Forget them all
                  </button>
                </div>
                <p className="mt-1 text-base">
                  Kept on this device only. Copy the spelling from here rather than trusting your
                  memory in six weeks.
                </p>

                <ul className="mt-4 flex flex-col">
                  {saved.map((link) => (
                    <li
                      key={link.url}
                      className="border-base-300 flex items-start justify-between gap-3 border-b py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{link.url}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-base">
                          {link.campaign ? (
                            <Badge color="module" variant="soft">
                              {link.campaign}
                            </Badge>
                          ) : null}
                          <span>{new Date(link.built).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <Button size="sm" variant="soft" onClick={() => void copyText(link.url)}>
                        Copy
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      }
    />
  );
}
