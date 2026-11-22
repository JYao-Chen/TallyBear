import { registerHooks } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { LanguageProvider } from '../../src/components/LanguageProvider';
import { ThemeProvider } from '../../src/components/ThemeProvider';
// Static markup does not consume component styles.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.module.css'))
      return {
        format: 'module',
        source: 'export default new Proxy({}, { get: (_, key) => String(key) });',
        shortCircuit: true,
      };
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
const { default: Workspace } = await import('../../src/components/Workspace');
// Workspace reads the page from the URL, so render it inside a minimal app-router context.
const router: any = Object.fromEntries(
  ['push', 'replace', 'prefetch', 'back', 'forward', 'refresh'].map(k => [k, () => {}]),
);
const { ProfilePage, BooksPage, UsersPage } = await import('../../src/components/ManagementPages');
const { FamiliesPage } = await import('../../src/components/FamiliesPage');
const { AccountsPanel } = await import('../../src/components/AccountsPanel');
const { SchedulesPanel } = await import('../../src/components/SchedulesPanel');
const { QuickEntry } = await import('../../src/components/QuickEntry');
const noop = async () => {};
const cases: any = {
  workspace: (
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/">
        <Workspace />
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  ),
  profile: (
    <ProfilePage
      user={{ id: 'u', name: 'Alex', username: 'alex', avatar: '🧸', admin: true, theme: 'bear' }}
      onSaved={noop}
    />
  ),
  books: (
    <BooksPage
      books={[{ id: 'b', name: 'Personal', description: '', kind: 'private', icon: '📒', role: 'owner' }]}
      onSaved={noop}
      onSelect={() => {}}
    />
  ),
  users: <UsersPage />,
  families: <FamiliesPage userId="u" onChanged={noop} onOpenBook={() => {}} onManageBooks={() => {}} />,
  accounts: <AccountsPanel book="b" month="2026-09" onChanged={noop} />,
  schedules: <SchedulesPanel items={[]} accounts={[]} categories={[]} canWrite onChange={noop} />,
  entry: (
    <QuickEntry
      books={[]}
      book="b"
      accounts={[]}
      categories={[]}
      originals={[]}
      onCancel={() => {}}
      onSave={noop}
    />
  ),
};
let failed = false;
for (const [name, node] of Object.entries(cases)) {
  const html = renderToStaticMarkup(
    <LanguageProvider initial="en">
      <ThemeProvider initial="bear">{node as React.ReactNode}</ThemeProvider>
    </LanguageProvider>,
  );
  const remaining = html.match(/.{0,70}[\u3400-\u9fff][^<>]*/g);
  console.log(name, remaining || 'English UI OK');
  if (remaining) failed = true;
}
if (failed) process.exitCode = 1;
