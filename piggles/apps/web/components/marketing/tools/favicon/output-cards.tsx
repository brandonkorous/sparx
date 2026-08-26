'use client';

import {
  Button,
  Card,
  CardBody,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from '@wizeworks/silicaui-react';
import { downloadBlob } from '../lib/download';
import type { FaviconOutput } from '../lib/favicon';
import { CodeOut } from '../ui-kit';

export function FileList({ output, working }: { output: FaviconOutput; working: boolean }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">Every size, ready to go</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {output.files.map((file) => (
            <div key={file.name} className="border-base-300 rounded-field border p-3">
              <p className="font-mono text-sm font-bold">{file.name}</p>
              <p className="mt-1 text-base">{file.note}</p>
            </div>
          ))}
        </div>

        <Button
          color="module"
          size="lg"
          block
          className="mt-6"
          disabled={working}
          onClick={async () => downloadBlob(await output.zip(), 'favicons.zip')}
        >
          {working ? 'Preparing…' : 'Download all of them'}
        </Button>
        <p className="mt-3 text-base">
          A zip with every file, the manifest, the markup to paste, and a plain-English note
          explaining where each one goes.
        </p>
      </CardBody>
    </Card>
  );
}

export function CodeToPaste({ output }: { output: FaviconOutput }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">The code to paste</h3>
        <Tabs defaultValue="html" className="mt-4">
          <TabsList>
            <TabsTab value="html">Any website</TabsTab>
            <TabsTab value="next">Next.js</TabsTab>
            <TabsTab value="manifest">The manifest</TabsTab>
          </TabsList>
          <TabsPanel value="html">
            <CodeOut
              code={output.html}
              hint="Goes inside the <head> of every page. Put the files themselves in the root folder of your site."
            />
          </TabsPanel>
          <TabsPanel value="next">
            <CodeOut code={output.nextjs} />
          </TabsPanel>
          <TabsPanel value="manifest">
            <CodeOut
              code={output.manifest}
              hint="Save this as site.webmanifest in your root folder."
            />
          </TabsPanel>
        </Tabs>
      </CardBody>
    </Card>
  );
}

export function WhatYouGet() {
  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-bold">What you will get</h3>
        <p className="mt-2 text-base">
          Six files and a manifest — the browser tab icon, the one iPhones put on a home screen, the
          two Android reads, a version with room around it for launchers that crop to a circle, and
          the multi-size <span className="font-mono">.ico</span> browsers ask for whether you link
          to it or not.
        </p>
        <p className="mt-3 text-base">
          Plus the exact lines to paste, in plain HTML and in the form modern frameworks expect.
        </p>
      </CardBody>
    </Card>
  );
}
