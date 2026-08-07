// The mail layer: everything about reading and writing email that involves no
// network, no database and no clock of its own (docs/144 §5.2–§5.3).
//
// api-rest holds the sockets and the credentials; this holds the understanding.
// The split is deliberate and it is the same one `@sparx/scheduling` uses for
// calendars — a protocol parser with no I/O is a protocol parser that can be
// tested against a captured real-world message in a millisecond.
//
// ONE PROTOCOL, NOT THREE. sparx connects mailboxes over IMAP and SMTP, and
// deliberately NOT over the Gmail API or Microsoft Graph. Reading mail through
// those needs Google's restricted-scope CASA assessment and Microsoft's
// publisher verification — an annual third-party security audit as the standing
// price of a mailbox connector, and a vendor with a veto over a feature our
// customers already paid for. IMAP reaches the same mailboxes: Gmail and
// Microsoft 365 both speak it, with an app password the tenant issues in their
// own account settings and can revoke the same way. One protocol also means one
// sync path to keep correct instead of three.

export * from './mime';
export * from './inbound';
export * from './rfc822';
export * from './imap';
export * from './smtp';
