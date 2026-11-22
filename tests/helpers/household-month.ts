import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';

// A synthetic November 2026 for one couple, covering every case the statistics bases treat differently
// (docs/refactor/STATS-BASIS.md). Amounts are cents. Ids are random; names are fixed.
export async function householdMonth(c: PoolClient) {
  const id = () => randomUUID();
  const me = id(),
    partner = id(),
    family = id(),
    myBook = id(),
    partnerBook = id(),
    shared = id(),
    myBank = id(),
    myCredit = id(),
    partnerBank = id(),
    familyWallet = id(),
    activity = id();
  for (const [u, name] of [
    [me, '我'],
    [partner, '伴侣'],
  ])
    await c.query("INSERT INTO users(id,username,name,password) VALUES($1::uuid,$1::text,$2,'unused')", [
      u,
      name,
    ]);
  await c.query("INSERT INTO families(id,name,owner_id) VALUES($1,'测试家庭',$2)", [family, me]);
  for (const u of [me, partner]) await c.query('INSERT INTO family_members VALUES($1,$2)', [family, u]);
  for (const [b, kind, name, owner, fam] of [
    [myBook, 'private', '我的账本', me, null],
    [partnerBook, 'private', '伴侣账本', partner, null],
    [shared, 'shared', '共同账本', me, family],
  ] as const)
    await c.query('INSERT INTO books(id,name,kind,owner_id,family_id) VALUES($1,$2,$3,$4,$5)', [
      b,
      name,
      kind,
      owner,
      fam,
    ]);
  for (const [b, u, role] of [
    [myBook, me, 'owner'],
    [partnerBook, partner, 'owner'],
    [shared, me, 'owner'],
    [shared, partner, 'editor'],
  ])
    await c.query('INSERT INTO members VALUES($1,$2,$3)', [b, u, role]);
  await c.query(
    `INSERT INTO accounts(id,name,type,owner_id,family_id,opening) VALUES
     ($1,'我的银行卡','bank',$5,NULL,1000000),($2,'我的信用卡','credit',$5,NULL,0),
     ($3,'伴侣银行卡','bank',$6,NULL,500000),($4,'家庭钱包','bank',NULL,$7,0)`,
    [myBank, myCredit, partnerBank, familyWallet, me, partner, family],
  );

  const tx = async (
    v: Partial<{
      book: string;
      account: string;
      target: string | null;
      kind: string;
      amount: number;
      date: string;
      category: string;
      by: string;
      refundOf: string;
      title: string;
    }>,
  ) => {
    const t = id();
    await c.query(
      `INSERT INTO transactions(id,book_id,account_id,target_id,kind,amount,date,category,created_by,refund_of,title)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        t,
        v.book,
        v.account,
        v.target ?? null,
        v.kind,
        v.amount,
        v.date,
        v.category ?? '其他',
        v.by ?? me,
        v.refundOf ?? null,
        v.title ?? '',
      ],
    );
    return t;
  };
  const movement = async (
    kind: string,
    from: string,
    to: string | null,
    source: string,
    target: string | null,
    amount: number,
    date: string,
  ) =>
    c.query(
      `INSERT INTO family_movements(id,family_id,sender_id,recipient_id,source_id,target_id,kind,amount,date,status,confirmed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',now())`,
      [id(), family, from, to, source, target, kind, amount, date],
    );

  // Me, private book
  await tx({
    book: myBook,
    account: myBank,
    kind: 'income',
    amount: 800000,
    date: '2026-11-05',
    category: '工资',
  });
  await tx({
    book: myBook,
    account: myBank,
    kind: 'expense',
    amount: 20000,
    date: '2026-11-06',
    category: '餐饮',
  });
  const creditBuy = await tx({
    book: myBook,
    account: myCredit,
    kind: 'expense',
    amount: 30000,
    date: '2026-11-08',
    category: '购物',
  });
  await tx({
    book: myBook,
    account: myCredit,
    kind: 'refund',
    amount: 5000,
    date: '2026-11-10',
    category: '购物',
    refundOf: creditBuy,
  });
  await tx({
    book: myBook,
    account: myBank,
    target: myCredit,
    kind: 'transfer',
    amount: 25000,
    date: '2026-11-20',
  });
  // Annual fee paid in November, spread over 12 months by the legacy single-entry allocation.
  const annual = await tx({
    book: myBook,
    account: myBank,
    kind: 'expense',
    amount: 120000,
    date: '2026-11-01',
    category: '会员',
  });
  await c.query(
    "INSERT INTO expense_allocations(transaction_id,start_month,months,period_unit,period_count,start_date) VALUES($1,'2026-11-01',12,'month',12,'2026-11-01')",
    [annual],
  );

  // Contributions to the family wallet, recorded both ways production has them.
  await movement('transfer', me, null, myBank, familyWallet, 100000, '2026-11-01');
  await tx({
    book: shared,
    account: partnerBank,
    target: familyWallet,
    kind: 'transfer',
    amount: 100000,
    date: '2026-11-01',
    by: partner,
  });
  // Family wallet pays a common bill; I pay a shared-book dinner from my own card (no claim).
  await tx({
    book: shared,
    account: familyWallet,
    kind: 'expense',
    amount: 40000,
    date: '2026-11-12',
    category: '居住',
    by: partner,
  });
  await tx({
    book: shared,
    account: myBank,
    kind: 'expense',
    amount: 60000,
    date: '2026-11-15',
    category: '餐饮',
  });
  // Gift from me to partner.
  await movement('gift', me, partner, myBank, partnerBank, 5000, '2026-11-18');
  // Partner's own spending.
  await tx({
    book: partnerBook,
    account: partnerBank,
    kind: 'expense',
    amount: 15000,
    date: '2026-11-09',
    category: '交通',
    by: partner,
  });
  // Balance correction entered on 11-25.
  await c.query(
    "INSERT INTO account_adjustments(id,account_id,amount,note,created_by,created_at,effective_date) VALUES($1,$2,3000,'对账补差',$3,'2026-11-25T10:00:00+08:00','2026-11-25')",
    [id(), myBank, me],
  );
  // P2-7: a partner correction recorded in December belongs to November.
  await c.query(
    "INSERT INTO account_adjustments(id,account_id,amount,note,created_by,created_at,effective_date) VALUES($1,$2,700,'补录',$3,'2026-12-02T10:00:00+08:00','2026-11-28')",
    [id(), partnerBank, partner],
  );
  // Activity covering the credit-card purchase and its refund.
  await c.query("INSERT INTO activities(id,owner_id,name,category) VALUES($1,$2,'双十一','购物')", [
    activity,
    me,
  ]);
  await c.query('INSERT INTO activity_entries(transaction_id,owner_id,activity_id) VALUES($1,$2,$3)', [
    creditBuy,
    me,
    activity,
  ]);

  return {
    me,
    partner,
    family,
    myBook,
    partnerBook,
    shared,
    myBank,
    myCredit,
    partnerBank,
    familyWallet,
    activity,
  };
}
