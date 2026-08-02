'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Alert, Button, Card, CardBody, Input, Switch } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { LegalDocument } from './legal-markdown';
import { buildPrivacyPolicy, buildTerms, type LegalData } from './lib/legal-templates';
import { downloadText } from './lib/download';
import { useLocalStorageState } from './lib/use-local-storage';

const DEFAULT: LegalData = {
  businessName: 'Acme Co.',
  website: 'https://acme.co',
  email: 'privacy@acme.co',
  effectiveDate: '',
  jurisdiction: 'California, USA',
  collectsAccount: true,
  collectsPayment: true,
  usesCookies: true,
  usesAnalytics: true,
  sharesThirdParties: true,
  gdpr: true,
  ccpa: true,
};

const TOGGLES: { key: keyof LegalData; label: string }[] = [
  { key: 'collectsAccount', label: 'Names & emails (accounts, contact)' },
  { key: 'collectsPayment', label: 'Payments' },
  { key: 'usesCookies', label: 'Cookies' },
  { key: 'usesAnalytics', label: 'Analytics' },
  { key: 'sharesThirdParties', label: 'Third-party service providers' },
  { key: 'gdpr', label: 'Serve EU / UK users (GDPR)' },
  { key: 'ccpa', label: 'Serve California users (CCPA)' },
];

export function PrivacyTool() {
  const [data, setData] = useLocalStorageState<LegalData>('sparx-legal', DEFAULT);
  const [doc, setDoc] = React.useState<'privacy' | 'terms'>('privacy');
  const set = (patch: Partial<LegalData>) => setData((p) => ({ ...p, ...patch }));

  const text = doc === 'privacy' ? buildPrivacyPolicy(data) : buildTerms(data);
  const filename = doc === 'privacy' ? 'privacy-policy.md' : 'terms-of-service.md';

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Your business">
          <div className="tool-fieldgrid">
            <Field label="Business name">
              <Input
                value={data.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <Input value={data.website} onChange={(e) => set({ website: e.target.value })} />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Contact email">
              <Input
                type="email"
                value={data.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="Effective date">
              <Input
                type="date"
                value={data.effectiveDate}
                onChange={(e) => set({ effectiveDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Governing law" hint="Where your business operates.">
            <Input
              value={data.jurisdiction}
              onChange={(e) => set({ jurisdiction: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel title="What applies to you">
          <div className="flex flex-col gap-2.5">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between gap-3">
                <span className="text-md">{t.label}</span>
                <Switch
                  checked={data[t.key] as boolean}
                  onCheckedChange={(c) => set({ [t.key]: c })}
                />
              </div>
            ))}
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Document" action={<DocSwitch doc={doc} onChange={setDoc} />}>
          {/* The rendered document is its own nested surface — silica `Card`
              supplies the hairline + radius, `p-0` lets the paper run to its
              edge, and `overflow-hidden` clips the paper to the corners. */}
          <Card className="overflow-hidden">
            <CardBody className="p-0">
              <LegalDocument text={text} />
            </CardBody>
          </Card>
          <div className="flex flex-wrap items-center gap-2.5">
            <CopyButton
              value={text}
              label="Copy markdown"
              toastLabel="Document copied"
              color="module"
              variant="solid"
            />
            <Button
              color="neutral"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadText(text, filename, 'text/markdown;charset=utf-8')}
            >
              <Download className="h-4 w-4" />
              Download .md
            </Button>
          </div>
          <Alert color="warning" variant="soft" size="sm">
            A strong starting point — review and adapt it to your business. This is not legal
            advice.
          </Alert>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}

function DocSwitch({
  doc,
  onChange,
}: {
  doc: 'privacy' | 'terms';
  onChange: (next: 'privacy' | 'terms') => void;
}) {
  return (
    <span className="inline-flex gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={doc === 'privacy' ? 'solid' : 'outline'}
        color={doc === 'privacy' ? 'module' : 'neutral'}
        onClick={() => onChange('privacy')}
      >
        Privacy
      </Button>
      <Button
        type="button"
        size="sm"
        variant={doc === 'terms' ? 'solid' : 'outline'}
        color={doc === 'terms' ? 'module' : 'neutral'}
        onClick={() => onChange('terms')}
      >
        Terms
      </Button>
    </span>
  );
}
