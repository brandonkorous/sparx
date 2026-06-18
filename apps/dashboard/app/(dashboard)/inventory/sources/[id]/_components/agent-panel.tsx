'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Copy, Check } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
} from '@sparx/ui';

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
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<IssuedKey | null>(null);
  const [unpairOpen, setUnpairOpen] = React.useState(false);

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

  function unpair() {
    setError(null);
    startTransition(async () => {
      const result = await revokeAgentAction(sourceId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setUnpairOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={2}>
          <Stack gap={1}>
            <Stack direction="row" align="center" gap={2}>
              <Cpu className="size-5" />
              <Heading level={3}>Bridge agent</Heading>
            </Stack>
            <CardDescription>
              The on-prem agent reads stock from your local ERP and pushes it to sparx over outbound
              HTTPS. Pair it to mint a key, then install the bridge on a machine on your network.
            </CardDescription>
          </Stack>
          {health.agentEnrolled ? (
            <Badge color={health.agentOnline ? 'success' : 'danger'} variant="soft">
              {health.agentOnline ? 'Online' : 'Offline'}
            </Badge>
          ) : (
            <Badge color="neutral" variant="soft">
              Not paired
            </Badge>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {health.agentEnrolled ? (
            <>
              <Stack direction="row" gap={3} wrap>
                <Tile label="Key" value={`${health.apiKeyPrefix ?? '—'}…`} mono />
                <Tile label="Paired" value={formatDateTime(health.enrolledAt)} />
                <Tile
                  label="Last seen"
                  value={formatDateTime(health.agentLastSeenAt)}
                  emphasis={!health.agentOnline}
                />
                <Tile label="Agent version" value={health.agentVersion ?? '—'} />
              </Stack>
              <Stack direction="row" gap={2} wrap>
                <Button color="module" variant="soft" onClick={pair} disabled={pending}>
                  {pending ? 'Working…' : 'Rotate key'}
                </Button>
                <Button color="danger" variant="ghost" onClick={() => setUnpairOpen(true)}>
                  Unpair
                </Button>
              </Stack>
              <Text size="xs" variant="muted">
                Rotating issues a new key and revokes the old one — update the bridge config with
                the new key to keep it connected.
              </Text>
            </>
          ) : (
            <Stack direction="row" gap={2} align="center" wrap>
              <Button color="module" onClick={pair} disabled={pending}>
                {pending ? 'Pairing…' : 'Pair agent'}
              </Button>
            </Stack>
          )}

          {error ? (
            <Text size="sm" className="text-[var(--color-danger)]">
              {error}
            </Text>
          ) : null}
        </Stack>
      </CardContent>

      <KeyModal sourceId={sourceId} issued={issued} onClose={() => setIssued(null)} />

      <AlertDialog
        open={unpairOpen}
        onOpenChange={(open) => {
          if (!open) setError(null);
          setUnpairOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpair the bridge agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes the agent&apos;s key — it will stop syncing immediately. Existing stock
              levels and mappings are kept. You can pair a new agent at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button color="danger" disabled={pending} onClick={unpair}>
              {pending ? 'Unpairing…' : 'Unpair'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <Stack
      gap={1}
      className="min-w-[10rem] flex-1 rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text
        size="sm"
        className={`${mono ? 'font-mono' : ''} ${emphasis ? 'text-[var(--color-warning)]' : ''}`.trim()}
      >
        {value}
      </Text>
    </Stack>
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
    <Modal open={issued !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{issued?.rotated ? 'New bridge key' : 'Bridge paired'}</ModalTitle>
          <ModalDescription>
            Copy this configuration into the bridge agent now — the key is shown{' '}
            <strong>once</strong> and can&apos;t be retrieved later.
          </ModalDescription>
        </ModalHeader>
        <Stack gap={3}>
          <CodeBlock text={snippet} />
          <Text size="xs" variant="muted">
            Set <span className="font-mono">SPARX_BASE_URL</span> to your sparx API URL. See the
            bridge README for install + the local-export setup.
          </Text>
          <Stack direction="row" justify="end">
            <Button color="module" onClick={onClose}>
              I&apos;ve saved it
            </Button>
          </Stack>
        </Stack>
      </ModalContent>
    </Modal>
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
    <Stack
      gap={2}
      className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
    >
      <pre className="overflow-x-auto font-mono text-xs break-all whitespace-pre-wrap">{text}</pre>
      <Stack direction="row" justify="end">
        <Button
          size="sm"
          variant="ghost"
          onClick={copy}
          leftIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Stack>
    </Stack>
  );
}
