// Live Chat settings — DTO mirror (docs/69 A-5).

export interface ChatConfig {
  aiEnabled: boolean;
  collectEmail: boolean;
  greeting: string;
  awayMessage: string;
  primaryColor: string | null;
  /** The legible "on primaryColor" color paired with it — see theme-colors.ts. */
  primaryColorContent: string | null;
  position: 'bottom-right' | 'bottom-left';
  operatingHours: {
    timezone: string;
    days: Record<string, { open: string; close: string } | null>;
  } | null;
}

export interface QuickReplyDto {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  createdAt: string;
  updatedAt: string;
}
