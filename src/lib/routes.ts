// Every workspace page has a URL (docs/refactor/DESIGN-SYSTEM.md, 信息架构).
// Page keys are the pre-v3 names still used inside Workspace; paths are what users see.
export const pagePaths = {
  home: '/',
  entries: '/entries',
  entry: '/entry',
  insights: '/analysis',
  budget: '/analysis/budget',
  activities: '/analysis/activities',
  accounts: '/wallets',
  schedules: '/wallets/plans',
  families: '/family',
  chat: '/assistant',
  profile: '/me',
  settings: '/settings',
  books: '/settings/books',
  users: '/settings/users',
  help: '/help',
} as const;
export type PageKey = keyof typeof pagePaths;

const aliases: Record<string, PageKey> = { records: 'entries' };
const byPath = new Map<string, PageKey>(Object.entries(pagePaths).map(([k, p]) => [p, k as PageKey]));

export function pathForPage(key: string): string {
  return pagePaths[(aliases[key] ?? key) as PageKey] ?? '/';
}
export function pageForPath(pathname: string | null): PageKey | null {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  return byPath.get(clean) ?? null;
}
export function isPagePath(segments: string[] = []) {
  return pageForPath('/' + segments.join('/')) !== null;
}

/** Primary navigation: five sections. A section is active for any of its pages. */
export const sections = [
  { key: 'home', label: '首页', pages: ['home', 'entry'] },
  { key: 'entries', label: '流水', pages: ['entries'] },
  { key: 'insights', label: '分析', pages: ['insights', 'budget', 'activities'] },
  { key: 'accounts', label: '钱包与计划', pages: ['accounts', 'schedules'] },
  { key: 'families', label: '家庭', pages: ['families'] },
] as const satisfies readonly { key: PageKey; label: string; pages: readonly PageKey[] }[];

/** Tabs shown at the top of grouped pages. */
export const subPages: Partial<Record<PageKey, readonly { key: PageKey; label: string; admin?: boolean }[]>> =
  (() => {
    const analysis = [
      { key: 'insights', label: '收支分析' },
      { key: 'budget', label: '预算' },
      { key: 'activities', label: '活动' },
    ] as const;
    const wallets = [
      { key: 'accounts', label: '钱包资产' },
      { key: 'schedules', label: '计划与分摊' },
    ] as const;
    const settings = [
      { key: 'settings', label: '账本设置' },
      { key: 'books', label: '账本管理' },
      { key: 'users', label: '用户管理', admin: true },
    ] as const;
    const map: Partial<Record<PageKey, readonly { key: PageKey; label: string; admin?: boolean }[]>> = {};
    for (const group of [analysis, wallets, settings]) for (const p of group) map[p.key] = group;
    return map;
  })();

export function sectionOf(page: PageKey) {
  return sections.find(s => (s.pages as readonly PageKey[]).includes(page))?.key;
}
