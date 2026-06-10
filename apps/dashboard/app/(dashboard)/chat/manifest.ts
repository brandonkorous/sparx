import type { ModuleManifest } from '@sparx/ui/shell';
import { MessagesSquare, Inbox, Settings } from 'lucide-react';

// Live Chat module manifest (docs/56, docs/69 A-5). The shell renders this in
// the sidebar only when the tenant has the `chat` module active.
export const chatManifest: ModuleManifest = {
  id: 'chat',
  label: 'Live Chat',
  icon: MessagesSquare,
  routePrefix: '/chat',
  sections: [
    { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/chat' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings/chat' },
  ],
  actions: [],
  entityTypes: [],
};
