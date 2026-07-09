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
import { Check, ClipboardCopy, Code2, Eye, Monitor, Send, Smartphone } from 'lucide-react';
import {
  Button,
  Code,
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
  // View mode: the rendered iframe, or the raw inline-styled HTML source (docs/98
  // §3.8 — for email, View HTML IS this self-contained, table-based publish HTML).
  const [view, setView] = React.useState<'render' | 'source'>('render');
  const [copied, setCopied] = React.useState(false);
  const [to, setTo] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // Fetch the rendered HTML each time the modal opens (the draft may have changed).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHtml(null);
    setError(null);
    setView('render');
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

  const copySource = () => {
    if (!html) return;
    void navigator.clipboard.writeText(html).then(
      () => {
        setCopied(true);
        toast.success('Email HTML copied to clipboard.');
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error('Could not copy — select the source and copy manually.')
    );
  };

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
            The real, table-based HTML this email ships as — preview it desktop or mobile, view and
            copy the inline-styled source, and send a test copy to any address.
          </ModalDescription>
        </ModalHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            <Button
              variant={view === 'render' ? 'soft' : 'ghost'}
              size="sm"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={() => setView('render')}
            >
              Preview
            </Button>
            <Button
              variant={view === 'source' ? 'soft' : 'ghost'}
              size="sm"
              leftIcon={<Code2 className="h-4 w-4" />}
              onClick={() => setView('source')}
            >
              HTML source
            </Button>
            {view === 'render' ? (
              <>
                <span className="bg-base-300 mx-1 w-px self-stretch" aria-hidden />
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
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <ClipboardCopy className="h-3.5 w-3.5" />
                  )
                }
                disabled={!html}
                onClick={copySource}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
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

        <div className="border-base-300 bg-base-200 mt-3 flex justify-center rounded-md border p-4">
          {loading ? (
            <div className="text-base-content/60 flex h-[600px] items-center justify-center text-sm">
              Rendering preview…
            </div>
          ) : error ? (
            <div className="text-base-content/60 flex h-[600px] items-center justify-center text-sm">
              {error}
            </div>
          ) : view === 'source' ? (
            <Code
              variant="block"
              className="h-[600px] w-full overflow-auto text-left whitespace-pre"
              aria-label="Email HTML source"
            >
              {html ?? ''}
            </Code>
          ) : (
            <iframe
              title="Email preview"
              srcDoc={html ?? ''}
              className="border-base-300 h-[600px] rounded-sm border bg-white"
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
