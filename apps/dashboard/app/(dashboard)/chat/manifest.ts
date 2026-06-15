import type { ModuleManifest } from '@sparx/ui/shell';
import { MessagesSquare, LayoutDashboard, Inbox, Settings } from 'lucide-react';

// Live Chat module manifest (docs/56, docs/69 A-5). The shell renders this in
// the sidebar only when the tenant has the `chat` module active. /chat is the
// founder overview; the working two-pane inbox lives at /chat/inbox.
export const chatManifest: ModuleManifest = {
  id: 'chat',
  label: 'Live Chat',
  icon: MessagesSquare,
  routePrefix: '/chat',
  sections: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, href: '/chat' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, href: '/chat/inbox' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/settings/chat' },
  ],
  actions: [],
  entityTypes: [],
};
