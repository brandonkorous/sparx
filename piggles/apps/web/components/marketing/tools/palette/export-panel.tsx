'use client';

import { useState } from 'react';
import {
    Button,
    Card,
    CardBody,
    Tabs,
    TabsList,
    TabsPanel,
    TabsTab,
} from '@wizeworks/silicaui-react';
import { faCheck, faDownload, faLink } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { CodeOut } from '../ui-kit';
import { copyText } from '../lib/download';
import { cssVars, plainList, scssVars, tailwindTheme } from './code';
import { silicaTheme } from './silica';
import { downloadCard, shareLink } from './share';
import type { Assignment, ContentInk } from './roles';
import type { Palette } from './model';

/** Getting it out, in whichever shape the next person needs. The link is first
 *  because it is the one a business owner uses — the other three are for whoever
 *  they send it to. */
export function ExportPanel({
    palette,
    roles,
    ink,
}: {
    palette: Palette;
    roles: Assignment;
    ink: ContentInk;
}) {
    const [copied, setCopied] = useState(false);

    const share = async () => {
        if (await copyText(shareLink(palette))) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Card>
            <CardBody>
                <h3 className="text-2xl font-extrabold">Take it with you</h3>
                <p className="text-base">
                    The link carries the whole palette, locks included — it is what to send your designer, and
                    what to keep in a note for yourself.
                </p>

                <div className="flex flex-wrap gap-3">
                    <Button color={copied ? 'success' : 'module'} size="lg" onClick={share}>
                        <Icon glyph={copied ? faCheck : faLink} className="size-5" aria-hidden />
                        {copied ? 'Link copied' : 'Copy the link'}
                    </Button>
                    {/* No `color` — uncolored resolves to `base-content` and stays right
              in both themes. `neutral` was the wrong answer here; a second hue
              beside the primary would have been the other wrong answer. */}
                    <Button variant="outline" size="lg" onClick={() => downloadCard(palette)}>
                        <Icon glyph={faDownload} className="size-5" aria-hidden />
                        Download it as a picture
                    </Button>
                </div>

                {/* silicaui first, because it is the one that does the most: a theme is
            one attribute and every control follows it. The rest are for a site
            that is not built on it. */}
                <Tabs defaultValue="silica" className="mt-2">
                    <TabsList>
                        <TabsTab value="silica">silicaui</TabsTab>
                        <TabsTab value="css">CSS</TabsTab>
                        <TabsTab value="tailwind">Tailwind</TabsTab>
                        <TabsTab value="scss">SCSS</TabsTab>
                        <TabsTab value="list">Just the codes</TabsTab>
                    </TabsList>
                    <TabsPanel value="silica">
                        <CodeOut
                            code={silicaTheme(palette, roles, ink)}
                            language="css"
                            hint="A whole theme. Paste it into your stylesheet and every button, badge, input and tab picks these up at once — there is nothing else to change. The readable ink on each color is worked out for you, so only the inks you changed yourself appear here."
                        />
                    </TabsPanel>
                    <TabsPanel value="css">
                        <CodeOut
                            code={cssVars(palette, roles)}
                            hint="Named by what each color does, so the names still make sense after you reorder them."
                        />
                    </TabsPanel>
                    <TabsPanel value="tailwind">
                        <CodeOut code={tailwindTheme(palette, roles)} />
                    </TabsPanel>
                    <TabsPanel value="scss">
                        <CodeOut code={scssVars(palette, roles)} />
                    </TabsPanel>
                    <TabsPanel value="list">
                        <CodeOut code={plainList(palette)} />
                    </TabsPanel>
                </Tabs>
            </CardBody>
        </Card>
    );
}
