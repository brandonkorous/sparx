'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { saveConsentSettings } from './actions';

export interface ConsentConfig {
  mode: 'off' | 'gdpr' | 'ccpa';
  activeCategories: string[];
  bannerTitle: string | null;
  bannerBody: string | null;
  policyPageSlug: string;
  policyVersion: string;
  bannerEnabled: boolean;
}

const CATEGORIES: { key: string; label: string; desc: string }[] = [
  { key: 'preferences', label: 'Preferences', desc: 'Remember choices like language and theme.' },
  { key: 'analytics', label: 'Analytics', desc: 'Understand how the site is used.' },
  { key: 'marketing', label: 'Marketing', desc: 'Deliver and measure relevant offers.' },
];

const MODE_HELP: Record<ConsentConfig['mode'], string> = {
  off: 'No consent UI is shown. Only strictly-necessary cookies are used.',
  gdpr: 'Opt-in: non-essential cookies stay off until the visitor accepts.',
  ccpa: 'Opt-out: a "Do Not Sell or Share" control is shown; trackers default on.',
};

export function ConsentSettingsForm({ config }: { config: ConsentConfig }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const [mode, setMode] = React.useState<ConsentConfig['mode']>(config.mode);
  const [categories, setCategories] = React.useState<Set<string>>(new Set(config.activeCategories));
  const [bannerTitle, setBannerTitle] = React.useState(config.bannerTitle ?? '');
  const [bannerBody, setBannerBody] = React.useState(config.bannerBody ?? '');
  const [policySlug, setPolicySlug] = React.useState(config.policyPageSlug);

  const bannerEnabled =
    mode !== 'off' && [...categories].some((c) => c === 'analytics' || c === 'marketing');

  function toggle(key: string, on: boolean) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveConsentSettings({
        mode,
        activeCategories: [...categories],
        bannerTitle: bannerTitle.trim() || null,
        bannerBody: bannerBody.trim() || null,
        policyPageSlug: policySlug.trim() || 'cookie-policy',
      });
      if (!res.ok) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">Cookie consent</h3>
      <Card>
        <CardBody>
          <CardTitle>Consent mode</CardTitle>
          <p className="opacity-70">
            Controls the cookie banner on your site. The banner only appears when a non-essential
            category (analytics or marketing) is active.
          </p>
          <div className="flex flex-col gap-5">
            <Field>
              <FieldLabel>Mode</FieldLabel>
              <Select
                id="consent-mode"
                className="max-w-xs"
                value={mode}
                onValueChange={(val) => setMode(val as ConsentConfig['mode'])}
                items={{ off: 'Off', gdpr: 'GDPR (opt-in)', ccpa: 'CCPA (opt-out)' }}
              />
              <FieldDescription>{MODE_HELP[mode]}</FieldDescription>
            </Field>

            <div className="flex flex-col gap-2">
              <Label>Cookie categories in use</Label>
              <p className="text-base-content text-xs">
                Strictly-necessary cookies are always on. Enable the categories your site actually
                uses — enabling analytics or marketing turns the banner on.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-start gap-3">
                    <Checkbox
                      id={`consent-cat-${c.key}`}
                      checked={categories.has(c.key)}
                      onChange={(e) => toggle(c.key, e.target.checked)}
                    />
                    <Label htmlFor={`consent-cat-${c.key}`} className="font-normal">
                      <p className="font-medium">{c.label}</p>
                      <p className="text-base-content text-xs">{c.desc}</p>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Field className="max-w-xs">
              <FieldLabel>Cookie policy page slug</FieldLabel>
              <FieldControl
                name="consent-policy"
                value={policySlug}
                onChange={(e) => setPolicySlug(e.target.value)}
                placeholder="cookie-policy"
              />
            </Field>

            <Field>
              <FieldLabel>Banner title (optional)</FieldLabel>
              <FieldControl
                name="consent-title"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="We value your privacy"
              />
            </Field>

            <Field>
              <FieldLabel>Banner text (optional)</FieldLabel>
              <FieldControl
                name="consent-body"
                value={bannerBody}
                onChange={(e) => setBannerBody(e.target.value)}
                render={
                  <Textarea
                    rows={3}
                    placeholder="We use cookies to run this site and, with your consent, to improve it."
                  />
                }
              />
            </Field>

            <div className="flex items-center gap-3">
              <Button color="primary" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save consent settings'}
              </Button>
              <Badge color={bannerEnabled ? 'warning' : 'neutral'} variant="soft">
                {bannerEnabled ? 'Banner: shown' : 'Banner: quiet notice'}
              </Badge>
              {saved ? (
                <FieldStatus status="success" attached={false} aria-live="polite">
                  Saved.
                </FieldStatus>
              ) : null}
              {error ? (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
