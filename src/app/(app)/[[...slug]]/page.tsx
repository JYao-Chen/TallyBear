import { notFound } from 'next/navigation';
import { isPagePath } from '@/lib/routes';

// Pages not yet split into their own route files are rendered by Workspace from the pathname.
export default async function WorkspacePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  if (!isPagePath(slug)) notFound();
  return null;
}
