'use client';

// The email Inspector.
//
// With nothing selected it shows the EMAIL — its subject and the preview line an
// inbox prints beside it. Those are the two fields most likely to decide whether
// anything else in here is ever read, so they are what an author lands on rather
// than something behind a settings drawer with a second Save button.
//
// With a block selected it shows that block. One tab, not two: an email node has
// no class string, so there is no "design vs settings" split to make — every
// visual decision is a named field and they all live together.

import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type { EmailDoc } from '../../../documents/types';
import { useApply, useDoc, useDocSnapshot, useStudioHost } from '../../context';
import { findEmailNode } from '../../../email/walk';
import { emailRowLabel } from '../layers';
import { AreaRow, Group, TextRow, usePatch } from './fields';
import { BodyPanel, ColumnPanel, ColumnsPanel, LinkPanel, SectionPanel } from './panels-layout';
import {
  ButtonPanel,
  DividerPanel,
  HtmlPanel,
  ImagePanel,
  SocialPanel,
  SpacerPanel,
  TextPanel,
  VideoPanel,
} from './panels-content';

export function EmailInspector() {
  const doc = useDoc<EmailDoc>();
  const { selection } = useDocSnapshot();
  const host = useStudioHost();

  const id = selection[0];
  const node = id ? findEmailNode(doc.document.root, id) : undefined;

  return (
    <div className="h-full min-h-0 overflow-auto p-3">
      <div className="flex flex-col gap-4">
        {node ? (
          <>
            {/* Keyed by the selected node, because the panels are built from
                uncontrolled fields (fields.tsx: text commits on blur, so it cannot
                also be controlled). Without a remount, clicking a second block of
                the same kind leaves the FIRST one's words in the box, and typing
                into it writes them onto the second — silent loss of the paragraph
                the author never touched. One key here beats forty at the rows. */}
            <BlockPanel key={node.id} node={node} />
            <NameRow node={node} />
          </>
        ) : (
          <>
            <DocumentFields doc={doc} />
            {/* Email nodes are not the site's addressable ones, so a host gets the
                document-level ask only — no node, `isRoot` true. */}
            {host.inspectorPanels?.(undefined, {
              doc: { kind: 'email', id: doc.id },
              isRoot: true,
            })}
          </>
        )}
      </div>
    </div>
  );
}

/** The email's own name, and the two fields an inbox shows before anyone opens it. */
function DocumentFields({ doc }: { doc: EmailDoc }) {
  const apply = useApply();
  return (
    <Group title="This email">
      <TextRow
        key={`${doc.id}:name`}
        label="Name"
        value={doc.name}
        hint="How you find it in your list of emails. Nobody receiving it sees this."
        onCommit={(value) => {
          const name = value.trim();
          if (name) apply('Rename email', [{ kind: 'doc.rename', value: name }]);
        }}
      />
      <TextRow
        key={`${doc.id}:subject`}
        label="Subject"
        value={doc.document.subject}
        hint="What people see in their inbox list. Say the thing, do not tease it."
        onCommit={(value) => apply('Change subject', [{ kind: 'email.setSubject', value }])}
      />
      <AreaRow
        key={`${doc.id}:preheader`}
        label="Preview line"
        value={doc.document.preheader}
        rows={2}
        hint="The line printed after the subject. Left empty, inboxes show the first words of the email."
        onCommit={(value) => apply('Change preview line', [{ kind: 'email.setPreheader', value }])}
      />
    </Group>
  );
}

/** What this block is called in the Layers rail. Authoring metadata — it never
 *  reaches the sent email. */
function NameRow({ node }: { node: EmailNode }) {
  const patch = usePatch(node.id);
  if (node.kind === 'body') return null;
  return (
    <Group title="In the layer list">
      <TextRow
        key={`${node.id}:name`}
        label="Name"
        value={node.name ?? ''}
        placeholder={emailRowLabel(node)}
        hint="Only you see this. It tells two identical bands apart."
        onCommit={(value) => patch('Rename block', { name: value.trim() || undefined })}
      />
    </Group>
  );
}

function BlockPanel({ node }: { node: EmailNode }) {
  switch (node.kind) {
    case 'body':
      return <BodyPanel node={node} />;
    case 'section':
      return <SectionPanel node={node} />;
    case 'columns':
      return <ColumnsPanel node={node} />;
    case 'column':
      return <ColumnPanel node={node} />;
    case 'link':
      return <LinkPanel node={node} />;
    case 'text':
      return <TextPanel node={node} />;
    case 'button':
      return <ButtonPanel node={node} />;
    case 'image':
      return <ImagePanel node={node} />;
    case 'video':
      return <VideoPanel node={node} />;
    case 'divider':
      return <DividerPanel node={node} />;
    case 'spacer':
      return <SpacerPanel node={node} />;
    case 'social':
      return <SocialPanel node={node} />;
    case 'html':
      return <HtmlPanel node={node} />;
  }
}
