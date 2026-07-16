'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Copy, Check } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '@sparx/ui';

import { enrollAgentAction, revokeAgentAction } from '../../_lib/agent-actions';
import { formatDateTime, type SyncHealth } from './types';

// Tier A bridge agent panel (docs/100 P5d) — pair / rotate / unpair the on-prem
// bridge and surface its online/offline status. The minted key is shown ONCE in a
// modal (copy-then-dismiss); thereafter only the prefix is visible.

interface IssuedKey {
  apiKey: string;
  prefix: string;
  rotated: boolean;
}

export function AgentPanel({ sourceId, health }: { sourceId: string; health: SyncHealth }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<IssuedKey | null>(null);

  function pair() {
    setError(null);
    startTransition(async () => {
      const result = await enrollAgentAction(sourceId);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setIssued(result);
      router.refresh();
    });
  }

  function onUnpair() {
    void (async () => {
      const ok = await confirm({
        title: 'Unpair the bridge agent?',
        description:
          "This revokes the agent's key — it will stop syncing immediately. Existing stock levels and mappings are kept. You can pair a new agent at any time.",
        confirmLabel: 'Unpair',
        tone: 'danger',
      });
      if (!ok) return;
      setError(null);
      startTransition(async () => {
        const result = await revokeAgentAction(sourceId);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.refresh();
      });
    })();
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              <Cpu className="size-5" />
              <h3 className="text-xl font-semibold">Bridge agent</h3>
            </div>
            <p className="opacity-70">
              The on-prem agent reads stock from your local ERP and pushes it to sparx over outbound
              HTTPS. Pair it to mint a key, then install the bridge on a machine on your network.
            </p>
          </div>
          {health.agentEnrolled ? (
            <Badge color={health.agentOnline ? 'success' : 'danger'} variant="soft">
              {health.agentOnline ? 'Online' : 'Offline'}
            </Badge>
          ) : (
            <Badge color="neutral" variant="soft">
              Not paired
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {health.agentEnrolled ? (
            <>
              <div className="flex flex-row flex-wrap gap-3">
                <Tile label="Key" value={`${health.apiKeyPrefix ?? '—'}…`} mono />
                <Tile label="Paired" value={formatDateTime(health.enrolledAt)} />
                <Tile
                  label="Last seen"
                  value={formatDateTime(health.agentLastSeenAt)}
                  emphasis={!health.agentOnline}
                />
                <Tile label="Agent version" value={health.agentVersion ?? '—'} />
              </div>
              <div className="flex flex-row flex-wrap gap-2">
                <Button color="module" variant="soft" onClick={pair} disabled={pending}>
                  {pending ? 'Working…' : 'Rotate key'}
                </Button>
                <Button color="danger" variant="ghost" onClick={onUnpair} disabled={pending}>
                  Unpair
                </Button>
              </div>
              <p className="text-base-content text-xs">
                Rotating issues a new key and revokes the old one — update the bridge config with
                the new key to keep it connected.
              </p>
            </>
          ) : (
            <div className="flex flex-row flex-wrap items-center gap-2">
              <Button color="module" onClick={pair} disabled={pending}>
                {pending ? 'Pairing…' : 'Pair agent'}
              </Button>
            </div>
          )}

          {error ? <p className="text-danger text-sm">{error}</p> : null}
        </div>
      </CardBody>

      <KeyModal sourceId={sourceId} issued={issued} onClose={() => setIssued(null)} />
    </Card>
  );
}

function Tile({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="border-base-300 flex min-w-[10rem] flex-1 flex-col gap-1 rounded border px-3 py-2">
      <p className="text-base-content text-xs">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''} ${emphasis ? 'text-warning' : ''}`.trim()}>
        {value}
      </p>
    </div>
  );
}

// The show-once key + install snippet. Once dismissed the secret is unrecoverable.
function KeyModal({
  sourceId,
  issued,
  onClose,
}: {
  sourceId: string;
  issued: IssuedKey | null;
  onClose: () => void;
}) {
  const snippet = issued
    ? `SPARX_BASE_URL=https://api.sparx.works\nSPARX_SOURCE_ID=${sourceId}\nSPARX_API_KEY=${issued.apiKey}`
    : '';

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <div>
          <DialogTitle>{issued?.rotated ? 'New bridge key' : 'Bridge paired'}</DialogTitle>
          <DialogDescription>
            Copy this configuration into the bridge agent now — the key is shown{' '}
            <strong>once</strong> and can&apos;t be retrieved later.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-3">
          <CodeBlock text={snippet} />
          <p className="text-base-content text-xs">
            Set <span className="font-mono">SPARX_BASE_URL</span> to your sparx API URL. See the
            bridge README for install + the local-export setup.
          </p>
          <div className="flex flex-row justify-end">
            <Button color="module" onClick={onClose}>
              I&apos;ve saved it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded border p-3">
      <pre className="overflow-x-auto font-mono text-xs break-all whitespace-pre-wrap">{text}</pre>
      <div className="flex flex-row justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={copy}
          iconStart={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
