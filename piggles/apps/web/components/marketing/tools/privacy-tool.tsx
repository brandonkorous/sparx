'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@wizeworks/silicaui-react';
import {
  buildPrivacyPolicy,
  buildTerms,
  LEGAL_DISCLAIMER,
  type LegalInput,
} from './lib/legal-templates';
import { copyText, downloadText, safeFilename } from './lib/download';
import { useLocalStorage } from './lib/use-local-storage';
import { Aside, CheckField, Panel, SelectField, TextField, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/** The answers, in the same words the questions used. Keyed off the shape of
 *  `collects` so a new question here is a compile error rather than a line that
 *  quietly goes missing from the email. */
const COLLECTS_LABELS: Record<keyof LegalInput['collects'], string> = {
  contactForm: 'A contact form',
  accounts: 'People can create accounts',
  payments: 'You take payments',
  shipping: 'You send things to people',
  marketingEmail: 'A mailing list',
  analytics: 'Analytics',
  cookies: 'Cookies',
};

/**
 * A privacy policy and terms, from a few questions.
 *
 * ── THE OUTPUT IS SHOWN AS A DOCUMENT, NOT AS A TEXTAREA ────────────────────
 *
 * Every generator of this kind dumps the result into a scrolling box of
 * monospaced text, which makes it look like output rather than like something
 * you are about to publish under your own name. Rendering it as a readable
 * document is what gets somebody to actually read it before they use it — and
 * reading it is the entire point, because it is a statement about their business
 * that they are responsible for.
 */
export function PrivacyTool() {
  const [input, setInput] = useLocalStorage<LegalInput>('piggles.tools.legal', {
    businessName: '',
    websiteUrl: '',
    contactEmail: '',
    country: '',
    postalAddress: '',
    collects: {
      contactForm: true,
      accounts: false,
      payments: false,
      analytics: true,
      marketingEmail: false,
      cookies: true,
      shipping: false,
    },
    processors: [],
    retentionMonths: 24,
    effectiveDate: new Date().toISOString().slice(0, 10),
    sells: 'nothing',
    refundDays: 14,
  });
  const [processorText, setProcessorText] = useState('');

  const set = <K extends keyof LegalInput>(key: K, value: LegalInput[K]) =>
    setInput({ ...input, [key]: value });
  const setCollects = (key: keyof LegalInput['collects'], value: boolean) =>
    setInput({ ...input, collects: { ...input.collects, [key]: value } });

  const withProcessors = useMemo(
    () => ({
      ...input,
      processors: processorText
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean),
    }),
    [input, processorText]
  );

  const policy = useMemo(() => buildPrivacyPolicy(withProcessors), [withProcessors]);
  const terms = useMemo(() => buildTerms(withProcessors), [withProcessors]);
  const slug = safeFilename(input.businessName, 'policy');

  // Both documents run to thousands of words that an email would flatten into
  // one unreadable block, so the ANSWERS go instead. Come back with these and
  // both documents rebuild in seconds — and the answers are the part to reread.
  const covered = (Object.keys(COLLECTS_LABELS) as (keyof LegalInput['collects'])[])
    .filter((key) => input.collects[key])
    .map((key) => COLLECTS_LABELS[key]);

  useReportToolResult(
    input.businessName.trim()
      ? {
          lines: [
            { label: 'Business name', value: input.businessName },
            ...(input.websiteUrl.trim() ? [{ label: 'Website', value: input.websiteUrl }] : []),
            ...(input.contactEmail.trim()
              ? [{ label: 'Contact email', value: input.contactEmail }]
              : []),
            ...(input.country.trim() ? [{ label: 'Country', value: input.country }] : []),
            ...(input.effectiveDate
              ? [{ label: 'In force from', value: input.effectiveDate }]
              : []),
            {
              label: 'What your business does',
              value: covered.length > 0 ? covered.join(', ') : 'Nothing ticked yet',
            },
            { label: 'How long you keep things', value: `${input.retentionMonths} months` },
            ...(withProcessors.processors.length > 0
              ? [{ label: 'Services you use', value: withProcessors.processors.join(', ') }]
              : []),
          ],
          note: `Open the tool again with these answers and both documents come straight back, ready to download. ${LEGAL_DISCLAIMER}`,
        }
      : null
  );

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="Your business">
            <TextField
              label="Business name"
              value={input.businessName}
              onChange={(v) => set('businessName', v)}
            />
            <TextField
              label="Website"
              value={input.websiteUrl}
              onChange={(v) => set('websiteUrl', v)}
              inputMode="url"
              spellCheck={false}
              placeholder="bellacafe.example"
            />
            <TextField
              label="Email for privacy questions"
              hint="An address somebody actually reads. This is where a request to delete data arrives."
              value={input.contactEmail}
              onChange={(v) => set('contactEmail', v)}
              inputMode="email"
              spellCheck={false}
            />
            <TextField
              label="Country you operate from"
              hint="Decides whose law applies if there is ever a disagreement."
              value={input.country}
              onChange={(v) => set('country', v)}
            />
            <TextField
              label="Postal address (optional)"
              hint="Genuinely optional. If you work from home, you are not obliged to publish where you live."
              value={input.postalAddress}
              onChange={(v) => set('postalAddress', v)}
            />
          </Panel>

          <Panel
            title="What your site collects"
            description="Tick what is true. Each one adds the disclosure it needs."
          >
            <CheckField
              label="A contact form"
              hint="A name and an email address is personal information, and the obligation has no minimum size."
              checked={input.collects.contactForm}
              onChange={(v) => setCollects('contactForm', v)}
            />
            <CheckField
              label="People can create accounts"
              checked={input.collects.accounts}
              onChange={(v) => setCollects('accounts', v)}
            />
            <CheckField
              label="You take payments"
              checked={input.collects.payments}
              onChange={(v) => setCollects('payments', v)}
            />
            <CheckField
              label="You send things to people"
              hint="Which means holding a delivery address."
              checked={input.collects.shipping}
              onChange={(v) => setCollects('shipping', v)}
            />
            <CheckField
              label="A mailing list"
              checked={input.collects.marketingEmail}
              onChange={(v) => setCollects('marketingEmail', v)}
            />
            <CheckField
              label="Analytics"
              hint="Anything that counts visits — including the built-in stats your website host provides."
              checked={input.collects.analytics}
              onChange={(v) => setCollects('analytics', v)}
            />
            <CheckField
              label="Cookies"
              hint="If you have analytics, a shop or a login, you have cookies."
              checked={input.collects.cookies}
              onChange={(v) => setCollects('cookies', v)}
            />
          </Panel>

          <Panel
            title="Who else handles it"
            description="The part copied policies always get wrong."
          >
            <TextField
              label="Services you use"
              hint="Separate with commas. Your website host, payment provider, mailing list, analytics. Naming them is what a regulator or a business customer checks first."
              value={processorText}
              onChange={setProcessorText}
              placeholder="Stripe, Mailchimp, our website host"
            />
            <SelectField
              label="How long you keep enquiries"
              value={String(input.retentionMonths)}
              onChange={(v) => set('retentionMonths', Number(v))}
              options={[
                { value: '6', label: 'About six months' },
                { value: '12', label: 'About a year' },
                { value: '24', label: 'About two years' },
                { value: '36', label: 'About three years' },
                { value: '0', label: 'Only as long as needed' },
              ]}
            />
            <Aside>
              Records tied to a payment usually have to be kept for several years for tax reasons,
              whatever you choose here. The generated policy says so.
            </Aside>
          </Panel>

          <Panel title="If you sell things" description="Only used for the terms of service.">
            <SelectField
              label="You sell"
              value={input.sells}
              onChange={(v) => set('sells', v)}
              options={[
                { value: 'nothing', label: 'Nothing — the site is information only' },
                { value: 'goods', label: 'Physical things' },
                { value: 'services', label: 'Services or work' },
                { value: 'both', label: 'Both' },
              ]}
            />
            {input.sells !== 'nothing' ? (
              <SelectField
                label="Change-of-mind returns"
                value={String(input.refundDays)}
                onChange={(v) => set('refundDays', Number(v))}
                options={[
                  { value: '14', label: '14 days' },
                  { value: '28', label: '28 days' },
                  { value: '30', label: '30 days' },
                  { value: '0', label: 'No change-of-mind returns' },
                ]}
              />
            ) : null}
            <TextField
              label="Effective from"
              type="date"
              value={input.effectiveDate}
              onChange={(v) => set('effectiveDate', v)}
            />
          </Panel>
        </>
      }
      output={
        <>
          <Card>
            <CardBody>
              <p className="text-base">
                <strong>Before you use this:</strong> {LEGAL_DISCLAIMER}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Tabs defaultValue="privacy">
                <TabsList>
                  <TabsTab value="privacy">Privacy policy</TabsTab>
                  <TabsTab value="terms">Terms of service</TabsTab>
                </TabsList>

                <TabsPanel value="privacy">
                  <DocumentView text={policy} />
                  <Actions
                    text={policy}
                    filename={`${slug}-privacy-policy.md`}
                    label="privacy policy"
                  />
                </TabsPanel>

                <TabsPanel value="terms">
                  <DocumentView text={terms} />
                  <Actions text={terms} filename={`${slug}-terms.md`} label="terms" />
                </TabsPanel>
              </Tabs>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-bold">Read it before you publish it</h3>
              <p className="mt-2 text-base">
                This is a statement about your business that you are responsible for. It is written
                to be short enough that reading it is realistic — which is the whole reason it is
                not nine pages.
              </p>
              <p className="mt-3 text-base">
                Two things to check in particular: that the list of services you use is complete,
                and that the retention period matches what you actually do. Those are the two a
                regulator or an enterprise customer looks at first.
              </p>
            </CardBody>
          </Card>
        </>
      }
    />
  );
}

