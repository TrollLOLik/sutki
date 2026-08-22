import type { LucideIcon } from 'lucide-react';

export type ProfileSettingsTab = 'basic' | 'security';
export type ContactTarget = 'email' | 'phone';
export type ProfileDialog = 'contact-confirm' | 'contact-verify' | 'contact-input' | 'contact-new-verify' | 'delete' | 'delete-blocked';

export interface ProfileActionItem {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  count?: number;
  onClick: () => void;
}

export interface ProfileActionGroup {
  title: string;
  items: ProfileActionItem[];
}
