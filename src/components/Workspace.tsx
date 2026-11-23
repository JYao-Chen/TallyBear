'use client';
import { HomeTaskCenter } from './HomeTaskCenter';
import { SectionTabs } from './SectionTabs';
import { EntryDetailContext } from './EntryDetailContext';
import { LedgerEntryDetail } from './LedgerEntryDetail';
import { copyEntryDraft, resolveEntryDetail } from '@/lib/entry-detail';
import { ExpenseClaimsSent, ExpenseClaimsInbox, ExpenseClaimDetail } from './ExpenseClaims';
import { ProfileLocation } from './ProfileLocation';
import type { ProfileContext } from '@/lib/personal-profile';
import { Discussion } from './Discussion';
import { DiscussionInbox } from './DiscussionInbox';
import { FamilyMovementDetails } from './FamilyMovementDetails';
import { HomeFamilyInbox } from './HomeFamilyInbox';
import { FamilyFinanceEntry } from './FamilyFinanceEntry';
import { SpendingAnalysis } from './SpendingAnalysis';
import { deviceDateTime } from '@/lib/entry-time';
import { InstallmentsPanel, InstallmentReminder } from './InstallmentsPanel';
import { DateField } from './DateField';
import { deployment, formatMoney, currencySymbol } from '@/lib/deployment';
import { getLocale } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';
import { FamiliesPage } from './FamiliesPage';
import { FormSelect } from './FormSelect';

import { GlobalSearch } from './GlobalSearch';
import { JobPanel, QueueSettings } from './JobPanel';
import { useTheme } from './ThemeProvider';
import { themes, validTheme } from '@/lib/themes';
import { uploadReceipt } from '@/lib/upload-receipt';
import { HelpPage } from './HelpPage';
import { BookOpen, UserRound } from 'lucide-react';
import { FinanceChat } from './FinanceChat';
import {
  Avatar,
  BookSwitcher,
  ProfilePage,
  ModelSettingsPanel,
  type ModelConfig,
  BooksPage,
  UsersPage,
  type ManagedUser,
  type ManagedBook,
} from './ManagementPages';
import { AllocationPanel } from './AllocationPanel';
import { CostProjects } from './CostProjects';
import { ChartTransactionDetail } from './ChartTransactionDetail';
import { VisualSelect, SymbolIcon, CategoryIcons } from './VisualSelect';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  pageForPath,
  pathForPage,
  pagePaths,
  sectionOf,
  sections,
  subPages,
  type PageKey,
} from '@/lib/routes';
import { Sidebar } from '@/features/shell/Sidebar';
import { MobileTabBar } from '@/features/shell/MobileTabBar';
import { AccountMenu } from '@/features/shell/AccountMenu';
import { SubNav } from '@/features/shell/SubNav';
import { Greeting } from '@/features/home/Greeting';
import { CaptureCard } from '@/features/home/CaptureCard';
import { MonthCard } from '@/features/home/MonthCard';
import homeStyles from '@/features/home/home.module.css';
import pageStyles from './Workspace.module.css';
import shellStyles from '@/features/shell/shell.module.css';
import {
  ArrowLeft,
  ArrowLeftRight,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  NotebookPen,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  CalendarDays,
  LogOut,
  Users,
  ShieldCheck,
  Trash2,
  Upload,
  ChevronRight,
  Sparkles,
  FolderHeart,
} from 'lucide-react';
import { decodeBill, parseBill } from '@/lib/bill-import';
import { useSavedDraft } from '@/hooks/useSavedDraft';
import { SchedulesPanel, type Schedule } from './SchedulesPanel';

import type { DetailSort } from '@/lib/detail-sort';
import { TransactionList } from './TransactionList';
import { monthRange, type LedgerReport, type LedgerRow as Row } from '@/lib/ledger-types';
import { CategoryPanel, type Category } from './CategoryPanel';
import { TemplatesPanel, type Template } from './TemplatesPanel';
import { AccountsPanel, type Account } from './AccountsPanel';
import { BudgetPanel } from './BudgetPanel';
import planStyles from './WorkspacePlans.module.css';
import entryStyles from './WorkspaceEntry.module.css';
import { EntrySaveFeedback } from './EntrySaveFeedback';
import { Button, Segmented, Sheet, TextArea } from '@/ui';
import { QuickEntry } from './QuickEntry';
import { ActivitiesPage } from './ActivitiesPage';
import { invalidateActivityOptions, type Activity } from './ActivitySelect';
import settingsStyles from './ManagementPages.module.css';
import detailStyles from './LedgerEntryDetail.module.css';
import { appendDraftBatch } from '@/lib/draft-batch';
import { askAssistant } from '@/lib/assistant-client';
import { DraftReview, type Draft as Entry, type Original } from './DraftReview';
import { amountToCents } from '@/server/model';
type User = ManagedUser;
type Book = ManagedBook;

type Budget = { category: string; amount: number };
type Member = User & { role: string };

