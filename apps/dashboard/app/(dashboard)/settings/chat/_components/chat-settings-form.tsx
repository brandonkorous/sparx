'use client';

// Live Chat settings form (docs/69 A-5) — widget config + quick replies.
//
// Operating hours default to always-available (the backend supports a per-day
// schedule via the config blob; a richer scheduler UI is a future iteration).

import { useState, useTransition } from 'react';
import { useConfirm } from '@sparx/ui';
import { Button, Card, CardBody, CardTitle, Input, Switch, Textarea } from 'silicaui-react';
import { Trash2 } from 'lucide-react';

import {
  createQuickReplyAction,
  deleteQuickReplyAction,
  updateChatSettingsAction,
} from '../actions';
import type { ChatConfig, QuickReplyDto } from '../_lib/types';

export function ChatSettingsForm({
  initialConfig,
  initialQuickReplies,
}: {
  initialConfig: ChatConfig;
  initialQuickReplies: QuickReplyDto[];
}): React.JSX.Element {
  const [config, setConfig] = useState<ChatConfig>(initialConfig);
  const [replies, setReplies] = useState<QuickReplyDto[]>(initialQuickReplies);
  const [qrTitle, setQrTitle] = useState('');
  const [qrBody, setQrBody] = useState('');
  const [qrShortcut, setQrShortcut] = useState('');
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const confirm = useConfirm();

  function patch<K extends keyof ChatConfig>(key: K, value: ChatConfig[K]): void {
    setConfig((c) => ({ ...c, [key]: value }));
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
            <label htmlFor="chat-ai-enabled" className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">AI first responses</span>
                <span className="block text-xs text-[var(--color-text-secondary)]">
                  Let AI answer common questions and escalate when unsure.
                </span>
              </span>
              <Switch
                id="chat-ai-enabled"
                checked={config.aiEnabled}
                onCheckedChange={(v) => patch('aiEnabled', v)}
              />
            </label>
            <label htmlFor="chat-collect-email" className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Pre-chat form</span>
                <span className="block text-xs text-[var(--color-text-secondary)]">
                  Ask anonymous visitors for a name and email before chatting.
                </span>
              </span>
              <Switch
                id="chat-collect-email"
                checked={config.collectEmail}
                onCheckedChange={(v) => patch('collectEmail', v)}
              />
            </label>
            <div>
              <span className="mb-1 block text-sm font-medium">Greeting</span>
              <Input value={config.greeting} onChange={(e) => patch('greeting', e.target.value)} />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Away message</span>
              <Textarea
                rows={2}
                value={config.awayMessage}
                onChange={(e) => patch('awayMessage', e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <div>
                <span className="mb-1 block text-sm font-medium">Accent color</span>
                <Input
                  type="text"
                  placeholder="#6366F1"
                  value={config.primaryColor ?? ''}
                  onChange={(e) => patch('primaryColor', e.target.value || null)}
                />
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
              {savedAt ? (
                <span className="text-xs text-[var(--color-text-secondary)]">Saved {savedAt}</span>
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
              <p className="text-sm text-[var(--color-text-secondary)]">No quick replies yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {replies.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {r.title}
                        {r.shortcut ? (
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            /{r.shortcut}
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-[var(--color-text-secondary)]">
                        {r.body}
                      </div>
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
              <Input
                placeholder="Title"
                value={qrTitle}
                onChange={(e) => setQrTitle(e.target.value)}
              />
              <Input
                placeholder="Shortcut (e.g. hi)"
                value={qrShortcut}
                onChange={(e) => setQrShortcut(e.target.value)}
              />
              <Textarea
                className="sm:col-span-2"
                rows={2}
                placeholder="Reply text…"
                value={qrBody}
                onChange={(e) => setQrBody(e.target.value)}
              />
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
