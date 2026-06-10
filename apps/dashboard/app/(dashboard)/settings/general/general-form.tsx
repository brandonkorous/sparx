'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
  useConfirm,
} from '@sparx/ui';
import { Plus, X } from 'lucide-react';
import { updateGeneralSettings } from './actions';

// Site-wide social links — a SITE setting (not brand identity, not theme), so
// they survive a theme change (docs/45 §3). Stored as an ordered array of
// { platform, url }. The KNOWN platforms drive icon mapping on the storefront;
// an "Other" row carries a free-text label as its `platform`. The whole array
// is submitted as JSON in the hidden `socials` field, parsed by the action.
const KNOWN_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbrand' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourbrand' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourbrand' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourbrand' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourbrand' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourbrand' },
  { key: 'pinterest', label: 'Pinterest', placeholder: 'https://pinterest.com/yourbrand' },
  { key: 'threads', label: 'Threads', placeholder: 'https://threads.com/@yourbrand' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/15551234567' },
  { key: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/you.bsky.social' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/yourbrand' },
] as const;

const OTHER = '__other__';
const KNOWN_KEYS = new Set<string>(KNOWN_PLATFORMS.map((p) => p.key));

interface SocialRow {
  platform: string;
  url: string;
}

function placeholderFor(platform: string): string {
  return KNOWN_PLATFORMS.find((p) => p.key === platform)?.placeholder ?? 'https://…';
}

export interface GeneralFormProps {
  tenant: {
    name: string;
    email: string;
    slug: string;
    plan: string;
    socials: SocialRow[];
  };
}

export function GeneralForm({ tenant }: GeneralFormProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const [socials, setSocials] = React.useState<SocialRow[]>(() =>
    (tenant.socials ?? []).map((s) => ({ platform: s.platform, url: s.url }))
  );

  // Default a new row to the first named platform not already added; if every
  // named platform is in use, fall back to an "Other" row (empty label).
  const addRow = () =>
    setSocials((rows) => {
      const used = new Set(rows.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));
      const next = KNOWN_PLATFORMS.find((p) => !used.has(p.key));
      return [...rows, { platform: next ? next.key : '', url: '' }];
    });
  const removeRow = (index: number) => setSocials((rows) => rows.filter((_, i) => i !== index));
  const patchRow = (index: number, patch: Partial<SocialRow>) =>
    setSocials((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  // Named platforms already chosen across all rows — used to hide them from the
  // other rows' pickers so each named platform can only be added once.
  const usedKnown = new Set(socials.map((r) => r.platform).filter((p) => KNOWN_KEYS.has(p)));

  // Only complete rows are submitted; the action re-validates and the hidden
  // field carries the canonical array as JSON.
  const cleanedSocials = socials
    .map((r) => ({ platform: r.platform.trim(), url: r.url.trim() }))
    .filter((r) => r.platform && r.url);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    // A slug change moves the site's subdomain and breaks old links — confirm it.
    const slugValue = formData.get('slug');
    const newSlug = (typeof slugValue === 'string' ? slugValue : '').trim().toLowerCase();
    if (newSlug && newSlug !== tenant.slug) {
      const confirmed = await confirm({
        title: 'Change your site URL?',
        description: `Your site moves from ${tenant.slug}.sparx.zone to ${newSlug}.sparx.zone. Links to the old address will stop working.`,
        confirmLabel: 'Change URL',
        tone: 'danger',
      });
      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await updateGeneralSettings(formData);
      if (!result.ok) {
        setError(result.error ?? 'Could not save changes.');
        return;
      }
      setMessage('Settings saved.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>How your site identifies itself across Sparx.</CardDescription>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack gap={2}>
              <Label htmlFor="name">Site name</Label>
              <Input id="name" name="name" defaultValue={tenant.name} required />
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="email">Contact email</Label>
              <Input id="email" name="email" type="email" defaultValue={tenant.email} required />
              <Text size="xs" variant="muted">
                Receives billing and account notifications.
              </Text>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="slug">Site URL</Label>
              <Input id="slug" name="slug" defaultValue={tenant.slug} />
              <input type="hidden" name="originalSlug" value={tenant.slug} />
              <Text size="xs" variant="muted">
                Your subdomain — {tenant.slug}.sparx.zone. Lowercase letters, numbers, and hyphens;
                changing it moves your site and breaks links to the old address.
              </Text>
            </Stack>
            <Stack gap={2}>
              <Label htmlFor="plan">Plan</Label>
              <Input id="plan" name="plan" defaultValue={tenant.plan} disabled />
            </Stack>

            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}
            {message && (
              <Text size="sm" variant="success" role="status" aria-live="polite">
                {message}
              </Text>
            )}
          </Stack>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending} loading={pending}>
            Save changes
          </Button>
        </CardFooter>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Social links</CardTitle>
          <CardDescription>
            Add as many links as you like, in any order. Choose a platform for the right icon, or
            pick “Other” for anything else. These stay the same when you switch themes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* The whole list is submitted as JSON; the action parses + validates it. */}
          <input type="hidden" name="socials" value={JSON.stringify(cleanedSocials)} />

          <Stack gap={3}>
            {socials.length === 0 ? (
              <Text size="sm" variant="muted">
                No links yet.
              </Text>
            ) : (
              socials.map((row, index) => {
                const known = KNOWN_KEYS.has(row.platform);
                const selectValue = known ? row.platform : OTHER;
                // This row's own platform plus every platform not used elsewhere.
                const options = KNOWN_PLATFORMS.filter(
                  (p) => p.key === row.platform || !usedKnown.has(p.key)
                );
                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded-md border border-[var(--color-border-default)] p-3 sm:flex-row sm:items-start"
                  >
                    <div className="flex flex-col gap-2 sm:w-44">
                      <NativeSelect
                        aria-label="Platform"
                        value={selectValue}
                        onChange={(e) =>
                          patchRow(index, {
                            platform: e.target.value === OTHER ? '' : e.target.value,
                          })
                        }
                      >
                        {options.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.label}
                          </option>
                        ))}
                        <option value={OTHER}>Other…</option>
                      </NativeSelect>
                      {selectValue === OTHER && (
                        <Input
                          aria-label="Custom platform label"
                          value={row.platform}
                          onChange={(e) => patchRow(index, { platform: e.target.value })}
                          placeholder="Label (e.g. Discord)"
                        />
                      )}
                    </div>
                    <Input
                      aria-label="Link URL"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      className="flex-1"
                      value={row.url}
                      onChange={(e) => patchRow(index, { url: e.target.value })}
                      placeholder={placeholderFor(row.platform)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      color="neutral"
                      size="sm"
                      aria-label="Remove link"
                      onClick={() => removeRow(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}

            <div>
              <Button
                type="button"
                variant="soft"
                color="neutral"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={addRow}
              >
                Add link
              </Button>
            </div>
          </Stack>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending} loading={pending}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
