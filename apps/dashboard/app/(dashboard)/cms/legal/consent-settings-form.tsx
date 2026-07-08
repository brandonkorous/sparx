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
  Input,
  Label,
  Select,
  Textarea,
} from 'silicaui-react';
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="consent-mode">Mode</Label>
              <Select
                id="consent-mode"
                className="max-w-xs"
                value={mode}
                onValueChange={(v) => setMode(v as ConsentConfig['mode'])}
                items={{ off: 'Off', gdpr: 'GDPR (opt-in)', ccpa: 'CCPA (opt-out)' }}
              />
              <p className="text-base-content/70 text-xs">{MODE_HELP[mode]}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Cookie categories in use</Label>
              <p className="text-base-content/70 text-xs">
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
                      <p className="text-base-content/70 text-xs">{c.desc}</p>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="consent-policy">Cookie policy page slug</Label>
              <Input
                id="consent-policy"
                value={policySlug}
                onChange={(e) => setPolicySlug(e.target.value)}
                placeholder="cookie-policy"
                className="max-w-xs"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="consent-title">Banner title (optional)</Label>
              <Input
                id="consent-title"
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="We value your privacy"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="consent-body">Banner text (optional)</Label>
              <Textarea
                id="consent-body"
                value={bannerBody}
                onChange={(e) => setBannerBody(e.target.value)}
                rows={3}
                placeholder="We use cookies to run this site and, with your consent, to improve it."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button color="primary" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save consent settings'}
              </Button>
              <Badge color={bannerEnabled ? 'warning' : 'neutral'} variant="soft">
                {bannerEnabled ? 'Banner: shown' : 'Banner: quiet notice'}
              </Badge>
              {saved ? <p className="text-base-content/70 text-sm">Saved.</p> : null}
              {error ? <p className="text-danger text-sm">{error}</p> : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