const yuan = (n: number) =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency: deployment().currency }).format(n / 100);
const newId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
async function api(path: string, method = 'GET', body?: unknown) {
  let r: Response;
  try {
    r = await fetch('/api/' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // 浏览器只给出 “Failed to fetch”，换成用户能看懂的提示
    throw new Error('网络连接失败，请重试。');
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '请求失败');
  return data;
}
function fields(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}
function Bear({ name = 'together', size = 100 }: { name?: string; size?: number }) {
  const { t: tr, locale } = useI18n();
  const { theme } = useTheme();
  if (theme === 'minimal') return null;
  if (name.startsWith('sticker:')) return <SymbolIcon icon={name} size={size} />;
  return (
    <picture className="bear" style={{ width: size, height: size }}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/characters/${name}.png`} />
      <img src={`/characters/${name}.gif`} width={size} height={size} alt="" />
    </picture>
  );
}
export default function Workspace({ children }: { children?: ReactNode }) {
  const { t: tr, locale } = useI18n();
  const [costTarget, setCostTarget] = useState<string | undefined>();
  const [settingsTab, setSettingsTab] = useState('categories');
  const [planTab, setPlanTab] = useState('renewal');
  const [installmentSeed, setInstallmentSeed] = useState<Row | null>(null);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const page: PageKey = pageForPath(pathname) ?? 'home';
  const setPage = (key: string) => router.push(pathForPage(key), { scroll: false });
  const pageTitle = (key: PageKey) =>
    key === 'chat'
      ? themes[theme].assistant
      : (subPages[key]?.find(p => p.key === key)?.label ??
        sections.find(s => s.key === key)?.label ??
        { entry: '记一笔', profile: '个人资料与画像', help: '使用说明' }[key as string] ??
        '');
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [memoryRequest, setMemoryRequest] = useState<{ id: string; key: number } | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      setMemoryRequest({ id: (event as CustomEvent<string>).detail, key: Date.now() });
      setPage('profile');
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('tallybear:memory', open);
    return () => window.removeEventListener('tallybear:memory', open);
  }, []);
  const detailRequest = useRef(0);
  const [openingDetail, setOpeningDetail] = useState<{ row: Row; error?: string } | null>(null);
  const [claimDetail, setClaimDetail] = useState(''),
    [claimEditable, setClaimEditable] = useState(false);
  const [scheduleDiscussionTarget, setScheduleDiscussionTarget] = useState<
    { id: string; scope: string } | undefined
  >();
  const [searchNavigation, setSearchNavigation] = useState<{
    book: string;
    id: string;
    entity: string;
  } | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [searchTarget, setSearchTarget] = useState<{ book: string; row: Row; edit?: boolean } | null>(null);
  const [chatPrefill, setChatPrefill] = useState<{ id: string; text: string; source?: 'help' } | null>(null);
  const [aiProgress, setAIProgress] = useState(''),
    [aiCharacters, setAICharacters] = useState(0),
    [aiRunning, setAIRunning] = useState(false);
  const aiAbort = useRef<AbortController | null>(null);
  const [statisticsRange] = useState(() => monthRange(today().slice(0, 7)));
  useEffect(() => {
    if (searchNavigation?.entity === 'cost_project') {
      setCostTarget(searchNavigation.id);
      setPlanTab('cost');
      setSearchNavigation(null);
    }
  }, [searchNavigation]);
  // Home shows the latest entries; sorting and other periods live on /entries.
  const homeSort: DetailSort = 'date_desc';
  const [periodReport, setPeriodReport] = useState<LedgerReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<LedgerReport | null>(null),
    [revision, setRevision] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [books, setBooks] = useState<Book[]>([]),
    [book, setBook] = useState(''),
    [month, setMonth] = useState(today().slice(0, 7));
  const [activities, setActivities] = useState<Activity[]>([]);
  const [entryActivityId, setEntryActivityId] = useState('');
  const [homeActivityChoice, setHomeActivityChoice] = useState('');
  const launchActivity = useRef<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]),
    [rows, setRows] = useState<Row[]>([]),
    [budgets, setBudgets] = useState<Budget[]>([]),
    [members, setMembers] = useState<Member[]>([]);
  const intent = 'record';
  const [profileContext, setProfileContext] = useState<ProfileContext>();
  const intake = useSavedDraft(book, user?.id || '', 'intake', {
    text: '',
    entries: [] as Entry[],
    history: true,
  });
  const photos = useSavedDraft(book, user?.id || '', 'images', [] as { name: string; data: string }[]);
  const manual = useSavedDraft(book, user?.id || '', 'manual', {} as Partial<Entry>);
  const drafts = intake.value.entries,
    text = intake.value.text,
    history = intake.value.history,
    images = photos.value;
  const setDrafts = (value: React.SetStateAction<Entry[]>) =>
    intake.setValue(old => ({ ...old, entries: typeof value === 'function' ? value(old.entries) : value }));
  const setText = (value: string) => intake.setValue(old => ({ ...old, text: value }));
  const setHistory = (value: boolean) => intake.setValue(old => ({ ...old, history: value }));
  const setImages = photos.setValue;
  const [entryMode, setEntryMode] = useState('ai');
  const [reviewFocus, setReviewFocus] = useState<{ id: string; key: number }>(),
    [incomingDrafts, setIncomingDrafts] = useState<{ book: string; items: Entry[] } | null>(null);
  function openDrafts(items: Entry[], targetBook = book) {
    if (!books.some(b => b.id === targetBook && b.role !== 'viewer'))
      throw new Error('没有任务所属账本的记账权限');
    setIncomingDrafts({ book: targetBook, items });
    setBook(targetBook);
    setEntryMode('ai');
    switchPage('entry');
  }
  useEffect(() => {
    if (!incomingDrafts || incomingDrafts.book !== book || !intake.ready) return;
    setDrafts(old => appendDraftBatch(old, incomingDrafts.items));
    if (incomingDrafts.items[0]) setReviewFocus({ id: incomingDrafts.items[0].id, key: Date.now() });
    setIncomingDrafts(null);
  }, [incomingDrafts, book, intake.ready]);
  const [costSeed, setCostSeed] = useState<{ id: string; amount: number; date: string } | undefined>();
  useEffect(() => {
    const open = (event: Event) => {
      setCostSeed((event as CustomEvent).detail);
      setSelected(null);
      setPage('schedules');
      setPlanTab('cost');
    };
    window.addEventListener('open-cost-project', open);
    return () => window.removeEventListener('open-cost-project', open);
  }, []);

  const emptyModelConfig = {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: '',
    visionModel: '',
    key: '',
    hasKey: false,
  };
  const [config, setConfig] = useState<ModelConfig>(emptyModelConfig),
    [assistantConfig, setAssistantConfig] = useState<ModelConfig>(emptyModelConfig);
  const [scheduleItems, setScheduleItems] = useState<Schedule[]>([]);
  const [categoryItems, setCategoryItems] = useState<Category[]>([]),
    [templateItems, setTemplateItems] = useState<Template[]>([]);
  const [originals, setOriginals] = useState<Original[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [undo, setUndo] = useState<{ id: string; version: number } | null>(null);
  const availableAccounts = accounts.filter(a => !a.archived && a.usable !== false);
  const current = books.find(b => b.id === book),
    canWrite = current?.role !== 'viewer';
  const activeBook = useRef(book);
  activeBook.current = book;
  const activeView = useRef(book + '|' + month);
  activeView.current = book + '|' + month;
  async function refresh(bookId = book, blocking = false) {
    if (!bookId) return;
    const key = bookId + '|' + month;
    if (blocking) setDataLoading(true);
    try {
      const [a, t, b, m, o, c, templates, schedules, activityList] = await Promise.all([
        api(`books/${bookId}/accounts`),
        api('books/' + bookId + '/report?' + new URLSearchParams({ ...monthRange(month), limit: '6' })),
        api(`books/${bookId}/budgets?month=${month}`),
        api(`books/${bookId}/members`),
        api(`books/${bookId}/refund-options`),
        api(`books/${bookId}/categories`),
        api(`books/${bookId}/templates`),
        api(`books/${bookId}/schedules`),
        api('activities'),
      ]);
      if (activeView.current !== key) return;
      setAccounts(a);
      setRows(t.rows);
      setMonthlyReport(t);
      setRevision(n => n + 1);
      setBudgets(b);
      setMembers(m);
      setOriginals(o);
      setCategoryItems(c);
      setTemplateItems(templates);
      setScheduleItems(schedules);
      setActivities(activityList);
    } finally {
      if (blocking && activeView.current === key) setDataLoading(false);
    }
  }
  async function init() {
    const u = await api('me');
    setUser(u);
    setTheme(validTheme(u.theme));
    const [b, a] = await Promise.all([api('books'), api('activities')]);
    setBooks(b);
    setActivities(a);
    setBook(old => (b.some((x: Book) => x.id === old) ? old : b[0]?.id || ''));
  }
  useEffect(() => {
    init()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (page === 'entry' && !editing && manual.ready) setEntryActivityId(manual.value.activityId || '');
  }, [page, editing, manual.ready, manual.value.activityId]);
  useEffect(() => {
    if (page === 'entry' && manual.ready && launchActivity.current) {
      const id = launchActivity.current;
      launchActivity.current = null;
      manual.setValue(old => ({ ...old, activityId: id }));
    }
  }, [book, page, manual.ready]);
  useEffect(() => {
    aiAbort.current?.abort();
    setSelected(null);
    setMonthlyReport(null);
    setRows([]);
    setAccounts([]);
    setBudgets([]);
    setMembers([]);
    setUndo(null);
    setEditing(null);
    refresh(book, true).catch(e => setError(e.message));
  }, [book, month]);
  useEffect(() => {
    const update = () => {
      void refresh().catch(e => setError(e.message));
    };
    window.addEventListener('cost-payment-recorded', update);
    return () => window.removeEventListener('cost-payment-recorded', update);
  }, [book, month]);

  useEffect(() => () => aiAbort.current?.abort(), []);
  useEffect(() => {
    if (searchTarget && book === searchTarget.book) {
      if (searchTarget.edit) {
        setEditing(searchTarget.row);
        setEntryMode('manual');
        switchPage('entry');
      } else setSelected(searchTarget.row);
      setSearchTarget(null);
    }
  }, [book, accounts, searchTarget]);
  async function requestAI(input = text) {
    const requestedBook = book;
    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    setAIRunning(true);
    setAIProgress('正在连接模型…');
    setAICharacters(0);
    try {
      const result = await askAssistant(
        `books/${book}/assistant`,
        {
          profileContext: history ? profileContext : undefined,
          deviceTime: deviceDateTime(),
          text: input,
          images: intent === 'record' ? images.map(i => i.data) : undefined,
          useHistory: history,
          intent,
          month,
        },
        controller.signal,
        (message, count) => {
          if (activeBook.current === requestedBook) {
            setAIProgress(message);
            setAICharacters(count);
          }
        },
      );
      if (activeBook.current !== requestedBook) return;
      setProfileContext(undefined);
      if (intent === 'record') {
        setDrafts(old =>
          appendDraftBatch(
            old,
            result.entries.map((item: Entry) => ({
              ...item,
              activityId: item.activityId || entryActivityId || null,
            })),
          ),
        );
        if (result.entries[0]) setReviewFocus({ id: result.entries[0].id, key: Date.now() });
      }
      setNotice(result.message);
    } catch (e) {
      if (controller.signal.aborted) {
        setNotice('任务继续在后台处理，可在“后台任务”查看结果。');
        return;
      }
      throw e;
    } finally {
      setAIRunning(false);
    }
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  function switchPage(p: string) {
    setPage(p);
  }
  // Navigation by link, history or code: start each page at the top with no stale messages.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setError('');
    setNotice('');
    setMenuOpen(false);
  }, [page]);
  useEffect(() => {
    if (page !== 'settings' || !user?.admin) return;
    Promise.all([api('ai-settings'), api('assistant-ai-settings')])
      .then(([recognition, assistant]) => {
        setConfig(old => ({ ...old, ...recognition, key: '' }));
        setAssistantConfig(old => ({ ...old, ...assistant, key: '' }));
      })
      .catch(e => setError(e.message));
  }, [page, user?.admin]);
  function recordToActivity(id: string) {
    const writable =
      books.find(b => b.id === book && b.role !== 'viewer') || books.find(b => b.role !== 'viewer');
    if (!writable) return;
    launchActivity.current = id;
    if (writable.id !== book) setBook(writable.id);
    setEntryActivityId(id);
    setEntryMode('manual');
    switchPage('entry');
  }
  useEffect(() => {
    if (!book || page !== 'home') return;
    const controller = new AbortController();
    setPeriodReport(null);
    fetch(
      '/api/books/' +
        book +
        '/report?' +
        new URLSearchParams({ ...statisticsRange, sort: homeSort, limit: '6' }),
      { signal: controller.signal },
    )
      .then(async r => {
        const value = await r.json();
        if (!r.ok) throw Error(value.error);
        if (!controller.signal.aborted) setPeriodReport(value);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [page, book, statisticsRange, revision]);
  const visibleReport = page === 'home' ? periodReport : monthlyReport;
  const spending = visibleReport?.categories || [];
  const chosenHomeActivity =
    activities.find(a => a.id === homeActivityChoice && !a.archived)?.id ||
    activities.find(a => !a.archived)?.id ||
    '';
  async function reviewDrafts() {
    const key = book;
    const result = await api(`books/${book}/review`, 'POST', { entries: drafts });
    if (activeBook.current === key) setDrafts(result.entries);
  }
  async function saveDrafts() {
    const result = await api(`books/${book}/transactions`, 'POST', { entries: drafts });
    setDrafts([]);
    setImages([]);
    setText('');
    await Promise.all([intake.flush(), photos.flush()]);
    await refresh();
    setNotice(tr('已入账{0}笔，补充{1}笔，跳过{2}笔。', [result.added, result.merged || 0, result.skipped]));
  }
  async function loadImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.some(f => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)))
      throw new Error('请选择PNG、JPEG或WebP图片');
    for (const file of selected) {
      const added = await uploadReceipt(book, file);
      setImages(old => [...old, added]);
    }
  }
  async function importCSV(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw new Error('账单文件不能超过5MB');
    const key = book;
    const decoded = decodeBill(await file.arrayBuffer());
    const result = parseBill(decoded.text, availableAccounts, newId);
    const reviewed = await api('books/' + book + '/review', 'POST', { entries: result.entries });
    if (activeBook.current !== key) return;
    setDrafts(old => appendDraftBatch(old, reviewed.entries));
    setNotice(
      tr('已读取{0}笔（{1}）；未支付或不计收支跳过{2}笔。无法确认的账户留空，请核对后保存。', [
        result.entries.length,
        decoded.encoding,
        result.skipped,
      ]) +
        (result.warnings.length
          ? '\n' +
            result.warnings.slice(0, 15).join('；') +
            (result.warnings.length > 15 ? tr('，另有{0}项需核对', [result.warnings.length - 15]) : '')
          : ''),
    );
  }

  if (loading)
    return (
      <main className="login">
        <Bear />
        <p>{tr('正在打开账本…')}</p>
      </main>
    );
  if (!user)
    return (
      <main className="login">
        <div className="login-card">
          <Bear name="hello" size={160} />
          <h1>
            {tr('欢迎回到')}
            {tr(themes[theme].name)}
          </h1>
          <p>{tr('管理个人收支，也照顾家庭计划。')}</p>
          <form
            onSubmit={e => {
              const f = fields(e);
              run(async () => {
                await api('login', 'POST', f);
                await init();
              });
            }}
          >
            <label>
              {tr('账号')}
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              {tr('密码')}
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button disabled={busy}>{tr('登录')}</button>
          </form>
          {error && (
            <p role="alert" className="error">
              {tr(error)}
            </p>
          )}
        </div>
      </main>
    );
  function openEntry(row: Row, options?: { edit?: boolean }) {
    const request = ++detailRequest.current;
    setSelected(null);
    setClaimEditable(false);
    setError('');
    setOpeningDetail({ row });
    void resolveEntryDetail(row, book, (target, id) =>
      api('books/' + target + '/transactions?' + new URLSearchParams({ id })),
    )
      .then(source => {
        if (request !== detailRequest.current) return;
        setOpeningDetail(null);
        if (options?.edit) {
          if (source.book_id && source.book_id !== book) {
            setBook(source.book_id);
            setSearchTarget({ book: source.book_id, row: source, edit: true });
          } else {
            setEditing(source);
            setEntryMode('manual');
            switchPage('entry');
          }
          return;
        }
        if (source.claim_id) {
          setClaimDetail(source.claim_id);
          return;
        }
        setSelected(source);
      })
      .catch(e => {
        if (request === detailRequest.current) setOpeningDetail({ row, error: e.message });
      });
  }
  const detailBook = books.find(b => b.id === (selected?.book_id || book));
  const list = (limit = 6) =>
    periodReport?.rows.length ? (
      <TransactionList
        rows={periodReport.rows.slice(0, limit)}
        shared={current?.kind === 'shared'}
        grouped={homeSort.startsWith('date')}
        onSelect={openEntry}
      />
    ) : (
      <div className="empty">
        <Bear name="quiet" />
        <p>{tr('所选日期内还没有记录。')}</p>
      </div>
    );
  return (
    <CategoryIcons.Provider value={categoryItems}>
      <EntryDetailContext.Provider value={openEntry}>
        <div className={`app${page === 'chat' ? ' chat-page' : ''}`}>
          <AccountMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            user={user}
            busy={busy}
            onLogout={() =>
              run(async () => {
                await Promise.all([intake.flush(), photos.flush(), manual.flush()]);
                await api('logout', 'POST', {});
                setMenuOpen(false);
                setUser(null);
                setBooks([]);
                setRows([]);
                setBook('');
              })
            }
          />
          {claimDetail && (
            <ExpenseClaimDetail
              id={claimDetail}
              onClose={() => setClaimDetail('')}
              onChanged={() => {
                void refresh();
              }}
            />
          )}
          {openingDetail && (
            <Sheet
              open
              wide
              closeLabel={tr('关闭弹窗')}
              title={tr('账单明细')}
              onClose={() => {
                detailRequest.current++;
                setOpeningDetail(null);
              }}
            >
              {openingDetail.error ? (
                <>
                  <p role="alert" className={detailStyles.error}>
                    {tr(openingDetail.error)}
                  </p>
                  <Button onClick={() => openEntry(openingDetail.row)}>{tr('重试')}</Button>
                </>
              ) : (
                <p role="status">{tr('正在读取账单…')}</p>
              )}
            </Sheet>
          )}
          {selected?.family_movement_id && (
            <FamilyMovementDetails row={selected} onClose={() => setSelected(null)} onChanged={refresh} />
          )}
          {selected?.cost_row_key && (
            <Sheet
              open
              wide
              closeLabel={tr('关闭弹窗')}
              title={selected.title || selected.category}
              onClose={() => setSelected(null)}
            >
              <ChartTransactionDetail
                row={selected}
                money={n => yuan(n * 100)}
                onOpenSource={() =>
                  openEntry({
                    ...selected,
                    id: selected.source_transaction_id!,
                    cost_row_key: undefined,
                    cost_project_id: undefined,
                  })
                }
                onOpenProject={() => {
                  setCostTarget(selected.cost_project_id);
                  setSelected(null);
                  setPlanTab('cost');
                  switchPage('schedules');
                }}
                onOpenSchedule={() => {
                  setCostTarget(undefined);
                  setScheduleDiscussionTarget({ id: selected.source_schedule_id!, scope: '' });
                  setSelected(null);
                  setPlanTab('cost');
                  switchPage('schedules');
                }}
              />
            </Sheet>
          )}
          {selected && !selected.family_movement_id && !selected.cost_row_key && (
            <LedgerEntryDetail
              key={selected.id}
              row={selected}
              activityName={activities.find(a => a.id === selected.activity_id)?.name}
              detailBook={detailBook}
              books={books}
              accounts={accounts}
              canWrite={!!detailBook && detailBook.role !== 'viewer'}
              busy={busy}
              error={error}
              claimEditable={claimEditable}
              setClaimEditable={setClaimEditable}
              onClose={() => setSelected(null)}
              onChanged={() => {
                setSelected(null);
                void refresh().catch(e => setError(e.message));
              }}
              onOrganized={() => {
                setSelected(null);
                void refresh().catch(e => setError(e.message));
                setNotice('账单已整理');
              }}
              onInstallment={() => {
                if (selected.book_id && selected.book_id !== book) setBook(selected.book_id);
                setInstallmentSeed(selected);
                setSelected(null);
                setPlanTab('installments');
                switchPage('schedules');
              }}
              onDelete={() =>
                run(async () => {
                  const r = selected;
                  const v = await api(`books/${r.book_id || book}/transactions`, 'DELETE', {
                    id: r.id,
                    version: r.version,
                  });
                  setSelected(null);
                  setUndo({ id: r.id, version: v.version });
                  await refresh();
                  setNotice('已删除，可撤销。');
                })
              }
              onCopy={() => {
                openDrafts([copyEntryDraft(selected, today(), newId)], selected.book_id || book);
                setSelected(null);
              }}
              onEdit={() => openEntry(selected, { edit: true })}
            />
          )}
          <Sidebar
            page={page}
            user={user}
            canWrite={books.some(b => b.role !== 'viewer')}
            onAccount={() => setMenuOpen(true)}
            bookSwitcher={
              page !== 'accounts' && (
                <BookSwitcher
                  books={books}
                  current={book}
                  onSelect={setBook}
                  onManage={() => switchPage('books')}
                />
              )
            }
          />
          <div className="workspace">
            <header>
              <div className={shellStyles.headerTitle}>
                {(() => {
                  const section = sections.find(x => x.key === sectionOf(page))?.label || '';
                  return section && section !== pageTitle(page) ? <small>{tr(section)}</small> : null;
                })()}
                <strong>{tr(pageTitle(page))}</strong>
              </div>
              <div className="header-tools">
                <GlobalSearch
                  book={book}
                  books={books}
                  onOpen={(b, row) => openEntry({ ...row, book_id: b })}
                  onNavigate={(b, page, target) => {
                    if (b) setBook(b);
                    if (target) setSearchNavigation({ book: b, ...target });
                    if (page === 'schedules') setPlanTab('renewal');
                    switchPage(page);
                  }}
                />
                <JobPanel book={book} onDrafts={openDrafts} />
                <span className={shellStyles.mobileBook}>
                  {page === 'accounts' ? (
                    <strong className={shellStyles.mobilePageTitle}>{tr(pageTitle(page))}</strong>
                  ) : (
                    <BookSwitcher
                      books={books}
                      current={book}
                      onSelect={setBook}
                      onManage={() => switchPage('books')}
                    />
                  )}
                </span>
              </div>
            </header>
            <main
              className={
                page === 'entry' ? 'entry-workspace' : page === 'home' ? 'home-workspace' : undefined
              }
            >
              <SubNav page={page} admin={!!user.admin} />
              {children}
              {error && (
                <div className="error" role="alert">
                  {tr(error)}
                </div>
              )}
              {notice && (
                <div className="notice" role="status">
                  {tr(notice)}
                  {undo && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(`books/${book}/transactions`, 'PATCH', { ...undo, deleted: false });
                          setUndo(null);
                          await refresh();
                          setNotice('已恢复记录。');
                        })
                      }
                    >
                      {tr('撤销删除')}
                    </button>
                  )}
                </div>
              )}
              {['accounts', 'books', 'families', 'profile', 'users', 'help'].includes(page) ? (
                <>
                  {page === 'help' && (
                    <HelpPage
                      canAsk={!!book}
                      onNavigate={target => {
                        const [destination, mode] = target.split(':');
                        if (destination === 'entry' && mode) setEntryMode(mode);
                        if (target === 'profile:memory') setMemoryRequest({ id: '', key: Date.now() });
                        router.push(pathForPage(destination), { scroll: false });
                      }}
                      onAsk={text => {
                        setChatPrefill({ id: newId(), text, source: 'help' });
                        router.push(pathForPage('chat'), { scroll: false });
                      }}
                    />
                  )}
                  {page === 'accounts' && (
                    <AccountsPanel
                      books={books}
                      onSelect={openEntry}
                      book={book}
                      month={month}
                      onChanged={() => refresh()}
                    />
                  )}{' '}
                  {page === 'families' && (
                    <FamiliesPage
                      userId={user.id}
                      onChanged={init}
                      onManageBooks={() => router.push(pathForPage('books'))}
                      onOpenBook={id => {
                        setBook(id);
                        router.push(pathForPage('home'));
                      }}
                    />
                  )}
                  {page === 'profile' && (
                    <ProfilePage key={user.id} user={user} onSaved={init} memoryRequest={memoryRequest} />
                  )}{' '}
                  {page === 'users' && user.admin && <UsersPage />}
                  {page === 'books' && (
                    <BooksPage
                      books={books}
                      onSaved={async () => {
                        await init();
                        await refresh();
                      }}
                      onSelect={id => {
                        setBook(id);
                        router.push(pathForPage('home'), { scroll: false });
                      }}
                    />
                  )}
                </>
              ) : !book ? (
                <section className="panel empty">
                  <Bear name="hello" size={180} />
                  <h1>{tr('给生活准备一本小账本')}</h1>
                  <></>
                  <form
                    className="inline"
                    onSubmit={e => {
                      const f = fields(e);
                      run(async () => {
                        const b = await api('books', 'POST', f);
                        await init();
                        setBook(b.id);
                      });
                    }}
                  >
                    <input name="name" placeholder={tr('例如：我的日常')} required />
                    <FormSelect name="kind">
                      <option value="private">{tr('私人账本')}</option>
                      <option value="shared">{tr('共享账本')}</option>
                    </FormSelect>
                    <button disabled={busy}>{tr('创建账本')}</button>
                  </form>
                </section>
              ) : dataLoading ? (
                <section className="panel empty">
                  <Bear name="thinking" />
                  <p>{tr('正在读取账本…')}</p>
                </section>
              ) : (
                <>
                  {!['chat', 'activities', 'home'].includes(page) && (
                    <div className="page-heading">
                      <div>
                        <h1>{page === 'home' ? current?.name : tr(pageTitle(page))}</h1>
                        {current?.role === 'viewer' && <p>{tr('只读权限')}</p>}
                      </div>
                      <div className="inline">
                        {['budget', 'schedules'].includes(page) && (
                          <DateField
                            required
                            type="month"
                            aria-label={tr('统计月份')}
                            value={month}
                            onChange={value => setMonth(value)}
                          />
                        )}{' '}
                        {page === 'entry' && <Bear name="overalls" size={52} />}{' '}
                        {canWrite && page !== 'entry' && (
                          <button
                            className={pageStyles.headerEntry}
                            onClick={() => router.push(pathForPage('entry'), { scroll: false })}
                          >
                            <Plus size={17} />
                            {tr('记一笔')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {page === 'activities' && (
                    <ActivitiesPage
                      books={books}
                      activities={activities}
                      userId={user.id}
                      initialId={searchNavigation?.entity === 'activity' ? searchNavigation.id : undefined}
                      onRecord={recordToActivity}
                      onChanged={async () => {
                        setActivities(await api('activities'));
                        invalidateActivityOptions();
                      }}
                    />
                  )}
                  {page === 'entry' && entryActivityId && (
                    <div className="entry-activity-context" role="status">
                      <FolderHeart size={19} />
                      <span>
                        {tr('正在记入活动：')}
                        <strong>
                          {activities.find(a => a.id === entryActivityId)?.name || tr('已选活动')}
                        </strong>
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEntryActivityId('');
                          manual.setValue(old => ({ ...old, activityId: null }));
                        }}
                      >
                        {tr('取消活动归属')}
                      </button>
                    </div>
                  )}
                  {page === 'home' && (
                    <>
                      <Greeting name={user.name} book={current?.name} readOnly={current?.role === 'viewer'} />
                      <div className={homeStyles.top}>
                        {canWrite ? (
                          <CaptureCard
                            disabled={busy || aiRunning}
                            onSay={value => {
                              setText(value);
                              setEntryMode('ai');
                              switchPage('entry');
                              void run(() => requestAI(value));
                            }}
                            onImages={files => {
                              setEntryMode('ai');
                              switchPage('entry');
                              void run(() => loadImages(files));
                            }}
                            onManual={() => {
                              setEntryMode('manual');
                              switchPage('entry');
                            }}
                          />
                        ) : (
                          <div />
                        )}
                        <MonthCard
                          month={month}
                          cashMonth={today().slice(0, 7)}
                          revision={revision}
                          income={monthlyReport?.totals.income || 0}
                          netExpense={
                            (monthlyReport?.totals.expense || 0) - (monthlyReport?.totals.refund || 0)
                          }
                          budget={
                            budgets.length
                              ? {
                                  amount: budgets.reduce((n, b) => n + b.amount, 0),
                                  spent: budgets.reduce(
                                    (n, b) =>
                                      n +
                                      ((monthlyReport?.categories || []).find(c => c.name === b.category)
                                        ?.value || 0),
                                    0,
                                  ),
                                }
                              : undefined
                          }
                        />
                      </div>
                    </>
                  )}
                  {page === 'home' && (
                    <HomeTaskCenter
                      onChanged={() => {
                        void refresh();
                      }}
                      revision={revision}
                      onOpenSource={async r => {
                        if (r.kind === 'claim') {
                          setClaimDetail(r.target_id);
                        } else if (r.kind === 'movement') {
                          const d = await api('family-finance/' + r.family_id);
                          const m = d.movements.find((v: any) => v.id === r.target_id);
                          if (!m) throw Error(tr('往来记录不存在'));
                          setSelected({ ...m, family_movement_id: m.id, movement_family_id: r.family_id });
                        } else if (r.kind === 'project') {
                          setCostTarget(r.target_id);
                          setPlanTab('cost');
                          switchPage('schedules');
                        } else if (r.kind === 'schedule') {
                          setCostTarget(undefined);
                          setScheduleDiscussionTarget({ id: r.target_id, scope: r.scope });
                          setPlanTab('cost');
                          switchPage('schedules');
                        } else {
                          const d = await api(
                            'books/' +
                              r.book_id +
                              '/transactions?' +
                              new URLSearchParams({ id: r.target_id }),
                          );
                          const row = d.find((v: any) => v.id === r.target_id);
                          if (!row) throw Error(tr('记录不存在或已删除'));
                          setBook(r.book_id);
                          switchPage('records');
                          setSearchTarget({ book: r.book_id, row });
                        }
                      }}
                    />
                  )}{' '}
                  {page === 'home' && <HomeFamilyInbox revision={revision} onChanged={refresh} />}{' '}
                  {page === 'home' && (
                    <InstallmentReminder
                      revision={revision}
                      onOpen={() => {
                        setPlanTab('installments');
                        switchPage('schedules');
                      }}
                    />
                  )}
                  {page === 'home' && scheduleItems.some(s => !s.paused && s.next_date <= today()) && (
                    <div className="notice">
                      {tr('有')}
                      {scheduleItems.filter(s => !s.paused && s.next_date <= today()).length}{' '}
                      {tr('项周期账单待核对')}
                      <button
                        className="text-button"
                        onClick={() => {
                          setPlanTab('renewal');
                          switchPage('schedules');
                        }}
                      >
                        {tr('查看账单')}
                      </button>
                    </div>
                  )}
                  {page === 'home' && (
                    <section className="panel">
                      <div className="panel-title">
                        <h2>{tr('最近的记录')}</h2>
                        <button className="text-button" onClick={() => switchPage('entries')}>
                          {tr('查看全部流水')}
                          <ChevronRight size={15} />
                        </button>
                      </div>
                      {list(8)}
                    </section>
                  )}
                  {page === 'home' && activities.some(a => !a.archived) && (
                    <section className="panel home-activities">
                      <div className="panel-title">
                        <div>
                          <h2>{tr('进行中的活动')}</h2>
                          <p className="muted">{tr('从首页直接记入活动，不必先进入活动详情。')}</p>
                        </div>
                        <button className="text-button" onClick={() => switchPage('activities')}>
                          {tr('查看全部活动')}
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="home-activity-picker">
                        <label>
                          {tr('选择活动')}
                          <FormSelect value={chosenHomeActivity} onChange={setHomeActivityChoice}>
                            {activities
                              .filter(a => !a.archived)
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.familyName ? `${a.familyName} · ` : ''}
                                  {a.name} · {a.category}
                                </option>
                              ))}
                          </FormSelect>
                        </label>
                        <button
                          disabled={!books.some(b => b.role !== 'viewer')}
                          onClick={() => recordToActivity(chosenHomeActivity)}
                        >
                          <Plus size={17} />
                          {tr('记一笔到活动')}
                        </button>
                      </div>
                    </section>
                  )}
                  {(page === 'insights' || page === 'entries') && (
                    <SpendingAnalysis
                      key={page}
                      initialView={page === 'entries' ? 'entries' : 'overview'}
                      book={book}
                      books={books}
                      month={month}
                      revision={revision}
                      accounts={accounts}
                      categories={categoryItems}
                      shared={current?.kind === 'shared'}
                      canWrite={canWrite}
                      onChanged={() => {
                        void refresh().catch(e => setError(e.message));
                      }}
                      onPlans={() => {
                        setPlanTab('cost');
                        router.push(pathForPage('schedules'), { scroll: false });
                      }}
                      onReconcile={() => {
                        setChatPrefill({
                          id: newId(),
                          text:
                            locale === 'en'
                              ? 'Please reconcile my attached payment screenshots against my records.'
                              : '请读取我附上的支付账单截图，按流水号、订单号、时间和前后顺序智能核对漏记。',
                        });
                        router.push(pathForPage('chat'), { scroll: false });
                      }}
                      onSelect={openEntry}
                    />
                  )}
                  {page === 'entry' && (
                    <EntrySaveFeedback>
                      {(notifySaved, confirmEntryAction) => {
                        const recordOne = async (item: Entry) => {
                          const destination = item.targetBook || book;
                          const result = await api(`books/${book}/transactions`, 'POST', {
                            entries: [item],
                            targetBook: item.targetBook,
                          });
                          if (result.added !== 1) {
                            setNotice(
                              tr('已入账{0}笔，补充{1}笔，跳过{2}笔。', [
                                result.added,
                                result.merged,
                                result.skipped,
                              ]),
                            );
                            return;
                          }
                          let version: number;
                          try {
                            const rows: Row[] = await api(
                              `books/${destination}/transactions?` + new URLSearchParams({ id: item.id }),
                            );
                            const row = rows.find(r => r.id === item.id);
                            if (!row) throw new Error('记录不存在或已删除');
                            version = row.version;
                          } catch (error) {
                            notifySaved();
                            setError((error as Error).message);
                            return;
                          }
                          notifySaved(async () => {
                            await api(`books/${destination}/transactions`, 'DELETE', {
                              id: item.id,
                              version,
                            });
                            await refresh();
                          });
                        };
                        return (
                          <>
                            <Segmented
                              className={entryStyles.modes}
                              value={entryMode === 'import' ? 'ai' : entryMode}
                              onChange={setEntryMode}
                              label={tr('录入方式')}
                              options={[
                                { value: 'ai', label: tr('交给小熊') },
                                { value: 'manual', label: tr('手动填写') },
                                { value: 'family', label: tr('家庭往来') },
                              ]}
                            />
                            <div className={entryStyles.status} role="status" hidden={entryMode === 'family'}>
                              {[intake, photos, manual].some(d => d.error) ? (
                                <>
                                  <span>
                                    {tr('草稿尚未同步：')}
                                    {[intake, photos, manual].find(d => d.error)?.error}
                                  </span>
                                  <button
                                    className={entryStyles.link}
                                    onClick={() =>
                                      Promise.all([intake.flush(), photos.flush(), manual.flush()]).catch(e =>
                                        setError(e.message),
                                      )
                                    }
                                  >
                                    {tr('重试保存')}
                                  </button>
                                  <button
                                    className={entryStyles.link}
                                    onClick={() =>
                                      Promise.all([intake.reload(), photos.reload(), manual.reload()])
                                    }
                                  >
                                    {tr('用云端草稿替换当前输入')}
                                  </button>
                                </>
                              ) : [intake, photos, manual].some(d => d.saving || d.dirty) ? (
                                tr('正在保存草稿…')
                              ) : (
                                tr('草稿已同步')
                              )}
                            </div>
                            <section
                              id="entry-editor"
                              className={entryMode === 'family' ? undefined : entryStyles.editor}
                            >
                              {entryMode === 'family' ? (
                                <FamilyFinanceEntry
                                  onAssistant={() => router.push(pathForPage('chat'))}
                                  userId={user.id}
                                  onChanged={refresh}
                                  onManage={() => router.push(pathForPage('families'))}
                                />
                              ) : !canWrite ? (
                                <p>{tr('此账本为只读，不能添加交易。')}</p>
                              ) : !intake.ready || !photos.ready || !manual.ready ? (
                                <div className={entryStyles.status}>
                                  <p>
                                    {intake.error ||
                                      photos.error ||
                                      manual.error ||
                                      tr('正在恢复未完成的记录…')}
                                  </p>
                                  <button
                                    className={entryStyles.secondary}
                                    onClick={() =>
                                      Promise.all([intake.reload(), photos.reload(), manual.reload()])
                                    }
                                  >
                                    {tr('重新读取草稿')}
                                  </button>
                                </div>
                              ) : entryMode === 'ai' ? (
                                <>
                                  <div className={entryStyles.heading}>
                                    <h2>
                                      <Sparkles size={20} />
                                      {tr('快速账单识别')}
                                    </h2>
                                    <button
                                      className={entryStyles.link}
                                      onClick={() => router.push(pathForPage('chat'))}
                                    >
                                      {tr('打开智能对话 →')}
                                    </button>
                                  </div>
                                  <div className={entryStyles.capture}>
                                    <TextArea
                                      rows={2}
                                      aria-label={tr('用一句话记账')}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                          e.preventDefault();
                                          if (!busy && (text.trim() || images.length)) void run(requestAI);
                                        }
                                      }}
                                      value={text}
                                      onChange={e => setText(e.target.value)}
                                      placeholder={tr('例如：今天用微信在盒马买菜86.5元，支付宝买咖啡18元')}
                                    />
                                    <div className={entryStyles.row}>
                                      <label className={entryStyles.upload}>
                                        <Upload size={18} />
                                        {tr('添加订单 / 流水图片')}
                                        <input
                                          type="file"
                                          multiple
                                          accept="image/png,image/jpeg,image/webp"
                                          disabled={busy}
                                          onChange={e => {
                                            const files = e.target.files;
                                            run(() => loadImages(files));
                                            e.target.value = '';
                                          }}
                                        />
                                      </label>
                                      {canWrite && (
                                        <Button variant="secondary" onClick={() => setEntryMode('import')}>
                                          {tr('微信／支付宝账单')}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <small>{tr('自动分批识别 · 支持长截图')}</small>
                                  <div className={entryStyles.images}>
                                    {images.map((img, i) => (
                                      <figure key={i}>
                                        <img src={img.data} alt={tr('待识别图片{0}', [i + 1])} />
                                        <figcaption>
                                          {tr('图片')}
                                          {i + 1} · {img.name}
                                        </figcaption>
                                        <button
                                          className={entryStyles.link}
                                          disabled={busy}
                                          onClick={() => setImages(a => a.filter((_, j) => i !== j))}
                                        >
                                          {tr('移除')}
                                        </button>
                                      </figure>
                                    ))}
                                  </div>
                                  <div className={entryStyles.row}>
                                    <label className={entryStyles.check}>
                                      <input
                                        type="checkbox"
                                        checked={history}
                                        onChange={e => setHistory(e.target.checked)}
                                      />
                                      {tr('使用我的记账偏好')}
                                    </label>
                                    {history && (
                                      <ProfileLocation
                                        value={profileContext}
                                        onChange={setProfileContext}
                                        disabled={busy}
                                      />
                                    )}
                                  </div>
                                  {aiRunning && (
                                    <div className={entryStyles.progress} role="status">
                                      <div className={entryStyles.row}>
                                        <Sparkles size={18} />
                                        <strong>{tr('正在处理')}</strong>
                                        <span className={entryStyles.muted}>
                                          {aiCharacters
                                            ? tr('已接收 {0} 字符', [aiCharacters])
                                            : tr('等待模型响应')}
                                        </span>
                                      </div>
                                      <p>{tr(aiProgress)}</p>
                                      <button
                                        className={entryStyles.secondary}
                                        onClick={() => aiAbort.current?.abort()}
                                      >
                                        {tr('转到后台继续')}
                                      </button>
                                    </div>
                                  )}
                                  <Button
                                    variant="primary"
                                    disabled={busy || (!text && !images.length)}
                                    onClick={() => run(requestAI)}
                                  >
                                    {aiRunning ? tr('正在生成…') : tr('识别并生成草稿')}
                                  </Button>
                                </>
                              ) : entryMode === 'manual' ? (
                                <>
                                  <QuickEntry
                                    book={book}
                                    books={books}
                                    categories={categoryItems}
                                    key={editing?.id || book + ':' + manual.restoreKey}
                                    savedDraft={manual.value}
                                    onDraftChange={value => {
                                      if (!editing) manual.setValue(value);
                                    }}
                                    initial={
                                      editing
                                        ? {
                                            id: editing.id,
                                            scene: editing.scene,
                                            title: editing.title,
                                            kind: editing.kind,
                                            amount: editing.amount,
                                            date: editing.date,
                                            accountId: editing.account_id,
                                            targetId: editing.target_id,
                                            payee: editing.payee,
                                            category: editing.category,
                                            note: editing.note,
                                            product: editing.product,
                                            lineItems: editing.line_items,
                                            verificationReason: editing.verification_reason,
                                            platform: editing.platform,
                                            orderId: editing.order_id,
                                            occurredAt: editing.occurred_at,
                                            externalId: editing.external_id || undefined,
                                            refundOf: editing.refund_of,
                                          }
                                        : undefined
                                    }
                                    accounts={accounts.filter(
                                      a =>
                                        (!a.archived && a.usable !== false) ||
                                        a.id === editing?.account_id ||
                                        a.id === editing?.target_id,
                                    )}
                                    recentCategories={rows.map(r => r.category)}
                                    originals={originals}
                                    onCancel={() => {
                                      if (editing) {
                                        setEditing(null);
                                        router.push(pathForPage('records'));
                                      } else {
                                        manual.setValue({});
                                        setEntryMode('ai');
                                      }
                                    }}
                                    onSave={async item => {
                                      const requestedBook = book;
                                      if (editing)
                                        await api(`books/${book}/transactions`, 'PUT', {
                                          ...item,
                                          version: editing.version,
                                        });
                                      else {
                                        await recordOne(item);
                                        manual.setValue(
                                          item.activityId ? { activityId: item.activityId } : {},
                                        );
                                        await manual.flush();
                                      }
                                      if (activeBook.current !== requestedBook) return;
                                      await refresh();
                                      if (editing) {
                                        setEditing(null);
                                        router.push(pathForPage('records'));
                                      }
                                      if (editing && item.targetBook && item.targetBook !== book) {
                                        setBook(item.targetBook);
                                        router.push(pathForPage('records'));
                                      }
                                      if (editing) setNotice('交易已更新');
                                    }}
                                  />
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    className={entryStyles.back}
                                    onClick={() => setEntryMode('ai')}
                                  >
                                    <ArrowLeft size={18} />
                                    {tr('返回交给小熊')}
                                  </Button>
                                  <h2>{tr('导入已有账单')}</h2>
                                  <small>
                                    {tr(
                                      '选择从微信或支付宝导出的 CSV 账单（5MB 以内），逐笔生成草稿，核对后再入账。',
                                    )}
                                  </small>
                                  <div className={entryStyles.row}>
                                    <label className={entryStyles.upload}>
                                      <Upload size={18} />
                                      {tr('选择 CSV 账单文件')}
                                      <input
                                        type="file"
                                        accept=".csv"
                                        disabled={busy}
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          run(() => importCSV(file));
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  </div>
                                </>
                              )}
                            </section>
                            {entryMode !== 'family' && drafts.length > 0 && (
                              <DraftReview
                                focusRequest={reviewFocus}
                                book={book}
                                books={books}
                                drafts={drafts}
                                setDrafts={setDrafts}
                                accounts={availableAccounts}
                                recentCategories={rows.map(r => r.category)}
                                originals={originals}
                                busy={busy || !canWrite}
                                onSaveOne={item =>
                                  run(async () => {
                                    await recordOne(item);
                                    if (activeBook.current === book) {
                                      setDrafts(old => old.filter(d => d.id !== item.id));
                                      await intake.flush();
                                      await refresh();
                                    }
                                  })
                                }
                                onReview={() => run(reviewDrafts)}
                                onSave={() =>
                                  run(async () => {
                                    if (
                                      drafts.length !== 1 ||
                                      drafts[0].action === 'skip' ||
                                      drafts[0].action === 'merge'
                                    )
                                      return saveDrafts();
                                    await recordOne(drafts[0]);
                                    setDrafts([]);
                                    setImages([]);
                                    setText('');
                                    await Promise.all([intake.flush(), photos.flush()]);
                                    await refresh();
                                  })
                                }
                              />
                            )}
                            {entryMode !== 'family' && !editing && canWrite && manual.ready && (
                              <TemplatesPanel
                                items={templateItems}
                                current={manual.value}
                                accounts={availableAccounts}
                                onSave={async (value, method) => {
                                  await api('books/' + book + '/templates', method, value);
                                  await refresh();
                                }}
                                onDelete={async id => {
                                  if (
                                    !(await confirmEntryAction(
                                      tr('删除常用'),
                                      templateItems.find(item => item.id === id)?.name || tr('删除常用'),
                                    ))
                                  )
                                    throw new Error('');
                                  await api('books/' + book + '/templates', 'DELETE', { id });
                                  await refresh();
                                }}
                                onUse={async value => {
                                  setEntryMode('manual');
                                  manual.setValue({ ...value, id: newId(), date: today() });
                                  await manual.flush();
                                  await manual.reload();
                                  requestAnimationFrame(() =>
                                    document
                                      .getElementById('entry-editor')
                                      ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
                                  );
                                }}
                              />
                            )}
                          </>
                        );
                      }}
                    </EntrySaveFeedback>
                  )}
                  {page === 'schedules' && (
                    <>
                      <Segmented
                        tabs
                        className={planStyles.tabs}
                        label={tr('计划与分摊')}
                        value={planTab === 'cost' ? 'allocation' : planTab}
                        onChange={setPlanTab}
                        options={[
                          ['renewal', '周期收支'],
                          ['installments', '分期与还款'],
                          ['allocation', '费用分摊'],
                          ['templates', '模板'],
                        ].map(([value, label]) => ({ value, label: tr(label) }))}
                      />
                      {(planTab === 'cost' || planTab === 'allocation') && (
                        <Segmented
                          tabs
                          className={planStyles.tabs}
                          label={tr('费用分摊')}
                          value={planTab}
                          onChange={setPlanTab}
                          options={[
                            { value: 'cost', label: tr('费用归属与分担') },
                            { value: 'allocation', label: tr('按月看费用') },
                          ]}
                        />
                      )}
                      {planTab === 'templates' &&
                        (canWrite && manual.ready ? (
                          <EntrySaveFeedback>
                            {(_, confirm) => (
                              <TemplatesPanel
                                items={templateItems}
                                current={manual.value}
                                accounts={availableAccounts}
                                onSave={async (value, method) => {
                                  await api('books/' + book + '/templates', method, value);
                                  await refresh();
                                }}
                                onDelete={async id => {
                                  if (
                                    !(await confirm(
                                      tr('删除常用'),
                                      templateItems.find(item => item.id === id)?.name || tr('删除常用'),
                                    ))
                                  )
                                    throw Error('');
                                  await api('books/' + book + '/templates', 'DELETE', { id });
                                  await refresh();
                                }}
                                onUse={async value => {
                                  setEntryMode('manual');
                                  manual.setValue({ ...value, id: newId(), date: today() });
                                  await manual.flush();
                                  await manual.reload();
                                  router.push(pathForPage('entry'));
                                }}
                              />
                            )}
                          </EntrySaveFeedback>
                        ) : (
                          <p>{canWrite ? tr('正在读取…') : tr('只读账本')}</p>
                        ))}
                      {planTab === 'cost' && (
                        <CostProjects
                          scheduleTarget={scheduleDiscussionTarget}
                          onClearScheduleTarget={() => setScheduleDiscussionTarget(undefined)}
                          initialId={costTarget}
                          onClearTarget={() => setCostTarget(undefined)}
                          month={month}
                          seed={costSeed}
                          onClearSeed={() => setCostSeed(undefined)}
                        />
                      )}
                      {planTab === 'allocation' && (
                        <AllocationPanel
                          book={book}
                          month={month}
                          revision={revision}
                          canWrite={canWrite}
                          onSaved={() => {
                            refresh().catch(e => setError(e.message));
                          }}
                        />
                      )}
                      {planTab === 'installments' && (
                        <InstallmentsPanel
                          key={installmentSeed?.id || 'plans'}
                          book={book}
                          books={books}
                          accounts={availableAccounts}
                          categories={categoryItems}
                          seed={installmentSeed}
                          onClearSeed={() => setInstallmentSeed(null)}
                          onChanged={refresh}
                          onAccounts={() => router.push(pathForPage('accounts'))}
                        />
                      )}
                    </>
                  )}
                  {page === 'schedules' && planTab === 'renewal' && (
                    <SchedulesPanel
                      items={scheduleItems}
                      accounts={availableAccounts}
                      categories={categoryItems}
                      canWrite={canWrite}
                      onChange={async body => {
                        const result = await api('books/' + book + '/schedules', 'POST', body);
                        await refresh();
                        setNotice(
                          result.alreadyProcessed ? '这个账期已处理，没有重复入账' : '周期账单已更新',
                        );
                      }}
                    />
                  )}
                  {page === 'budget' && (
                    <BudgetPanel
                      revision={revision}
                      key={book + month}
                      book={book}
                      month={month}
                      budgets={budgets}
                      spending={spending}
                      categories={categoryItems.filter(c => !c.archived).map(c => c.name)}
                      canWrite={canWrite}
                      onSave={async b => {
                        await api('books/' + book + '/budgets', 'PUT', { month, ...b });
                        await refresh();
                        setNotice('预算已更新');
                      }}
                      onDelete={async category => {
                        await api('books/' + book + '/budgets', 'DELETE', { month, category });
                        await refresh();
                        setNotice('预算已删除，消费记录保留');
                      }}
                    />
                  )}
                  {page === 'chat' && (
                    <FinanceChat
                      onNavigate={target => {
                        if (target in pagePaths || target === 'records')
                          router.push(pathForPage(target), { scroll: false });
                      }}
                      books={books}
                      onChanged={async () => {
                        await init();
                        await refresh();
                      }}
                      initialTarget={searchNavigation || undefined}
                      onTargetOpened={() => setSearchNavigation(null)}
                      initialPrompt={chatPrefill || undefined}
                      onPromptOpened={() => setChatPrefill(null)}
                      book={book}
                      month={month}
                      canWrite={books.some(b => b.role !== 'viewer')}
                      onDrafts={incoming => openDrafts(incoming)}
                    />
                  )}
                  {page === 'settings' && (
                    <section className={settingsStyles.settingsSections}>
                      <SectionTabs
                        label={tr('账本设置')}
                        value={settingsTab}
                        onChange={setSettingsTab}
                        items={[
                          {
                            key: 'categories',
                            label: tr('分类管理'),
                            content: (
                              <CategoryPanel
                                items={categoryItems}
                                canWrite
                                onSave={async value => {
                                  await api('books/' + book + '/categories', 'PUT', value);
                                  await refresh();
                                  setNotice(
                                    '个人分类已更新，并应用到你的所有账本；如有未同步草稿，请重新读取云端版本。',
                                  );
                                }}
                              />
                            ),
                          },
                          ...(user.admin
                            ? [
                                {
                                  key: 'models',
                                  label: tr('AI 配置'),
                                  content: (
                                    <div className={settingsStyles.settingsGrid}>
                                      <ModelSettingsPanel
                                        scope="recognition"
                                        config={config}
                                        onSave={async value => {
                                          await api('ai-settings', 'PUT', value);
                                          setConfig({ ...value, key: '', hasKey: true });
                                          setNotice('账单识别模型配置已保存');
                                        }}
                                        onTest={async () => {
                                          await api('ai-settings', 'POST', { background: true });
                                          setNotice('账单识别模型连接测试已提交，请在后台任务查看结果');
                                        }}
                                      />
                                      <ModelSettingsPanel
                                        scope="assistant"
                                        config={assistantConfig}
                                        onSave={async value => {
                                          await api('assistant-ai-settings', 'PUT', value);
                                          setAssistantConfig({ ...value, key: '', hasKey: true });
                                          setNotice('AI 助手模型配置已保存');
                                        }}
                                        onTest={async () => {
                                          await api('assistant-ai-settings', 'POST', { background: true });
                                          setNotice('AI 助手模型连接测试已提交，请在后台任务查看结果');
                                        }}
                                      />
                                    </div>
                                  ),
                                },
                                {
                                  key: 'queue',
                                  label: tr('任务队列'),
                                  content: <QueueSettings />,
                                },
                              ]
                            : []),
                        ]}
                      />
                    </section>
                  )}
                </>
              )}
            </main>
            <MobileTabBar page={page} onMenu={() => setMenuOpen(true)} />
          </div>
        </div>
      </EntryDetailContext.Provider>
    </CategoryIcons.Provider>
  );
}
