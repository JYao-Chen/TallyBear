import { migrate, migrateWith } from './migrate.mjs';
// Real app + disposable PostgreSQL. Never loads production configuration or calls AI.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import sharp from 'sharp';

const root = process.cwd(),
  output = resolve(process.env.SCREENSHOT_DIR || 'docs/screenshots/v2');
const runtime = process.env.SCREENSHOT_RUNTIME;
assert.ok(runtime, 'Set SCREENSHOT_RUNTIME to a disposable build directory');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const translations = JSON.parse(await readFile('src/lib/locales/en.json', 'utf8'));
const container = 'tallybear-readme-' + Date.now(),
  password = randomBytes(20).toString('hex');
const services = [],
  captures = [],
  errors = [],
  untranslated = [];
let browser;
await mkdir(output, { recursive: true });
await mkdir(runtime, { recursive: true });
await cp('.next/standalone', runtime, { recursive: true });
await cp('.next/static', resolve(runtime, '.next/static'), { recursive: true });
await cp('public', resolve(runtime, 'public'), { recursive: true });
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const pause = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn) {
  for (let n = 0; n < 60; n++) {
    try {
      if (await fn()) return;
    } catch {}
    await pause(500);
  }
  throw Error('Local screenshot service did not become ready');
}
const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7);
async function seed(db, lang) {
  const en = lang === 'en',
    label = (zh, enText) => (en ? enText : zh);
  const user = randomUUID(),
    sam = randomUUID(),
    book = randomUUID(),
    privateBook = randomUUID(),
    family = randomUUID(),
    token = randomUUID();
  await migrateWith(db);
  await db.query('INSERT INTO deployment_settings VALUES(1,$1)', [en ? 'USD' : 'CNY']);
  for (const [id, name, username] of [
    [user, label('小悠', 'Alex'), 'alex.demo'],
    [sam, label('小林', 'Sam'), 'sam.demo'],
  ])
    await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$3,$4,true)', [
      id,
      username,
      name,
      'demo-login-disabled',
    ]);
  await db.query('INSERT INTO families(id,name,owner_id) VALUES($1,$2,$3)', [
    family,
    label('我们的家', 'Our household'),
    user,
  ]);
  for (const id of [user, sam]) await db.query('INSERT INTO family_members VALUES($1,$2)', [family, id]);
  for (const [id, name, kind, icon] of [
    [book, label('一起过日子', 'Everyday together'), 'shared', '🏡'],
    [privateBook, label('我的小账本', 'Personal journal'), 'private', '📒'],
  ]) {
    await db.query(
      'INSERT INTO books(id,name,kind,owner_id,icon,family_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        id,
        name,
        kind,
        user,
        icon,
        kind === 'shared' ? family : null,
        kind === 'shared' ? '2026-01-01' : '2026-02-01',
      ],
    );
    await db.query("INSERT INTO members VALUES($1,$2,'owner')", [id, user]);
  }
  await db.query("INSERT INTO members VALUES($1,$2,'editor')", [book, sam]);
  const wallets = [];
  for (const [name, type, opening] of [
    [label('微信钱包', 'Daily wallet'), 'cash', 350000],
    [label('储蓄卡', 'Bank account'), 'bank', 1250000],
    [label('信用卡', 'Credit card'), 'credit', -48000],
  ]) {
    const id = randomUUID();
    wallets.push(id);
    await db.query(
      "INSERT INTO accounts(id,name,type,owner_id,ownership,opening) VALUES($1,$2,$3,$4,'personal',$5)",
      [id, name, type, user, opening],
    );
  }
  const sharedWallet = randomUUID();
  await db.query(
    "INSERT INTO accounts(id,name,type,family_id,ownership,opening) VALUES($1,$2,'cash',$3,'shared',80000)",
    [sharedWallet, label('家庭共同钱包', 'Household wallet'), family],
  );
  const categories = [
    ['餐饮', 'Dining', '🍜'],
    ['买菜', 'Groceries', '🥬'],
    ['交通', 'Transport', '🚇'],
    ['购物', 'Shopping', '🛍️'],
    ['会员订阅', 'Subscriptions', '🎟️'],
    ['旅行', 'Travel', '🧳'],
    ['工资', 'Salary', '💼'],
    ['居家', 'Home', '🏡'],
  ];
  for (const [position, [zh, name, icon]] of categories.entries())
    await db.query('INSERT INTO category_preferences(user_id,name,icon,position) VALUES($1,$2,$3,$4)', [
      user,
      label(zh, name),
      icon,
      position,
    ]);
  const activity = randomUUID();
  await db.query(
    'INSERT INTO activities(id,owner_id,name,description,category,family_id,starts_on,ends_on,budget) VALUES($1,$2,$3,$4,$5,$6,$7,$8,180000)',
    [
      activity,
      user,
      label('周末山海之旅', 'Coast & hills weekend'),
      label('两天一夜，一起看海与徒步。', 'A weekend of coastal walks and good food.'),
      label('旅行', 'Travel'),
      family,
      month + '-18',
      month + '-20',
    ],
  );
  const data = [
    ['早餐与咖啡', 'Breakfast & coffee', 2800, 0],
    ['新鲜水果', 'Fresh fruit', 3650, 1],
    ['地铁通勤', 'Metro commute', 600, 2],
    ['家庭晚餐', 'Family dinner', 16800, 0],
    ['日常用品', 'Household essentials', 8900, 3],
    ['iCloud 200GB', 'iCloud 200GB', 2100, 4],
    ['周末民宿', 'Coastal guesthouse', 48000, 5],
    ['城际火车', 'Intercity train', 15600, 2],
    ['山间午餐', 'Lunch on the trail', 7800, 0],
    ['蔬菜与牛奶', 'Vegetables & milk', 6380, 1],
    ['音乐会员', 'Music subscription', 1800, 4],
    ['烤鱼晚餐', 'Grilled fish dinner', 13800, 0],
  ];
  const transactions = [];
  for (let n = 0; n < 30; n++) {
    const [zh, name, amount, category] = data[n % data.length],
      id = randomUUID();
    transactions.push(id);
    const day = String((n % 24) + 1).padStart(2, '0');
    await db.query(
      "INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,payee,category,created_by,order_id,occurred_at) VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8,$9,$10,'12:30:00')",
      [
        id,
        n % 7 === 6 ? privateBook : book,
        wallets[n % 3],
        amount,
        month + '-' + day,
        label(zh, name),
        label('生活小店', 'Neighborhood store'),
        label(categories[category][0], categories[category][1]),
        user,
        'DEMO-' + String(n + 1).padStart(4, '0'),
      ],
    );
    if ([6, 7, 8].includes(n))
      await db.query('INSERT INTO activity_entries VALUES($1,$2,$3)', [id, user, activity]);
  }
  await db.query(
    "INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,category,created_by) VALUES($1,$2,$3,'income',1200000,$4,$5,$6,$7)",
    [
      randomUUID(),
      book,
      wallets[1],
      month + '-05',
      label('九月工资', 'Monthly salary'),
      label('工资', 'Salary'),
      user,
    ],
  );
  for (const [index, [zh, name]] of categories.slice(0, 6).entries())
    await db.query('INSERT INTO budgets VALUES($1,$2,$3,$4)', [
      book,
      month,
      label(zh, name),
      [180000, 80000, 50000, 100000, 15000, 180000][index],
    ]);
  for (const [name, amount] of [
    ['iCloud 200GB', 2100],
    [label('音乐会员', 'Music subscription'), 1800],
    [label('房租', 'Rent'), 280000],
  ])
    await db.query(
      "INSERT INTO bill_schedules(id,book_id,user_id,name,value,frequency,next_date,anchor_day) VALUES($1,$2,$3,$4,$5,'monthly',$6,28)",
      [
        randomUUID(),
        book,
        user,
        name,
        JSON.stringify({
          kind: 'expense',
          amount,
          accountId: wallets[1],
          category: label('会员订阅', 'Subscriptions'),
          title: name,
        }),
        month + '-28',
      ],
    );
  const lineItems = [
    {
      id: randomUUID(),
      kind: 'item',
      name: label('鲜牛奶 1L', 'Fresh milk 1L'),
      quantity: 2,
      unitPrice: 1590,
      amount: 3180,
    },
    {
      id: randomUUID(),
      kind: 'item',
      name: label('时令蔬菜组合', 'Seasonal vegetables'),
      quantity: 1,
      unitPrice: 2600,
      amount: 2600,
    },
    {
      id: randomUUID(),
      kind: 'discount',
      name: label('满减优惠', 'Basket discount'),
      quantity: null,
      unitPrice: null,
      amount: -500,
    },
    {
      id: randomUUID(),
      kind: 'fee',
      name: label('配送费', 'Delivery fee'),
      quantity: null,
      unitPrice: null,
      amount: 300,
    },
  ];
  const draft = {
    id: randomUUID(),
    kind: 'expense',
    amount: 5580,
    date: month + '-25',
    occurredAt: '18:42:00',
    title: label('牛奶与蔬菜', 'Milk & vegetables'),
    payee: label('田园生鲜', 'Green Market'),
    product: label('鲜牛奶 2瓶，时令蔬菜', 'Two bottles of milk and seasonal vegetables'),
    category: label('买菜', 'Groceries'),
    accountId: wallets[0],
    orderId: 'DEMO-ORDER-0025',
    platform: label('生鲜到家', 'Grocery delivery'),
    note: label('周末家庭聚餐。', 'For our weekend dinner.'),
    lineItems,
  };
  for (const id of [book, privateBook])
    await db.query("INSERT INTO entry_drafts(book_id,user_id,section,value) VALUES($1,$2,'intake',$3)", [
      id,
      user,
      JSON.stringify({
        text: label('买了牛奶和蔬菜，实付55.80元。', 'Milk and vegetables, paid $55.80.'),
        entries: [draft],
        history: true,
      }),
    ]);
  for (const [title, kind, content, category] of [
    [
      label('鲜牛奶 1L', 'Fresh milk 1L'),
      'product',
      label('早餐常买的鲜牛奶，1升装。', 'The one-liter milk we buy for breakfast.'),
      1,
    ],
    ['iCloud 200GB', 'product', label('家庭共享云空间，200GB套餐。', 'Shared cloud storage, 200GB plan.'), 4],
    [
      label('订阅单独分类', 'Keep subscriptions separate'),
      'preference',
      label('云空间和音乐会员归入会员订阅。', 'Use Subscriptions for cloud storage and music memberships.'),
      4,
    ],
    [
      label('咖啡豆 250g', 'Coffee beans 250g'),
      'product',
      label('中度烘焙，250克装。', 'Medium roast, 250g bag.'),
      1,
    ],
    [
      label('旅行住宿偏好', 'Travel lodging preference'),
      'preference',
      label('住宿单独记录，并关联对应活动。', 'Keep accommodation separate and link it to the trip.'),
      5,
    ],
  ]) {
    const id = randomUUID(),
      attributes = {
        category: label(categories[category][0], categories[category][1]),
        specification: title.includes('200GB') ? '200GB' : '',
        canonicalName: title,
      };
    await db.query(
      "INSERT INTO memories(id,owner_id,kind,title,content,attributes,status,explicit) VALUES($1,$2,$3,$4,$5,$6,'active',true)",
      [id, user, kind, title, content, JSON.stringify(attributes)],
    );
    await db.query("INSERT INTO memory_events(user_id,memory_id,operation) VALUES($1,$2,'save')", [user, id]);
  }
  const movement = randomUUID();
  await db.query(
    "INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,kind,amount,date,note,status) VALUES($1,$2,$3,$4,$5,'aa',8400,$6,$7,'pending')",
    [movement, family, user, sam, wallets[0], month + '-24', label('周末晚餐AA', 'Weekend dinner split')],
  );
  const samWallet = randomUUID();
  await db.query(
    "INSERT INTO accounts(id,name,type,owner_id,ownership,opening) VALUES($1,$2,'cash',$3,'personal',90000)",
    [samWallet, label('日用现金', 'Pocket money'), sam],
  );
  for (const [payer, source, amount] of [
    [user, wallets[0], 50000],
    [sam, samWallet, 30000],
  ]) {
    await db.query(
      "INSERT INTO family_movements(id,family_id,sender_id,source_id,target_id,kind,amount,date,status) VALUES($1,$2,$3,$4,$5,'contribution',$6,$7,'confirmed')",
      [randomUUID(), family, payer, source, sharedWallet, amount, month + '-01'],
    );
  }
  for (const amount of [2000, 3500]) {
    await db.query(
      "INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,kind,amount,date,status) VALUES($1,$2,$3,$4,$5,'transfer',$6,$7,'pending')",
      [randomUUID(), family, sam, user, samWallet, amount, month + '-02'],
    );
  }
  for (const [zh, english, amount, category] of [
    ['厨房用品', 'Kitchen supplies', 4800, 7],
    ['周末车票', 'Weekend fare', 3200, 2],
  ]) {
    const id = randomUUID(),
      title = label(zh, english),
      date = month + '-03';
    await db.query(
      "INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,category,created_by) VALUES($1,$2,$3,'expense',$4,$5,$6,$7,$8)",
      [
        id,
        book,
        sharedWallet,
        amount,
        date,
        title,
        label(categories[category][0], categories[category][1]),
        sam,
      ],
    );
    await db.query(
      "INSERT INTO expense_claims(id,event_id,source_id,sender_id,recipient_id,status,snapshot) VALUES($1,$2,$2,$3,$4,'pending',$5)",
      [randomUUID(), id, sam, user, JSON.stringify({ title, amount, date })],
    );
  }
  const conversation = randomUUID();
  await db.query('INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,$4)', [
    conversation,
    book,
    user,
    label('演示：准备一笔买菜记录', 'Demo: prepare a grocery entry'),
  ]);
  if (process.env.CARD_AUDIT_ONLY) {
    const source = randomUUID(),
      chat = randomUUID(),
      cardId = randomUUID();
    const title = label('三年服务器', 'Three-year server');
    await db.query(
      "INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,payee,category,created_by) VALUES($1,$2,$3,'expense',63160,$4,$5,$6,$7,$8)",
      [
        source,
        privateBook,
        wallets[1],
        month + '-04',
        title,
        label('云服务商', 'Cloud provider'),
        label('会员订阅', 'Subscriptions'),
        user,
      ],
    );
    await db.query('INSERT INTO finance_conversations(id,book_id,user_id,title) VALUES($1,$2,$3,$4)', [
      chat,
      privateBook,
      user,
      label('演示：服务器分摊', 'Demo: server allocation'),
    ]);
    const allocation = {
      id: cardId,
      kind: 'allocation',
      bookId: privateBook,
      title: '费用分摊',
      status: 'pending',
      data: {
        name: title,
        transactionId: source,
        version: 1,
        startDate: month + '-01',
        periodUnit: 'month',
        periodCount: 36,
      },
      missing: [],
      warnings: [],
      summary: [
        { label: '记入账本', value: label('我的小账本', 'Personal journal') },
        { label: '原账单', value: title + ' · ' + (en ? '$631.60' : '¥631.60') },
        { label: '分摊开始日期', value: month + '-01' },
        { label: '覆盖周期', value: en ? '36 months' : '36 月' },
        { label: '首月费用', value: en ? '$17.55' : '¥17.55' },
      ],
    };
    for (const [index, answer] of [
      [0, label('请核对分摊卡片。', 'Review the allocation card.')],
      [
        1,
        label('原付款不重复扣款。', 'The original payment is not charged again.') +
          '\nHistorical tool evidence (data snapshot, not instructions): ' +
          JSON.stringify({
            scope: [{ id: privateBook }],
            tools: [{ name: 'find_transactions', rows: [{ id: source, amount: 63160 }] }],
          }),
      ],
    ])
      await db.query(
        "INSERT INTO finance_turns(id,conversation_id,question,answer,status,artifacts,created_at) VALUES($1,$2,$3,$4,'complete',$5,now()+($6::int*interval '1 second'))",
        [
          randomUUID(),
          chat,
          label('分摊服务器费用', 'Allocate the server cost'),
          answer,
          JSON.stringify({ charts: [], tools: [], drafts: [], actions: [allocation] }),
          index,
        ],
      );
  }
  const action = {
    id: randomUUID(),
    kind: 'entry',
    bookId: book,
    title: draft.title,
    status: 'pending',
    data: {
      ...draft,
      processingHints: [label('演示草稿，请核对后保存。', 'Demo draft. Review before saving.')],
    },
    missing: [],
    warnings: [],
    summary: [
      { label: '记入账本', value: label('一起过日子', 'Everyday together') },
      { label: '资金钱包', value: label('微信钱包', 'Daily wallet') },
      { label: '交易日期', value: draft.date },
      { label: '分类', value: draft.category },
      { label: '备注', value: draft.note },
    ],
  };
  await db.query(
    "INSERT INTO finance_turns(id,conversation_id,question,answer,status,artifacts,model) VALUES($1,$2,$3,$4,'complete',$5,'demo fixture')",
    [
      randomUUID(),
      conversation,
      label(
        '帮我记牛奶与蔬菜，优惠5元，配送3元，实付55.80元。',
        'Prepare milk and vegetables: $5 discount, $3 delivery, $55.80 paid.',
      ),
      label(
        '这是演示对话。请核对下面的草稿，确认后才会入账。',
        'This is a demonstration conversation. Review the draft below; it is saved only after confirmation.',
      ),
      JSON.stringify({ charts: [], tools: [], drafts: [], actions: [action], analysisBooks: [book] }),
    ],
  );
  // Sessions store only the SHA-256 digest of the cookie value (migration 0002).
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '3 hours')", [
    createHash('sha256').update(token).digest('hex'),
    user,
  ]);
  if (process.env.FUNDS_AUDIT_ONLY || process.env.ANALYSIS_AUDIT_ONLY) {
    const other = randomUUID();
    await db.query("INSERT INTO accounts(id,name,type,opening,owner_id) VALUES($1,$2,'wechat',100000,$3)", [
      other,
      label('另一位成员的钱包', 'Other member wallet'),
      sam,
    ]);
    for (const [sender, recipient, source, target, amount] of [
      [user, sam, wallets[0], other, 14000],
      [sam, user, other, wallets[0], 5700],
    ])
      await db.query(
        "INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,target_id,kind,amount,date,status) VALUES($1,$2,$3,$4,$5,$6,'transfer',$7,$8,'confirmed')",
        [randomUUID(), family, sender, recipient, source, target, amount, month + '-04'],
      );
    await db.query(
      "INSERT INTO transactions(id,book_id,account_id,target_id,kind,amount,date,title,created_by) VALUES($1,$2,$3,$4,'transfer',10000,$5,$6,$7)",
      [
        randomUUID(),
        book,
        wallets[0],
        wallets[1],
        month + '-04',
        label('自有账户互转', 'Between my wallets'),
        user,
      ],
    );
    await db.query('UPDATE transactions SET event_id=id WHERE id=$1', [transactions[0]]);
    await db.query(
      'INSERT INTO transactions(id,book_id,account_id,kind,amount,date,title,created_by,event_id) SELECT $1,$2,account_id,kind,amount,date,title,created_by,event_id FROM transactions WHERE id=$3',
      [randomUUID(), privateBook, transactions[0]],
    );
  }
  if (process.env.ANALYSIS_AUDIT_ONLY) {
    const server = randomUUID();
    await db.query(
      "INSERT INTO transactions(id,event_id,book_id,account_id,kind,amount,date,title,category,created_by) VALUES($1,$1,$2,$3,'expense',60000,$4,$5,$6,$7)",
      [
        server,
        privateBook,
        wallets[1],
        month + '-01',
        label('三年服务器', 'Three-year server'),
        label('会员订阅', 'Subscriptions'),
        user,
      ],
    );
    await db.query(
      "INSERT INTO expense_allocations(transaction_id,start_month,months,start_date,period_unit,period_count) VALUES($1,$2,36,$2,'month',36)",
      [server, month + '-01'],
    );
  }
  return { token, book, privateBook, conversation };
}
try {
  docker(
    'run',
    '-d',
    '--name',
    container,
    '--label',
    'tallybear.task=readme-screenshots',
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-p',
    '127.0.0.1::5432',
    '--tmpfs',
    '/var/lib/postgresql/data',
    process.env.SCREENSHOT_POSTGRES_IMAGE || 'pgvector/pgvector:0.8.2-pg16',
  );
  const port = docker('port', container, '5432/tcp').split(':').at(-1);
  await waitFor(() => {
    try {
      // TCP only: during initdb the temporary server answers on the socket, then restarts.
      return docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres').includes(
        'accepting',
      );
    } catch {
      return false;
    }
  });
  const admin = new pg.Client({
    connectionString: `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
  });
  await admin.connect();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_CHROMIUM_PATH ? { executablePath: process.env.TEST_CHROMIUM_PATH } : {}),
  });
  const basePort = Number(process.env.SCREENSHOT_BASE_PORT || 3126);
  for (const [lang, httpPort] of [
    ['zh-CN', basePort],
    ['en', basePort + 1],
  ]) {
    const database = lang === 'en' ? 'readme_en_test' : 'readme_zh_test';
    await admin.query('CREATE DATABASE ' + database);
    const databaseUrl = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`;
    const db = new pg.Client({ connectionString: databaseUrl });
    await db.connect();
    const fixture = await seed(db, lang);
    await db.end();
    if (process.env.CHAT_AUDIT_ONLY || process.env.CARD_AUDIT_ONLY)
      console.log(
        execFileSync(resolve(root, 'node_modules/.bin/tsx'), ['--test', 'tests/assistant-books-db.test.ts'], {
          cwd: root,
          env: {
            ...process.env,
            CHAT_TEST_DATABASE_URL: databaseUrl,
            APP_LANGUAGE: lang,
            APP_CURRENCY: lang === 'en' ? 'USD' : 'CNY',
          },
          encoding: 'utf8',
        }),
      );
    if (process.env.FUNDS_AUDIT_ONLY)
      console.log(
        execFileSync(resolve(root, 'node_modules/.bin/tsx'), ['--test', 'tests/wallet-funds-db.test.ts'], {
          cwd: root,
          env: {
            ...process.env,
            FUNDS_TEST_DATABASE_URL: databaseUrl,
            APP_LANGUAGE: lang,
            APP_CURRENCY: lang === 'en' ? 'USD' : 'CNY',
          },
          encoding: 'utf8',
        }),
      );
    if (process.env.ANALYSIS_AUDIT_ONLY) {
      const costDB = lang === 'en' ? 'analysis_en_cost_test' : 'analysis_zh_cost_test';
      await admin.query('CREATE DATABASE ' + costDB);
      const costURL = `postgres://postgres:${password}@127.0.0.1:${port}/${costDB}`;
      const c = new pg.Client({ connectionString: costURL });
      await c.connect();
      await migrate(c);
      await c.end();
      console.log(
        execFileSync(resolve(root, 'node_modules/.bin/tsx'), ['tests/smoke/unified-report-smoke.ts'], {
          cwd: root,
          env: {
            ...process.env,
            SMOKE_DATABASE_URL: costURL,
            APP_LANGUAGE: lang,
            APP_CURRENCY: lang === 'en' ? 'USD' : 'CNY',
          },
          encoding: 'utf8',
        }),
      );
    }
    const origin = 'http://127.0.0.1:' + httpPort;
    const service = spawn(process.execPath, [resolve(runtime, 'server.js')], {
      cwd: runtime,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: String(httpPort),
        DATABASE_URL: databaseUrl,
        APP_ORIGIN: origin,
        APP_LANGUAGE: lang,
        APP_CURRENCY: lang === 'en' ? 'USD' : 'CNY',
        ENCRYPTION_KEY: randomBytes(32).toString('base64'),
        RECEIPT_DIR: resolve(runtime, 'receipts'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    services.push(service);
    service.stdout.on('data', () => {});
    service.stderr.on('data', b => {
      if (b.toString().includes('Error')) console.error(b.toString());
    });
    await waitFor(async () => {
      const response = await fetch(origin + '/api/health');
      return response.ok;
    });
    const t = zh => (lang === 'en' ? translations[zh] || zh : zh);
    for (const [device, width, height] of [
      ['desktop', 1440, 1000],
      ['mobile', 390, 844],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        isMobile: device === 'mobile',
        hasTouch: device === 'mobile',
        locale: lang,
        timezoneId: 'Asia/Shanghai',
        reducedMotion: 'reduce',
      });
      await context.addCookies([
        { name: 'bubu_session', value: fixture.token, domain: '127.0.0.1', path: '/' },
      ]);
      context.setDefaultTimeout(15000);
      context.setDefaultNavigationTimeout(20000);
      console.log('Starting', lang, device);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push({ lang, device, error: e.message }));
      page.on('response', r => {
        if (r.url().includes('/api/') && r.status() >= 400) {
          const failure = { lang, device, status: r.status(), path: new URL(r.url()).pathname };
          errors.push(failure);
          console.warn('API failure', JSON.stringify(failure));
        }
      });
      await page.goto(origin);
      await page.locator('#primary-navigation').waitFor({ state: 'attached' });
      async function settle() {
        await page.waitForLoadState('networkidle');
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await page.waitForTimeout(600);
      }
      // Pages have URLs (src/lib/routes.ts); old labels are kept as names so the capture list reads the same.
      const paths = {
        我的账本: '/',
        流水: '/entries',
        收支分析: '/analysis',
        每月预算: '/analysis/budget',
        活动账: '/analysis/activities',
        资金资产: '/wallets',
        计划与分摊: '/wallets/plans',
        家庭管理: '/family',
        小熊对话: '/assistant',
        个人资料: '/me',
        账本设置: '/settings',
        账本管理: '/settings/books',
        使用说明: '/help',
        记一笔: '/entry',
      };
      async function navigate(name) {
        assert.ok(paths[name], 'No URL for ' + name);
        await page.goto(origin + paths[name]);
        await page.locator('#primary-navigation').waitFor({ state: 'attached' });
        await settle();
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      async function audit(key) {
        await settle();
        if (lang === 'en') {
          const text = await page.locator('body').innerText();
          const lines = text.split('\n').filter(line => /[\u3400-\u9fff]/.test(line));
          if (lines.length) {
            untranslated.push({ device, feature: key, lines });
            console.warn('Untranslated UI:', key, JSON.stringify(lines));
          }
        }
      }
      async function shot(key) {
        await audit(key);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${lang}/${device}/${key} overflow`);
        const filename = `${lang === 'en' ? 'en' : 'zh'}-${device}-${key}.webp`;
        await sharp(
          await page.screenshot({
            animations: 'disabled',
            fullPage: key === 'profile-book-rule' || key.startsWith('analysis-'),
          }),
        )
          .webp({ quality: 90 })
          .toFile(resolve(output, filename));
        captures.push({ file: filename, language: lang, device, width, height, feature: key });
        console.log(filename);
      }
      if (process.env.CARD_AUDIT_ONLY) {
        await navigate('小熊对话');
        await page.getByRole('button', { name: t('打开对话历史和报告'), exact: true }).click();
        await page
          .getByText(lang === 'en' ? 'Demo: server allocation' : '演示：服务器分摊', { exact: true })
          .click();
        await settle();
        const card = page.locator('.chat-action-card');
        assert.equal(await card.count(), 1);
        assert.equal(await card.locator('details').getAttribute('open'), '');
        assert.match(await card.innerText(), /17\.55/);
        assert.equal(
          (await page.locator('.finance-narrative').allInnerTexts())
            .join('')
            .includes('Historical tool evidence'),
          false,
        );
        await card.scrollIntoViewIfNeeded();
        if (await card.getByRole('button', { name: t('确认保存'), exact: true }).count()) {
          await shot('card-pending');
          await card.getByRole('button', { name: t('确认保存'), exact: true }).click();
          await settle();
        }
        assert.ok((await card.innerText()).includes(t('已保存')));
        assert.equal(await card.locator('details').getAttribute('open'), '');
        await shot('card-confirmed');
        await page.reload();
        await settle();
        await navigate('小熊对话');
        await page.getByRole('button', { name: t('打开对话历史和报告'), exact: true }).click();
        await page
          .getByText(lang === 'en' ? 'Demo: server allocation' : '演示：服务器分摊', { exact: true })
          .click();
        await settle();
        assert.equal(await page.locator('.chat-action-card').count(), 1);
        await page.locator('.chat-action-card').scrollIntoViewIfNeeded();
        assert.match(await page.locator('.chat-action-card').innerText(), /17\.55/);
        await shot('card-reopened');
        await context.close();
        continue;
      }
      if (process.env.ANALYSIS_AUDIT_ONLY) {
        await navigate('流水');
        await page.getByRole('button', { name: t('筛选'), exact: true }).click();
        const filters = page.getByRole('dialog', { name: t('筛选') });
        await filters
          .getByRole('checkbox', { name: lang === 'en' ? 'Personal journal' : '我的小账本' })
          .check();
        await filters.getByRole('button', { name: t('完成选择') }).click();
        const serverTitle = lang === 'en' ? 'Three-year server' : '三年服务器';
        await page.getByRole('textbox', { name: t('搜索流水') }).fill(serverTitle);
        await page
          .getByRole('button', { name: t('查看{0}详情').replace('{0}', serverTitle), exact: true })
          .first()
          .click();
        await page.getByRole('button', { name: t('打开原账单') }).waitFor();
        await shot('entry-cost-detail');
        await navigate('收支分析');
        await page.getByRole('region', { name: t('分析图表') }).waitFor();
        await shot('analysis-books');
        await page
          .getByRole('button', {
            name: lang === 'en' ? 'Everyday together' : '一起过日子',
            exact: true,
          })
          .click();
        await shot('analysis-book-choices');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: lang === 'en' ? 'Done' : '完成选择', exact: true })
          .click();
        await page.getByRole('button', { name: new RegExp(t('我的费用')) }).click();
        await settle();
        await page.getByRole('region', { name: t('分析图表') }).waitFor();
        await shot('analysis-personal');
        const values = await page.evaluate(
          async ({ book, month }) => {
            const p = 'from=' + month + '-01&to=' + month + '-28&scope=personal_expense';
            const data = await fetch('/api/books/' + book + '/report?' + p).then(r => r.json());
            return { data };
          },
          { book: fixture.book, month },
        );
        assert.ok(
          values.data.rows.some(
            r => r.title === (lang === 'en' ? 'Three-year server' : '三年服务器') && r.amount < 1700,
          ),
        );
        await page.getByRole('tab', { name: t('明细'), exact: true }).click();
        await page.getByRole('combobox', { name: t('收支类型') }).selectOption('expense', { force: true });
        await page.getByRole('textbox', { name: t('搜索流水') }).fill(lang === 'en' ? 'server' : '服务器');
        await settle();
        await page.getByRole('region', { name: t('分析图表') }).waitFor();
        await page.getByRole('tab', { name: lang === 'en' ? 'Entries' : '明细', exact: true }).click();
        assert.equal(
          await page
            .getByRole('tabpanel')
            .getByRole('button', { name: /查看.*详情|^View /i, includeHidden: true })
            .count(),
          1,
        );
        await shot('analysis-filtered');
        await page.getByRole('tab', { name: lang === 'en' ? 'Overview' : '概览', exact: true }).click();
        await page
          .getByRole('region', { name: t('分析图表') })
          .getByRole('group', { name: t('图例') })
          .getByRole('button', { disabled: false })
          .first()
          .click();
        await settle();
        await shot('analysis-drilldown');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: t('关闭弹窗'), exact: true })
          .click();
        await page.getByRole('button', { name: new RegExp(t('钱包资金流')) }).click();
        await settle();
        await page.locator('.funds-list>button').first().waitFor();
        assert.equal(await page.getByRole('region', { name: t('收支明细') }).count(), 0);
        assert.equal(await page.getByLabel(t('筛选结果汇总')).count(), 0);
        await shot('analysis-wallets');
        await page.locator('.funds-filters select').selectOption('transfer');
        await settle();
        assert.equal(await page.locator('.funds-list>button').count(), 2);
        await shot('analysis-transfers');
        await page.locator('.funds-list>button').first().click();
        await shot('analysis-transfer-detail');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: t('关闭弹窗'), exact: true })
          .click();
        await page.locator('.funds-wallet-choice select').selectOption({ index: 1 }, { force: true });
        await settle();
        await shot('analysis-single-wallet');
        await page.getByRole('button', { name: /^Wallet owner:|^钱包归属:/ }).click();
        await page
          .getByRole('dialog')
          .getByRole('button', { name: lang === 'en' ? 'Our household' : '我们的家', exact: true })
          .click();
        await settle();
        await shot('analysis-family-wallets');
        if (device === 'mobile') {
          await page.setViewportSize({ width: 360, height: 800 });
          await shot('analysis-family-360');
        }
        await context.close();
        continue;
      }
      if (process.env.CHAT_AUDIT_ONLY) {
        await navigate('小熊对话');
        assert.equal(await page.locator('.chat-scope').count(), 0);
        await shot('assistant-unified');
        await page.getByRole('button', { name: t('打开对话历史和报告'), exact: true }).click();
        await page
          .getByText(lang === 'en' ? 'Demo: prepare a grocery entry' : '演示：准备一笔买菜记录', {
            exact: true,
          })
          .click();
        await page.locator('.chat-action-card').waitFor();
        await page
          .locator('.chat-action-card')
          .getByRole('button', { name: t('继续修改'), exact: true })
          .click();
        await page.locator('.chat-inline-editor').waitFor();
        await shot('assistant-book-editor');
        await page
          .locator('.chat-inline-editor')
          .getByRole('button', { name: new RegExp('^' + t('记入账本')) })
          .click();
        await shot('assistant-book-choices');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: lang === 'en' ? 'Personal journal' : '我的小账本', exact: false })
          .click();
        await page
          .locator('.chat-inline-editor')
          .getByRole('button', { name: t('更新卡片'), exact: true })
          .click();
        await page.locator('.chat-inline-editor').waitFor({ state: 'hidden' });
        await settle();
        await page.locator('.chat-action-card').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('assistant-book-updated');
        await navigate('个人资料');
        await page.getByRole('button', { name: t('个人画像'), exact: true }).click();
        await page
          .getByRole('button', { name: lang === 'en' ? 'Habits & rules' : '场景与规则', exact: true })
          .click();
        await settle();
        await page
          .getByRole('button', { name: lang === 'en' ? 'Add rule' : '新增规则', exact: true })
          .click();
        await page.locator('.portrait-rule-editor').waitFor();
        await page
          .locator('.portrait-rule-editor fieldset')
          .last()
          .locator('select')
          .first()
          .selectOption('bookId');
        await page.locator('.portrait-rule-editor').scrollIntoViewIfNeeded();
        await shot('profile-book-rule');
        await context.close();
        continue;
      }
      if (process.env.FUNDS_AUDIT_ONLY) {
        await navigate('收支分析');
        await page.getByRole('button', { name: t('我的个人钱包'), exact: false }).click();
        await settle();
        await page.locator('.wallet-funds').waitFor();
        await page.locator('.funds-list>button').first().waitFor();
        const data = await page.evaluate(async month => {
          const r = await fetch(
            '/api/assets/report?from=' + month + '-01&to=' + month + '-28&owner=personal',
          );
          return r.json();
        }, month);
        assert.equal(data.funds.summary.transferOut, 14000);
        assert.equal(data.funds.summary.transferIn, 5700);
        assert.equal(data.funds.summary.internalTransfer, 10000);
        assert.equal(data.funds.summary.closingBalance, data.summary.netAssets);
        assert.equal(data.funds.count, 34);
        await page.locator('.wallet-funds').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('funds-summary');
        await page.locator('.funds-filters select').selectOption('transfer');
        await settle();
        assert.equal(await page.locator('.funds-list>button').count(), 2);
        await page.locator('.funds-filters').scrollIntoViewIfNeeded();
        await shot('funds-transfers');
        await page.locator('.funds-list>button').first().click();
        await shot('funds-detail');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: t('关闭弹窗'), exact: true })
          .click();
        const chooseSort = async (scope, value) => {
          await scope.getByRole('combobox', { name: t('明细排序') }).selectOption(value, { force: true });
          await settle();
        };
        await page.locator('.funds-filters select').selectOption('all');
        await chooseSort(page.locator('.wallet-funds'), 'amount_desc');
        await page
          .locator('.wallet-funds')
          .getByRole('combobox', { name: t('明细排序') })
          .scrollIntoViewIfNeeded();
        await shot('funds-sorted');
        await page.getByRole('region', { name: t('收支明细') }).scrollIntoViewIfNeeded();
        await chooseSort(page.getByRole('region', { name: t('收支明细') }), 'amount_desc');
        await page
          .getByRole('region', { name: t('收支明细') })
          .getByRole('combobox', { name: t('明细排序') })
          .evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('records-sorted');
        await page
          .getByRole('figure')
          .getByRole('group', { name: t('图例') })
          .getByRole('button', { disabled: false })
          .first()
          .click();
        await settle();
        await chooseSort(page.getByRole('dialog'), 'amount_asc');
        await shot('chart-sorted');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: t('关闭弹窗'), exact: true })
          .click();
        await navigate('活动账');
        await page.getByRole('button', { name: /周末山海之旅|Coast & hills weekend/ }).click();
        await chooseSort(page.getByRole('region', { name: t('活动明细') }), 'amount_desc');
        await page
          .getByRole('region', { name: t('活动明细') })
          .getByRole('combobox', { name: t('明细排序') })
          .evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('activity-sorted');
        await navigate('记一笔');
        await page.getByRole('button', { name: t('家庭往来'), exact: true }).click();
        await settle();
        await page.getByRole('region', { name: t('家庭资金往来'), exact: true }).waitFor();
        await chooseSort(page.getByRole('region', { name: t('家庭资金往来'), exact: true }), 'amount_desc');
        await page
          .getByRole('region', { name: t('家庭资金往来'), exact: true })
          .getByRole('combobox', { name: t('明细排序') })
          .evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('family-sorted');
        await page.getByRole('button', { name: t('搜索整个账本系统'), exact: true }).click();
        await settle();
        await page
          .getByRole('combobox', { name: t('搜索结果排序') })
          .selectOption('amount_desc', { force: true });
        await settle();
        await shot('search-sorted');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: t('关闭弹窗'), exact: true })
          .click();
        await navigate('资金资产');
        await page.locator('.wallet-funds').waitFor();
        await page.locator('.wallet-funds').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('asset-funds');
        await context.close();
        continue;
      }
      if (process.env.HELP_FIGURES_ONLY) {
        await navigate('记一笔');
        await page.getByRole('button', { name: t('手动填写'), exact: true }).click();
        await page
          .getByRole('form', { name: t('手动记账') })
          .getByRole('button', { name: t('支出'), exact: true })
          .click();
        await page.getByRole('group', { name: t('录入方式') }).scrollIntoViewIfNeeded();
        await page
          .getByRole('group', { name: t('录入方式') })
          .evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('manual');
        await page.getByRole('button', { name: t('退款'), exact: true }).click();
        await page.locator('.refund-picker').scrollIntoViewIfNeeded();
        await shot('refund');
        await page.getByRole('button', { name: t('微信／支付宝账单'), exact: true }).click();
        await page
          .getByRole('group', { name: t('录入方式') })
          .evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot('import');
        await navigate('小熊对话');
        await page
          .locator('.finance-composer textarea')
          .fill(
            lang === 'en'
              ? 'Please reconcile my September payment statements with my recorded transactions. Check references, neighboring order and repeat purchases before suggesting missing entries.'
              : '请核对我九月的支付流水与已记账记录，结合订单号、相邻顺序和重复购买，找出可能漏记的交易。',
          );
        await shot('reconcile');
        await context.close();
        continue;
      }
      if (process.env.HELP_AUDIT_ONLY) {
        await navigate('使用说明');
        await shot('help');
        assert.equal(
          await page.locator('.help-chapter-header').evaluate(el => getComputedStyle(el).display),
          'block',
        );
        assert.ok(
          await page
            .locator('.help-chapter-header')
            .evaluate(el => el.getBoundingClientRect().height >= el.scrollHeight - 2),
          'Chapter header must contain its text',
        );
        const input = page.locator('.help-search input');
        await input.fill(lang === 'en' ? 'refund' : '退款');
        await page.locator('.help-result').first().waitFor();
        await settle();
        assert.ok(await page.locator('.help-result mark').count());
        await shot('help-search');
        await page.locator('.help-result').first().click();
        await page.locator('.help-content article').waitFor();
        assert.ok(await page.locator('.help-content mark').count());
        await page.locator('.help-section').first().scrollIntoViewIfNeeded();
        await shot('help-steps');
        await page.locator('.help-figure').first().scrollIntoViewIfNeeded();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.help-figure img')].every(i => i.complete && i.naturalWidth > 0),
        );
        await shot('help-article');
        const firstFigure = page.locator('.help-figure').first();
        await firstFigure
          .getByRole('button', {
            name:
              device === 'mobile' ? (lang === 'en' ? 'Desktop' : '电脑') : lang === 'en' ? 'Mobile' : '手机',
            exact: true,
          })
          .click();
        await settle();
        assert.ok(
          (await firstFigure.locator('img').getAttribute('src')).includes(
            device === 'mobile' ? '-desktop-' : '-mobile-',
          ),
        );
        await page.locator('.help-feature-link').first().click();
        await page.getByRole('form', { name: t('手动记账') }).waitFor();
        assert.equal(
          await page.getByRole('button', { name: t('手动填写'), exact: true }).getAttribute('aria-pressed'),
          'true',
        );
        await navigate('使用说明');
        await page.locator('.help-ask').click();
        await page.locator('.finance-composer textarea').waitFor();
        assert.match(
          await page.locator('.finance-composer textarea').inputValue(),
          lang === 'en' ? /help chapter/ : /使用说明/,
        );
        assert.ok(
          !(await page.locator('.finance-main').innerText()).includes(
            t('请上传需要核对的支付账单截图，然后发送消息。'),
          ),
        );
        await navigate('使用说明');
        if (device === 'mobile') await page.locator('.help-mobile-chapters select').selectOption('memory');
        else
          await page
            .locator('.help-topics button')
            .filter({ hasText: lang === 'en' ? 'Personal memory' : '个人记忆' })
            .click();
        await page.locator('.help-feature-link').first().click();
        await page.locator('.memory-row').first().waitFor();
        await navigate('使用说明');
        if (device === 'mobile') await page.locator('.help-mobile-chapters select').selectOption('wallets');
        else
          await page
            .locator('.help-topics button')
            .filter({ hasText: lang === 'en' ? 'Wallets, repayments' : '钱包、还款' })
            .click();
        await page.locator('.help-section-toc a').nth(1).click();
        await shot('help-wallets');
        assert.equal(
          await page
            .locator('.help-example')
            .first()
            .evaluate(el => getComputedStyle(el).position),
          'static',
        );
        assert.ok(
          await page
            .locator('.help-example')
            .first()
            .evaluate(el => el.clientWidth > el.parentElement.clientWidth * 0.9),
          'Example should fill the reading column',
        );
        await context.close();
        continue;
      }
      for (const [name, key] of [
        ['我的账本', 'overview'],
        ['流水', 'entries'],
        ['收支分析', 'analysis'],
        ['资金资产', 'assets'],
        ['活动账', 'activities'],
        ['每月预算', 'budgets'],
        ['账本管理', 'books'],
        ['家庭管理', 'family'],
        ['账本设置', 'categories'],
        ['使用说明', 'help'],
      ]) {
        await navigate(name);
        if (key === 'family') {
          const overview = page.getByRole('region', { name: t('家庭总览') });
          for (const label of ['上月', '近 3 月', '本月']) {
            const response = page.waitForResponse(r => r.url().includes('/family-finance/overview?'));
            await overview.getByRole('button', { name: t(label), exact: true }).click();
            const url = new URL((await response).url());
            const start = new Date(month + '-01T00:00:00Z');
            start.setUTCMonth(start.getUTCMonth() - (label === '上月' ? 1 : label === '近 3 月' ? 2 : 0));
            const end = new Date(month + '-01T00:00:00Z');
            end.setUTCMonth(end.getUTCMonth() + (label === '上月' ? 0 : 1), 0);
            assert.equal(url.searchParams.get('from'), start.toISOString().slice(0, 10));
            assert.equal(url.searchParams.get('to'), end.toISOString().slice(0, 10));
            await overview.getByText(t('本期结余'), { exact: true }).waitFor();
          }
        }
        await shot(key);
        if (key === 'overview') {
          const tasks = page.getByRole('region', { name: t('家庭待办') });
          assert.equal(await tasks.getByRole('button', { name: t('收款'), exact: true }).count(), 2);
          assert.equal(await tasks.getByRole('button', { name: t('查看并认领'), exact: true }).count(), 1);
          assert.equal(
            await tasks.getByRole('link', { name: t('查看全部') }).getAttribute('href'),
            '/family',
          );
          await tasks.evaluate(el => el.scrollIntoView({ block: 'start' }));
          await shot('family-inbox');
        }
        if (key === 'family') {
          const tasks = page.getByRole('region', { name: t('家庭待办') });
          const claims = tasks.getByRole('button', { name: t('查看并认领'), exact: true });
          assert.equal(await claims.count(), 2);
          await claims.first().click();
          const detail = page.getByRole('dialog', { name: t('账单认领') });
          await detail.getByRole('button', { name: t('确认认领') }).waitFor();
          await shot('family-claim');
          await detail.getByRole('button', { name: t('关闭弹窗') }).click();
          await page.getByRole('button', { name: t('移出'), exact: true }).click();
          const confirm = page.getByRole('dialog', { name: t('移出家庭') });
          await confirm.getByRole('button', { name: t('取消'), exact: true }).click();
          await page.getByText(t('为家庭成员设置账本权限'), { exact: true }).click();
          await page.getByRole('button', { name: t('保存账本权限'), exact: true }).click();
          await page
            .getByRole('dialog', { name: t('保存账本权限') })
            .getByRole('button', { name: t('取消'), exact: true })
            .click();
        }
        if (key === 'entries') {
          const records = page.getByRole('region', { name: t('收支明细') });
          const lastMonth = new Date(month + '-01T00:00:00Z');
          lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
          const changedRange = page.waitForRequest(req => {
            const url = new URL(req.url());
            return (
              url.pathname.endsWith('/report') &&
              url.searchParams.get('from') === lastMonth.toISOString().slice(0, 10)
            );
          });
          await records.getByRole('button', { name: t('上月'), exact: true }).click();
          await changedRange;
          await records.getByRole('button', { name: t('本月'), exact: true }).click();
          await records.getByRole('button', { name: t('批量整理'), exact: true }).click();
          await records.getByRole('checkbox', { name: t('选择本页'), exact: true }).check();
          const bar = records.getByRole('button', { name: t('退出多选'), exact: true });
          assert.ok(await bar.evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
          await bar.click();
          await records.getByRole('button', { name: t('筛选'), exact: true }).click();
          const filters = page.getByRole('dialog', { name: t('筛选') });
          await filters
            .getByRole('textbox', {
              name: t('最低金额（元）').replace('CNY', 'USD'),
            })
            .fill('10.01');
          await shot('entries-filters');
          const request = page.waitForRequest(
            r =>
              new URL(r.url()).pathname.endsWith('/report') &&
              new URL(r.url()).searchParams.get('min') === '1001',
          );
          await filters.getByRole('button', { name: t('完成选择') }).click();
          await request;
          await records.getByRole('button', { name: /10\.01/ }).click();
          const title = lang === 'en' ? 'Breakfast & coffee' : '早餐与咖啡';
          await records
            .getByRole('button', { name: t('查看{0}详情').replace('{0}', title), exact: true })
            .first()
            .click();
          const detail = page.getByRole('dialog', { name: t('这笔小记录') });
          await detail.getByRole('button', { name: t('删除记录') }).waitFor();
          await shot('entry-detail');
          await detail.getByRole('button', { name: t('删除记录') }).click();
          await page
            .getByRole('dialog', { name: t('删除记录') })
            .getByRole('button', { name: t('取消') })
            .click();
          await detail.getByRole('tab', { name: t('讨论') }).click();
          const message =
            lang === 'en' ? 'The breakfast receipt matches the amount.' : '早餐小票的金额核对过了。';
          if (!(await detail.getByText(message, { exact: true }).count())) {
            await detail.getByRole('textbox', { name: t('留言给参与成员') }).fill(message);
            await detail.getByRole('button', { name: t('发送留言') }).click();
            await detail.getByText(message, { exact: true }).waitFor();
          }
          await shot('entry-discussion');
          await detail.getByRole('button', { name: t('关闭弹窗') }).click();
        }
        if (key === 'analysis') {
          await page
            .getByRole('region', { name: t('分析图表') })
            .evaluate(el => el.scrollIntoView({ block: 'start' }));
          await shot('charts');
          const result = page.waitForResponse(
            r => r.url().includes('/report?') && new URL(r.url()).searchParams.get('basis') === 'cashflow',
          );
          await page.getByRole('button', { name: t('按付款日'), exact: true }).click();
          assert.equal((await result).status(), 200);
          await page.getByRole('button', { name: t('统计口径说明') }).click();
          await shot('basis');
          await page
            .getByRole('dialog')
            .getByRole('button', { name: t('关闭'), exact: true })
            .click();
        }
        if (key === 'assets') {
          await page
            .getByRole('heading', { name: t('资产与收支分析'), exact: true })
            .evaluate(el => el.scrollIntoView({ block: 'start' }));
          await page
            .getByRole('figure', { name: t('钱包余额分布') })
            .getByText(new RegExp(t('账户余额')))
            .waitFor();
          await shot('account-statistics');
        }
        if (key === 'budgets') {
          await page
            .getByRole('button')
            .filter({ has: page.getByRole('progressbar') })
            .first()
            .click();
          await page.getByRole('button', { name: t('修改预算'), exact: true }).click();
          await page.getByRole('button', { name: t('删除预算'), exact: true }).click();
          await page
            .getByRole('dialog', { name: t('删除预算') })
            .getByRole('button', { name: t('取消'), exact: true })
            .click();
          await page.getByRole('button', { name: t('保存预算') }).waitFor();
        }
        if (key === 'activities') {
          await page.getByRole('button', { name: /周末山海之旅|Coast & hills weekend/ }).click();
          await shot('activity-detail');
          await page.getByRole('button', { name: t('归档此活动') }).click();
          await page
            .getByRole('dialog')
            .getByRole('button', { name: t('取消'), exact: true })
            .click();
          await page.getByRole('button', { name: t('返回活动列表') }).click();
          await page
            .getByRole('heading', { name: t('活动账'), exact: true })
            .first()
            .waitFor();
        }
      }
      await navigate('计划与分摊');
      await page.getByRole('tab', { name: t('周期收支'), exact: true }).click();
      await shot('plans');
      await navigate('个人资料');
      await shot('profile');
      await page.getByRole('button', { name: t('个人画像'), exact: true }).click();
      await page.getByRole('heading', { name: t('个人画像'), exact: true }).waitFor();
      // Profile sections: buttons on desktop, a select on phones.
      const portraitSection = async (value, zh, english) => {
        const nav = page.getByRole('navigation', { name: t('个人画像栏目') });
        if (await nav.isVisible())
          await nav.getByRole('button', { name: lang === 'en' ? english : zh, exact: true }).click();
        else await page.locator('.portrait-mobile-sections select').selectOption(value, { force: true });
      };
      await shot('memory');
      await portraitSection('products', '商品与服务', 'Products & services');
      await page.locator('.memory-row').first().waitFor();
      await shot('memory-products');
      await page
        .locator('.memory-row')
        .filter({ hasText: lang === 'en' ? 'Fresh milk 1L' : '鲜牛奶 1L' })
        .getByRole('button')
        .first()
        .click();
      await page.locator('.memory-detail form').waitFor();
      await audit('memory-detail');
      for (const summary of await page.locator('.memory-detail summary').all()) await summary.click();
      await audit('memory-detail-expanded');
      await portraitSection('history', '学习记录', 'History');
      await audit('memory-history');
      await portraitSection('settings', '学习与隐私', 'Learning & privacy');
      await page.getByText(t('记忆模型配置与运行统计（管理员）'), { exact: true }).click();
      await audit('memory-settings');
      await navigate('记一笔');
      await shot('intake');
      const draftsRegion = page.getByRole('region', { name: t('核对草稿') });
      const itemsEditor = draftsRegion.getByRole('group', { name: t('商品与优惠费用'), exact: true }).first();
      await draftsRegion.scrollIntoViewIfNeeded();
      await draftsRegion.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await shot('draft');
      await draftsRegion.getByRole('button', { name: t('修改'), exact: true }).click();
      const draftDialog = page.getByRole('dialog');
      await draftDialog.getByText(t('小熊填'), { exact: true }).first().waitFor();
      await shot('draft-edit');
      await draftDialog.getByRole('button', { name: t('取消'), exact: true }).click();
      if (!(await itemsEditor.count()))
        await draftsRegion
          .getByText(lang === 'en' ? 'Milk & vegetables' : '牛奶与蔬菜', { exact: true })
          .first()
          .click();
      await itemsEditor.scrollIntoViewIfNeeded();
      await itemsEditor.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await shot('line-items');
      const draftAmount = draftsRegion.getByPlaceholder(t('请补充金额'));
      const originalAmount = await draftAmount.inputValue();
      await draftAmount.fill('');
      assert.equal(
        await draftsRegion.getByRole('button', { name: t('记入'), exact: true }).isDisabled(),
        true,
      );
      await draftsRegion.getByRole('button', { name: t('← 返回草稿列表'), exact: true }).click();
      await draftsRegion.evaluate(el => el.scrollIntoView({ block: 'start' }));
      await shot('draft-missing');
      await draftsRegion
        .getByText(lang === 'en' ? 'Milk & vegetables' : '牛奶与蔬菜', { exact: true })
        .first()
        .click();
      await draftAmount.fill(originalAmount);
      assert.equal(
        await draftsRegion.getByRole('button', { name: t('记入'), exact: true }).isEnabled(),
        true,
      );
      await page.getByRole('button', { name: t('手动填写'), exact: true }).click();
      await page
        .getByRole('group', { name: t('录入方式') })
        .evaluate(el => el.scrollIntoView({ block: 'start' }));
      await shot('manual');
      const manualForm = page.getByRole('form', { name: t('手动记账') });
      await manualForm
        .getByRole('textbox', { name: t('金额（元）').replace('CNY', 'USD'), exact: true })
        .fill('1.23');
      await manualForm.getByRole('button', { name: t('保存并再记'), exact: true }).click();
      await page.getByRole('button', { name: t('撤销'), exact: true }).click();
      const undoResponse = page.waitForResponse(
        r => r.request().method() === 'DELETE' && r.url().includes('/transactions'),
      );
      await page
        .getByRole('dialog')
        .getByRole('button', { name: t('确认'), exact: true })
        .click();
      assert.equal((await undoResponse).ok(), true);
      await navigate('记一笔');
      await page.getByRole('button', { name: t('家庭往来'), exact: true }).click();
      await shot('family-entry');
      await page
        .getByRole('button', { name: t('查看详情'), exact: true })
        .first()
        .click();
      await page.getByRole('button', { name: t('修改私人记录') }).waitFor();
      const movementAmount = page.getByText(lang === 'en' ? '$84.00' : '¥84.00', { exact: true });
      assert.ok(
        await movementAmount.first().evaluate(el => el.getBoundingClientRect().right <= innerWidth),
        'Family movement amount clipped',
      );
      await shot('family-movement-detail');
      await page.getByRole('button', { name: t('← 返回往来记录') }).click();
      await page.getByRole('button', { name: t('记一笔往来'), exact: true }).click();
      await shot('family-entry-form');
      await navigate('小熊对话');
      await page.getByRole('button', { name: t('打开对话历史和报告'), exact: true }).click();
      await page
        .getByText(lang === 'en' ? 'Demo: prepare a grocery entry' : '演示：准备一笔买菜记录', {
          exact: true,
        })
        .click();
      await page.locator('.chat-action-card').waitFor();
      await settle();
      await page.locator('.finance-messages').evaluate(el => el.scrollTo(0, 0));
      await shot('assistant');
      await navigate('我的账本');
      await page.getByRole('button', { name: t('搜索整个账本系统'), exact: true }).click();
      await page
        .getByRole('textbox', { name: t('搜索关键词'), exact: true })
        .fill(lang === 'en' ? 'milk' : '牛奶');
      await settle();
      await shot('search');
      const keyword = page.getByRole('textbox', { name: t('搜索关键词') });
      await keyword.press('ArrowDown');
      const first = page.locator('summary:focus');
      assert.equal(await first.count(), 1);
      await first.press('Enter');
      assert.equal(await first.evaluate(el => el.parentElement.open), true);
      await first.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator('summary:focus').evaluate(el => el.parentElement.open), true);
      await context.close();
    }
  }
  await admin.end();
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, 'manifest.json'),
    JSON.stringify(
      {
        version: '2.0.0',
        capturedAt: new Date().toISOString(),
        data: 'Synthetic household. Seeded assistant and OCR drafts, no live model calls.',
        captures,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Captured ${captures.length} real app screenshots.`);
  if (process.env.SCREENSHOT_AUDIT)
    await writeFile(process.env.SCREENSHOT_AUDIT, JSON.stringify(untranslated, null, 2) + '\n');
  assert.deepEqual(untranslated, [], 'English demo UI contains untranslated labels');
} finally {
  await browser?.close();
  for (const service of services) {
    service.kill('SIGTERM');
  }
  docker('rm', '-f', container);
}
