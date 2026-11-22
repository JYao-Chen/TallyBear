import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Home,
  ListOrdered,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { PageKey } from '@/lib/routes';

export const pageIcons: Record<PageKey, typeof Home> = {
  home: Home,
  entries: ListOrdered,
  entry: NotebookPen,
  insights: ChartNoAxesCombined,
  budget: ShieldCheck,
  activities: CalendarDays,
  accounts: Wallet,
  schedules: CalendarDays,
  families: Users,
  chat: Sparkles,
  profile: UserRound,
  settings: Settings,
  books: NotebookPen,
  users: ShieldCheck,
  help: BookOpen,
};
