'use client';

// The Email Builder's true-HTML preview (docs/52 Phase 2). Unlike the editor
// canvas (a WYSIWYG approximation in the dashboard's chrome), this renders the
// REAL email — the same table-based React Email HTML that ships — in an iframe,
// resolved in the tenant brand. It also carries the staff test-send.
//
// The HTML is fetched on open via the `previewEmail` server action (which renders
// the DRAFT body server-side), so the caller should flush the autosave before
// opening so the preview reflects the latest edits.

import * as React from 'react';
import { Monitor, Send, Smartphone } from 'lucide-react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  toast,
} from '@sparx/ui';

import { previewEmail, testSendEmail } from '../_lib/actions';

export interface EmailPreviewModalProps {
  emailId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailPreviewModal({ emailId, open, onOpenChange }: EmailPreviewModalProps) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [width, setWidth] = React.useState<'desktop' | 'mobile'>('desktop');
  const [to, setTo] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // Fetch the rendered HTML each time the modal opens (the draft may have changed).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHtml(null);
    setError(null);
    setLoading(true);
    void previewEmail(emailId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setHtml(res.data.html);
      else setError(res.error ?? 'Could not render the preview.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, emailId]);

  const sendTest = () => {
    const addr = to.trim();
    if (!addr) {
      toast.error('Enter a recipient email.');
      return;
    }
    setSending(true);
    void testSendEmail(emailId, addr).then((res) => {
      setSending(false);
      if (res.ok) toast.success(`Test sent to ${addr} — it should arrive shortly.`);
      else toast.error(res.error ?? 'Test send failed.');
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-3xl">
        <ModalHeader>
          <ModalTitle>Email preview</ModalTitle>
          <ModalDescription>
            The real, table-based HTML this email ships as — preview it desktop or mobile, and send
            a test copy to any address.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            <Button
              variant={width === 'desktop' ? 'soft' : 'ghost'}
              size="sm"
              leftIcon={<Monitor className="h-4 w-4" />}
              onClick={() => setWidth('desktop')}
            >
              Desktop
            </Button>
            <Button
              variant={width === 'mobile' ? 'soft' : 'ghost'}
              size="sm"
              leftIcon={<Smartphone className="h-4 w-4" />}
              onClick={() => setWidth('mobile')}
            >
              Mobile
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
              disabled={sending}
              className="w-56"
              aria-label="Test-send recipient"
            />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Send className="h-3.5 w-3.5" />}
              loading={sending}
              disabled={sending}
              onClick={sendTest}
            >
              Send test
            </Button>
          </div>
        </div>

        <div className="mt-3 flex justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-4">
          {loading ? (
            <div className="flex h-[600px] items-center justify-center text-sm text-[var(--color-text-muted)]">
              Rendering preview…
            </div>
          ) : error ? (
            <div className="flex h-[600px] items-center justify-center text-sm text-[var(--color-text-muted)]">
              {error}
            </div>
          ) : (
            <iframe
              title="Email preview"
              srcDoc={html ?? ''}
              className="h-[600px] rounded-sm border border-[var(--color-border-default)] bg-white"
              style={{
                width: width === 'mobile' ? 375 : '100%',
                maxWidth: width === 'mobile' ? 375 : 640,
              }}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
