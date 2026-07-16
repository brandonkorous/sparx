'use client';

// Live Chat settings form (docs/69 A-5) — widget config + quick replies.
//
// Operating hours default to always-available (the backend supports a per-day
// schedule via the config blob; a richer scheduler UI is a future iteration).

import { useState, useTransition } from 'react';
import { cn, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Switch,
  Textarea,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Trash2 } from 'lucide-react';

import {
  createQuickReplyAction,
  deleteQuickReplyAction,
  updateChatSettingsAction,
} from '../actions';
import {
  DEFAULT_ACCENT_SWATCHES,
  readableContentOn,
  type ThemeColorSwatch,
} from '../_lib/theme-colors';
import type { AiProvider, ChatConfig, QuickReplyDto } from '../_lib/types';

const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
};

// api-rest-client wraps every thrown error as `api-rest request failed: ...
// (<server message>)` — fine for logs, not for a non-technical owner. Unwrap
// back to the server's own friendly text where possible.
function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = /\(([^()]+)\)\s*$/.exec(err.message);
  return match?.[1] ?? err.message;
}

export function ChatSettingsForm({
  initialConfig,
  initialQuickReplies,
  themeColors,
}: {
  initialConfig: ChatConfig;
  initialQuickReplies: QuickReplyDto[];
  /** The tenant's brand + saved-theme identity colors (docs/33) — however many
   *  the theme builder has produced, deduped by hex, each paired with its own
   *  `-content` color. Powers the accent-color swatch picker so the widget can
   *  match the site instead of a raw hex guess. */
  themeColors: ThemeColorSwatch[];
}): React.JSX.Element {
  const [config, setConfig] = useState<ChatConfig>(initialConfig);
  const [replies, setReplies] = useState<QuickReplyDto[]>(initialQuickReplies);
  const [qrTitle, setQrTitle] = useState('');
  const [qrBody, setQrBody] = useState('');
  const [qrShortcut, setQrShortcut] = useState('');
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const confirm = useConfirm();

  // AI assistant — the key itself never round-trips from the server (only
  // `aiKeyConfigured`), so a freshly-typed key lives in its own local field
  // and is sent to the server only when non-empty (see saveAi()).
  const [aiProvider, setAiProvider] = useState<AiProvider>(config.aiProvider ?? 'anthropic');
  const [aiApiKeyInput, setAiApiKeyInput] = useState('');
  const [aiSaving, startAiSaving] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSavedAt, setAiSavedAt] = useState<string | null>(null);

  function patch<K extends keyof ChatConfig>(key: K, value: ChatConfig[K]): void {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function saveAi(): void {
    setAiError(null);
    startAiSaving(async () => {
      try {
        const next = await updateChatSettingsAction({
          aiEnabled: config.aiEnabled,
          aiProvider,
          ...(aiApiKeyInput.trim() ? { aiApiKey: aiApiKeyInput.trim() } : {}),
        });
        setConfig(next);
        setAiApiKeyInput('');
        setAiSavedAt(new Date().toLocaleTimeString());
      } catch (err) {
        setAiError(friendlyErrorMessage(err, 'Could not save AI settings.'));
      }
    });
  }

  async function disconnectAi(): Promise<void> {
    const okToRemove = await confirm({
      title: 'Disconnect your AI provider?',
      description: 'AI first responses will turn off until you connect a key again.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!okToRemove) return;
    setAiError(null);
    startAiSaving(async () => {
      try {
        const next = await updateChatSettingsAction({ aiApiKey: null, aiEnabled: false });
        setConfig(next);
      } catch (err) {
        setAiError(friendlyErrorMessage(err, 'Could not disconnect.'));
      }
    });
  }

  // Picking a known theme swatch carries over the tenant's own -content
  // (foreground) decision for that role, instead of a guessed black/white — so
  // the widget text stays exactly as legible as it is on the tenant's own site.
  function pickAccentColor(hex: string): void {
    const known = themeColors.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
    const content = known?.content ?? readableContentOn(hex);
    setConfig((c) => ({ ...c, primaryColor: hex, primaryColorContent: content }));
  }

  function resetAccentColor(): void {
    setConfig((c) => ({ ...c, primaryColor: null, primaryColorContent: null }));
  }

  function saveConfig(): void {
    startSaving(async () => {
      const next = await updateChatSettingsAction(config);
      setConfig(next);
      setSavedAt(new Date().toLocaleTimeString());
    });
  }

  function addQuickReply(): void {
    if (!qrTitle.trim() || !qrBody.trim()) return;
    startSaving(async () => {
      const created = await createQuickReplyAction({
        title: qrTitle.trim(),
        body: qrBody.trim(),
        ...(qrShortcut.trim() ? { shortcut: qrShortcut.trim() } : {}),
      });
      setReplies((r) => [...r, created]);
      setQrTitle('');
      setQrBody('');
      setQrShortcut('');
    });
  }

  async function removeQuickReply(r: QuickReplyDto): Promise<void> {
    const ok = await confirm({
      title: `Delete quick reply "${r.title}"?`,
      description: 'This canned response will be removed for everyone on your team.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteQuickReplyAction(r.id);
    setReplies((list) => list.filter((x) => x.id !== r.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody>
          <CardTitle>Widget</CardTitle>
          <div className="flex flex-col gap-4">
            <label htmlFor="chat-collect-email" className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Pre-chat form</span>
                <span className="text-base-content block text-xs">
                  Ask anonymous visitors for a name and email before chatting.
                </span>
              </span>
              <Switch
                id="chat-collect-email"
                checked={config.collectEmail}
                onCheckedChange={(v) => patch('collectEmail', v)}
              />
            </label>
            <Field>
              <FieldLabel>Greeting</FieldLabel>
              <FieldControl
                value={config.greeting}
                onChange={(e) => patch('greeting', e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Away message</FieldLabel>
              <FieldControl
                render={<Textarea rows={2} />}
                value={config.awayMessage}
                onChange={(e) => patch('awayMessage', e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="mb-1 block text-sm font-medium">Accent color</span>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Accent color"
                >
                  {(themeColors.length > 0 ? themeColors : DEFAULT_ACCENT_SWATCHES).map(
                    (swatch) => {
                      const selected =
                        config.primaryColor?.toUpperCase() === swatch.hex.toUpperCase();
                      return (
                        <Tooltip key={swatch.hex} content={swatch.label}>
                          <button
                            type="button"
                            aria-label={swatch.label}
                            aria-pressed={selected}
                            onClick={() => pickAccentColor(swatch.hex)}
                            className={cn(
                              'h-8 w-8 rounded-full border transition-transform duration-100 hover:scale-110',
                              selected
                                ? 'border-module ring-module ring-offset-base-100 ring-2 ring-offset-2'
                                : 'border-base-300'
                            )}
                            style={{ backgroundColor: swatch.hex }}
                          />
                        </Tooltip>
                      );
                    }
                  )}
                  {config.primaryColor ? (
                    <Button type="button" variant="ghost" size="sm" onClick={resetAccentColor}>
                      Reset
                    </Button>
                  ) : null}
                </div>
                {themeColors.length > 0 ? (
                  <p className="text-base-content mt-1 text-xs">
                    Swatches match your site&rsquo;s brand and saved themes.
                  </p>
                ) : null}
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium">Position</span>
                <div className="flex gap-2">
                  {(['bottom-right', 'bottom-left'] as const).map((p) => (
                    <Button
                      key={p}
                      type="button"
                      color="module"
                      variant={config.position === p ? 'solid' : 'outline'}
                      size="sm"
                      onClick={() => patch('position', p)}
                    >
                      {p === 'bottom-right' ? 'Right' : 'Left'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button color="module" onClick={saveConfig} disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
              {savedAt ? <span className="text-base-content text-xs">Saved {savedAt}</span> : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-1 flex items-center gap-2">
            <CardTitle>AI assistant</CardTitle>
            {config.aiKeyConfigured ? (
              <Badge color="success" variant="soft" size="sm">
                Connected
              </Badge>
            ) : null}
          </div>
          <p className="text-base-content mb-4 text-sm">
            Bring your own AI to answer common questions in chat and escalate to your team when
            it&rsquo;s unsure. sparx never runs its own AI or sees your key beyond sending it
            straight to your chosen provider — you can disconnect anytime.
          </p>
          <div className="flex flex-col gap-4">
            <label
              htmlFor="chat-ai-enabled"
              className="flex items-center justify-between gap-4"
              title={
                !config.aiKeyConfigured ? 'Connect a provider below to turn this on.' : undefined
              }
            >
              <span>
                <span className="block text-sm font-medium">Let AI answer for you</span>
                <span className="text-base-content block text-xs">
                  Answers common questions automatically and hands off to your team when unsure.
                </span>
              </span>
              <Switch
                id="chat-ai-enabled"
                checked={config.aiEnabled}
                disabled={!config.aiKeyConfigured}
                onCheckedChange={(v) => {
                  patch('aiEnabled', v);
                  startAiSaving(async () => {
                    try {
                      const next = await updateChatSettingsAction({ aiEnabled: v });
                      setConfig(next);
                    } catch (err) {
                      patch('aiEnabled', !v);
                      setAiError(friendlyErrorMessage(err, 'Could not save.'));
                    }
                  });
                }}
              />
            </label>

            <div>
              <span className="mb-1 block text-sm font-medium">AI provider</span>
              <div className="flex gap-2">
                {(Object.keys(AI_PROVIDER_LABELS) as AiProvider[]).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    color="module"
                    variant={aiProvider === p ? 'solid' : 'outline'}
                    size="sm"
                    onClick={() => setAiProvider(p)}
                  >
                    {AI_PROVIDER_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>

            <Field>
              <FieldLabel>{config.aiKeyConfigured ? 'Replace API key' : 'API key'}</FieldLabel>
              <FieldControl
                type="password"
                autoComplete="off"
                placeholder={config.aiKeyConfigured ? 'Enter a new key to replace it' : 'sk-…'}
                value={aiApiKeyInput}
                onChange={(e) => setAiApiKeyInput(e.target.value)}
              />
              {aiError ? (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {aiError}
                </FieldStatus>
              ) : null}
            </Field>

            <div className="flex items-center gap-3">
              <Button color="module" onClick={saveAi} disabled={aiSaving || !aiApiKeyInput.trim()}>
                {aiSaving
                  ? 'Saving…'
                  : config.aiKeyConfigured
                    ? 'Update connection'
                    : 'Connect provider'}
              </Button>
              {config.aiKeyConfigured ? (
                <Button
                  type="button"
                  color="danger"
                  variant="ghost"
                  size="sm"
                  disabled={aiSaving}
                  onClick={() => void disconnectAi()}
                >
                  Disconnect
                </Button>
              ) : null}
              {aiSavedAt ? (
                <span className="text-base-content text-xs">Saved {aiSavedAt}</span>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <CardTitle>Quick replies</CardTitle>
          <div className="flex flex-col gap-4">
            {replies.length === 0 ? (
              <p className="text-base-content text-sm">No quick replies yet.</p>
            ) : (
              <ul className="divide-base-300 divide-y">
                {replies.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {r.title}
                        {r.shortcut ? (
                          <span className="text-base-content ml-2 text-xs">/{r.shortcut}</span>
                        ) : null}
                      </div>
                      <div className="text-base-content truncate text-xs">{r.body}</div>
                    </div>
                    <Button
                      type="button"
                      color="danger"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${r.title}`}
                      onClick={() => void removeQuickReply(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Field>
                <FieldLabel>Title</FieldLabel>
                <FieldControl
                  placeholder="Title"
                  value={qrTitle}
                  onChange={(e) => setQrTitle(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Shortcut</FieldLabel>
                <FieldControl
                  placeholder="Shortcut (e.g. hi)"
                  value={qrShortcut}
                  onChange={(e) => setQrShortcut(e.target.value)}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel>Reply text</FieldLabel>
                <FieldControl
                  render={<Textarea rows={2} />}
                  placeholder="Reply text…"
                  value={qrBody}
                  onChange={(e) => setQrBody(e.target.value)}
                />
              </Field>
              <Button
                color="module"
                variant="soft"
                className="sm:col-span-2"
                onClick={addQuickReply}
                disabled={saving || !qrTitle.trim() || !qrBody.trim()}
              >
                Add quick reply
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
