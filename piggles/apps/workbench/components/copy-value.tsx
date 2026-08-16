'use client';

// One exact value the operator has to move somewhere else by hand — a DNS record,
// a webhook address, a signing secret.
//
// Shown as monospace and copyable because transcribing it by eye IS the failure mode:
// a single wrong character in a webhook URL fails silently (the processor posts into
// the void and orders never flip to paid), which is far more expensive to diagnose
// than it was to copy correctly.

import { useState } from 'react';
import { Button, useToast } from '@wizeworks/silicaui-react';
import { faCheck, faCopy } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

export function CopyValue({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Long enough to register, short enough that the button is ready again
      // before someone reaches for the next record.
      setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      // Clipboard access can be refused (permissions, insecure context). Saying
      // so beats a button that silently does nothing — the value is on screen
      // and can still be selected by hand.
      toast.add({
        title: 'Could not copy that',
        description: 'Select the text and copy it manually.',
        type: 'error',
      });
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      <code className="bg-base-200 min-w-0 flex-1 rounded px-2 py-1 font-mono text-sm break-all">
        {value}
      </code>
      <Button
        size="sm"
        variant="ghost"
        color="neutral"
        shape="square"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={() => {
          void copy();
        }}
      >
        {copied ? (
          <Icon glyph={faCheck} className="size-4" aria-hidden />
        ) : (
          <Icon glyph={faCopy} className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
