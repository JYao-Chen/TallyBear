import Workspace from '@/components/Workspace';
import type { ReactNode } from 'react';

// The workspace stays mounted across page navigations; each URL selects what it shows.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <Workspace>{children}</Workspace>;
}