/**
 * The document, rendered as a document.
 *
 * A deliberately tiny Markdown reading — headings, bold, paragraphs, nothing
 * else — because the templates only ever produce those three things. Pulling in
 * a Markdown library to render output we generate ourselves would be a
 * dependency for a format we control both ends of.
 */
function DocumentView({ text }: { text: string }) {
  const blocks = text.split('\n\n');

  return (
    <div className="border-base-300 bg-base-100 rounded-box mt-4 max-h-[32rem] overflow-y-auto border p-6">
      {blocks.map((block, i) => {
        if (block.startsWith('# ')) {
          return (
            <h2 key={i} className="mt-8 text-2xl font-extrabold first:mt-0">
              {block.slice(2)}
            </h2>
          );
        }
        if (block.startsWith('## ')) {
          return (
            <h3 key={i} className="mt-7 text-lg font-bold">
              {block.slice(3)}
            </h3>
          );
        }
        return (
          <p key={i} className="mt-3 text-base leading-relaxed">
            {block
              .split(/(\*\*[^*]+\*\*)/)
              .map((part, j) =>
                part.startsWith('**') ? (
                  <strong key={j}>{part.slice(2, -2)}</strong>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
          </p>
        );
      })}
    </div>
  );
}

function Actions({ text, filename, label }: { text: string; filename: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <Button
        color={copied ? 'success' : 'module'}
        size="lg"
        onClick={async () => {
          if (await copyText(text)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? 'Copied' : `Copy the ${label}`}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => downloadText(text, filename, 'text/markdown')}
      >
        Download it
      </Button>
    </div>
  );
}
