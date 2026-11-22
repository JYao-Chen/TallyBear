import { attachEntryInstallment } from '@/server/entry-installment';
import { itemCategoryError } from '@/lib/item-categories';
import { claimBookVisibility } from '@/server/claim-visibility';
import { inviteExpense } from '@/server/expense-claims';
import { assertClaimEditable } from '@/server/claim-access';
import { setEntryActivity } from '@/server/activities';
import {
  copyEntryReceipts,
  moveInTransaction,
  selectedGroup,
  withReceiptTransaction,
} from '@/server/move-entry';
import { linkReceipts } from '@/server/receipts';
import { checkVerification } from '@/lib/verification';
import { lockRelatedBooks, syncFinancialFacts } from '@/server/reuse';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, transaction } from '@/server/db';
import { member, Failure } from '@/server/auth';
import { entry } from '@/server/model';
import { checkCategory, checkItemCategories } from '@/server/categories';
import { validateActiveAccounts, accountAccess } from '@/server/accounts';
import { details } from '@/server/intake';
import { recordCategoryFeedback, persistMemoryFeedback } from '@/server/receipt-preferences';
import { lockBook, validateRefund, insertEntry } from '@/server/ledger';
import { type Route, methods, uuid } from '../handler';

export const routes: Route[] = [
  {
    method: 'GET',
    pattern: '/books/:book/transactions',
    auth: 'user',
    handler: async ({ user: u, query, params: { book } }) => {
      const month = query.get('month');
      const args: unknown[] = [book, u.id];
      let filter = query.has('id') ? '' : ' AND ' + claimBookVisibility();
      if (month) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Failure('月份无效');
        args.push(month + '-01');
        filter += " AND t.date >= $3::date AND t.date < $3::date+interval '1 month'";
      }
      if (query.has('id')) {
        args.push(uuid.parse(query.get('id')));
        filter += ' AND t.id=$' + args.length;
      }
      return NextResponse.json(
        (
          await db.query(
            "SELECT t.*,(SELECT ec.id FROM expense_claims ec WHERE ec.event_id=COALESCE(t.event_id,t.id) AND $2 IN(ec.sender_id,ec.recipient_id) AND ec.status IN ('pending','accepted') ORDER BY ec.created_at DESC LIMIT 1) AS claim_id,(SELECT ae.activity_id FROM activity_entries ae WHERE ae.transaction_id=t.id AND ae.owner_id=$2) AS activity_id,t.amount::float8 AS amount,to_char(t.date,'YYYY-MM-DD') AS date,a.name AS account_name,a.type AS account_type,a.holder AS account_holder,a.institution AS account_institution,a.suffix AS account_suffix,a.ownership AS account_ownership,(SELECT json_build_object('name',dest.name,'type',dest.type,'holder',dest.holder,'institution',dest.institution,'suffix',dest.suffix,'ownership',dest.ownership) FROM accounts dest WHERE dest.id=t.target_id) AS target_account,(SELECT name FROM accounts dest WHERE dest.id=t.target_id) AS target_name,u.name AS creator_name FROM transactions t JOIN accounts a ON a.id=t.account_id JOIN users u ON u.id=t.created_by WHERE t.book_id=$1 AND NOT t.deleted" +
              filter +
              ' ORDER BY t.date DESC,t.created_at DESC LIMIT 10000',
            args,
          )
        ).rows,
      );
    },
  },
  {
    method: 'POST',
    pattern: '/books/:book/transactions',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      const items = z
        .array(
          z
            .object({
              action: z.enum(['create', 'skip', 'merge']).default('create'),
              mergeId: uuid.optional(),
              mergeVersion: z.number().int().optional(),
            })
            .passthrough(),
        )
        .min(1)
        .max(1000)
        .parse(body.entries);
      const targetBook = body.targetBook ? uuid.parse(body.targetBook) : book;
      const destinations = new Map(
        items.map(raw => [raw.id, raw.targetBook ? uuid.parse(raw.targetBook) : targetBook]),
      );
      let added = 0,
        merged = 0;
      await withReceiptTransaction(async (c, copied) => {
        for (const id of [...new Set([book, ...destinations.values()])].sort()) await lockBook(c, id);
        const created: string[] = [];
        for (const raw of [...items].sort(
          (a, b) => Number(a.kind === 'refund') - Number(b.kind === 'refund'),
        )) {
          if (raw.action === 'skip') continue;
          if (raw.action === 'merge') {
            if (destinations.get(raw.id) !== book)
              throw new Failure('补充已有记录请保留原账本，随后使用整理账单移动');
            if (!raw.mergeId || !raw.mergeVersion) throw new Failure('请选择要补充的已有记录');
            const d = z
              .object({
                ...details,
                payee: z.string().max(120).default(''),
                category: z.string().max(60).default('其他'),
                note: z.string().max(2000).default(''),
                externalId: z.string().max(200).optional(),
              })
              .parse(raw);
            const old = (
              await c.query(
                'SELECT * FROM transactions WHERE book_id=$1 AND id=$2 AND version=$3 AND NOT deleted',
                [book, raw.mergeId, raw.mergeVersion],
              )
            ).rows[0];
            if (!old) throw new Failure('原记录已改变，请重新检查重复', 409);
            await assertClaimEditable(c, raw.mergeId!, u.id);
            if (!old.title && d.title)
              await c.query('UPDATE transactions SET title=$1 WHERE id=$2', [d.title, raw.mergeId]);
            if (raw.activityId !== undefined)
              await setEntryActivity(
                c,
                u.id,
                book,
                raw.mergeId,
                z.string().uuid().nullable().parse(raw.activityId),
              );
            // Enrichment never changes an existing amount, account, date or transaction type.
            checkVerification(
              old.line_items?.length ? old.line_items : d.lineItems,
              Number(old.amount),
              d.verificationReason || old.verification_reason,
            );
            await linkReceipts(c, book, u.id, raw.mergeId!, d.attachmentIds, d.retainReceipts);
            await linkReceipts(c, book, u.id, raw.mergeId!, d.photoIds, true, 'photo');
            if (d.verificationReason)
              await c.query('UPDATE transactions SET verification_reason=$1 WHERE id=$2', [
                d.verificationReason,
                raw.mergeId,
              ]);
            const finalExternalId = old.external_id || d.externalId || null;
            if (
              finalExternalId &&
              (
                await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND external_id=$2 AND id<>$3', [
                  book,
                  finalExternalId,
                  raw.mergeId,
                ])
              ).rowCount
            )
              throw new Failure('这个交易流水号已用于另一笔账目，请核对后再保存');
            const finalCategory = old.category === '其他' ? d.category : old.category;
            const result = await c.query(
              'UPDATE transactions SET product=$1,order_id=$2,platform=$3,occurred_at=$4,note=$5,payee=$6,category=$7,line_items=$10::jsonb,external_id=$11,version=version+1 WHERE book_id=$8 AND id=$9',
              [
                old.product || d.product,
                old.order_id || d.orderId,
                old.platform || d.platform,
                old.occurred_at || d.occurredAt,
                old.note || d.note,
                old.payee || d.payee,
                finalCategory,
                book,
                raw.mergeId,
                JSON.stringify(old.line_items?.length ? old.line_items : d.lineItems),
                finalExternalId,
              ],
            );
            await c.query('UPDATE transactions SET scene=$1::jsonb WHERE id=$2', [
              JSON.stringify({
                ...d.scene,
                ...Object.fromEntries(
                  Object.entries(old.scene || {}).filter(([k, v]) => v && !(k === 'type' && v === 'general')),
                ),
              }),
              raw.mergeId,
            ]);
            merged += result.rowCount || 0;
            if (result.rowCount && (old.kind === 'expense' || old.kind === 'income'))
              await recordCategoryFeedback(
                c,
                book,
                u.id,
                { id: raw.mergeId, category: finalCategory, categorySuggestion: d.categorySuggestion },
                old.category,
              );
            if (old.kind === 'expense')
              await c.query(
                'UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND refund_of=$3 AND NOT deleted',
                [finalCategory, book, raw.mergeId],
              );
            await attachEntryInstallment(c, book, u.id, raw.mergeId!, d.installment);
            continue;
          }
          const e = entry.parse(raw),
            destination = destinations.get(raw.id)!;
          if (e.kind === 'refund' && e.refundOf && destination !== book && !created.includes(e.refundOf)) {
            await member(destination, u, true);
            Object.assign(e, await copyEntryReceipts(c, book, destination, u.id, e, copied));
            added += await insertEntry(c, destination, u.id, e);
            continue;
          }
          const count = await insertEntry(c, book, u.id, e);
          added += count;
          if (count) created.push(e.id);
        }
        const groups = new Map<string, Awaited<ReturnType<typeof selectedGroup>>>();
        for (const id of created) {
          const dest = destinations.get(id)!;
          if (dest === book) continue;
          const rows = await selectedGroup(c, book, [id]);
          if (rows.some(r => created.includes(r.id) && destinations.get(r.id) !== dest))
            throw new Failure('同一笔原消费与退款请选择相同账本');
          if (dest !== book) {
            const previous = groups.get(dest) || [];
            groups.set(dest, [...new Map([...previous, ...rows].map(r => [r.id, r])).values()]);
          }
        }
        for (const [dest, rows] of groups) await moveInTransaction(c, book, u.id, dest, rows, copied);
      });
      return NextResponse.json({ added, merged, skipped: items.length - added - merged });
    },
  },
  {
    method: 'PUT',
    pattern: '/books/:book/transactions',
    auth: 'user',
    handler: async ({ user: u, body, params: { book } }) => {
      const targetBook = body.targetBook ? uuid.parse(body.targetBook) : book;
      const e = entry.parse(body);
      checkVerification(e.lineItems, e.amount, e.verificationReason);
      const version = z.number().int().parse(body.version);
      const result = await withReceiptTransaction(async (c, copied) => {
        await lockRelatedBooks(c, book, e.id, u.id, targetBook);
        await assertClaimEditable(c, e.id, u.id);
        const previous = (
          await c.query(
            "SELECT account_id,target_id,category,line_items,verification_reason,amount::float8 AS amount,kind,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE book_id=$1 AND id=$2",
            [book, e.id],
          )
        ).rows[0];
        if (body.lineItems === undefined && previous) e.lineItems = previous.line_items;
        if (body.verificationReason === undefined && previous)
          e.verificationReason = previous.verification_reason;
        checkVerification(e.lineItems, e.amount, e.verificationReason);
        const categoryError = itemCategoryError(e.lineItems, e.amount, e.category);
        if (categoryError) throw new Failure(categoryError);
        await validateActiveAccounts(
          c,
          book,
          e,
          u.id,
          previous ? [previous.account_id, previous.target_id].filter(Boolean) : [],
        );
        if (
          previous &&
          (previous.amount !== e.amount ||
            previous.kind !== e.kind ||
            previous.date !== e.date ||
            previous.account_id !== e.accountId ||
            previous.target_id !== (e.targetId || null))
        ) {
          if (
            (
              await c.query(
                `SELECT 1 FROM accounts a WHERE a.id=ANY($1::uuid[]) AND NOT ${accountAccess('$2')}`,
                [[previous.account_id, previous.target_id].filter(Boolean), u.id],
              )
            ).rowCount
          )
            throw new Failure('只有资产所有者或家庭成员可以修改实际收付款信息', 403);
          await validateActiveAccounts(c, book, e, u.id);
        }
        const refundBook =
          e.kind === 'refund' &&
          e.refundOf &&
          targetBook !== book &&
          (
            await c.query(
              "SELECT 1 FROM transactions WHERE id=$1 AND book_id=$2 AND kind='expense' AND NOT deleted",
              [e.refundOf, targetBook],
            )
          ).rowCount
            ? targetBook
            : book;
        if (refundBook !== book) await member(refundBook, u, true);
        await validateRefund(c, refundBook, e);
        await checkCategory(c, u.id, e.category, previous?.category);
        await checkItemCategories(c, u.id, e.lineItems, previous?.line_items);
        await syncFinancialFacts(c, book, e, u.id);
        if (
          e.externalId &&
          (
            await c.query('SELECT 1 FROM transactions WHERE book_id=$1 AND external_id=$2 AND id<>$3', [
              book,
              e.externalId,
              e.id,
            ])
          ).rowCount
        )
          throw new Failure('这个交易流水号已用于另一笔账目，请核对后再保存');
        const r = await c.query(
          'UPDATE transactions SET account_id=$1,target_id=$2,kind=$3,amount=$4,date=$5,payee=$6,category=$7,note=$8,product=$12,platform=$13,order_id=$14,occurred_at=$15,refund_of=$16,line_items=COALESCE($17::jsonb,line_items),external_id=$18,version=version+1 WHERE id=$9 AND book_id=$10 AND version=$11 AND NOT deleted RETURNING version',
          [
            e.accountId,
            e.kind === 'transfer' ? e.targetId : null,
            e.kind,
            e.amount,
            e.date,
            e.payee,
            e.category,
            e.note,
            e.id,
            book,
            version,
            e.product,
            e.platform,
            e.orderId,
            e.occurredAt,
            e.refundOf || null,
            body.lineItems === undefined ? null : JSON.stringify(e.lineItems),
            e.externalId || null,
          ],
        );
        if (!r.rowCount) throw new Failure('记录已被其他成员修改，请刷新后再试', 409);
        await c.query(
          'UPDATE transactions SET verification_reason=$1,title=COALESCE($3,title),scene=COALESCE($4::jsonb,scene) WHERE id=$2',
          [
            e.verificationReason,
            e.id,
            body.title === undefined ? null : e.title,
            body.scene === undefined ? null : JSON.stringify(e.scene),
          ],
        );
        if (e.activityId !== undefined) await setEntryActivity(c, u.id, book, e.id, e.activityId);
        await linkReceipts(c, book, u.id, e.id, e.attachmentIds, e.retainReceipts);
        await linkReceipts(c, book, u.id, e.id, e.photoIds, true, 'photo');
        if (previous?.category !== e.category && (e.kind === 'expense' || e.kind === 'income'))
          await recordCategoryFeedback(c, book, u.id, e, previous.category);
        else
          await persistMemoryFeedback(c, {
            id: e.id,
            ...(body.memorySuggestions !== undefined ? { memorySuggestions: e.memorySuggestions } : {}),
          });
        if (e.kind === 'expense')
          await c.query(
            'UPDATE transactions SET category=$1,version=version+1 WHERE book_id=$2 AND refund_of=$3 AND NOT deleted',
            [e.category, book, e.id],
          );
        if (targetBook !== book)
          await moveInTransaction(
            c,
            book,
            u.id,
            targetBook,
            refundBook !== book
              ? (await c.query('SELECT * FROM transactions WHERE id=$1 AND book_id=$2', [e.id, book])).rows
              : await selectedGroup(c, book, [e.id]),
            copied,
          );
        if (e.claimRecipientId !== undefined) await inviteExpense(c, u.id, e.id, e.claimRecipientId);
        await attachEntryInstallment(c, targetBook, u.id, e.id, e.installment);
        return {
          ...r.rows[0],
          ...(e.installment
            ? {
                version: (await c.query('SELECT version FROM transactions WHERE id=$1', [e.id])).rows[0]
                  .version,
              }
            : {}),
          book: targetBook,
        };
      });
      return NextResponse.json(result);
    },
  },
  ...methods(['PATCH', 'DELETE'], {
    pattern: '/books/:book/transactions',
    auth: 'user',
    handler: async ({ user: u, body, params: { book }, req }) => {
      const b = z
        .object({ id: uuid, version: z.number().int(), deleted: z.boolean().optional() })
        .parse(body);
      const deleted = req.method === 'DELETE' ? true : (b.deleted ?? false);
      const result = await transaction(async c => {
        await lockBook(c, book);
        await assertClaimEditable(c, b.id, u.id);
        const assetEntry = (
          await c.query(
            'SELECT account_id AS "accountId",target_id AS "targetId",kind FROM transactions WHERE id=$1 AND book_id=$2',
            [b.id, book],
          )
        ).rows[0];
        if (assetEntry)
          await validateActiveAccounts(
            c,
            book,
            assetEntry,
            u.id,
            [assetEntry.accountId, assetEntry.targetId].filter(Boolean),
          );
        if (deleted) {
          const links = await c.query(
            'SELECT id FROM transactions WHERE book_id=$1 AND refund_of=$2 AND NOT deleted',
            [book, b.id],
          );
          if (links.rowCount) throw new Failure('原消费关联了退款，请先处理退款记录');
        } else {
          const row = (
            await c.query(
              `SELECT *,account_id AS "accountId",target_id AS "targetId",refund_of AS "refundOf",amount::float8 AS amount,to_char(date,'YYYY-MM-DD') AS date FROM transactions WHERE book_id=$1 AND id=$2`,
              [book, b.id],
            )
          ).rows[0];
          if (row) await validateRefund(c, book, row);
        }
        const r = await c.query(
          'UPDATE transactions SET deleted=$1,version=version+1 WHERE id=$2 AND book_id=$3 AND version=$4 RETURNING version',
          [deleted, b.id, book, b.version],
        );
        if (!r.rowCount) throw new Failure('记录已被其他成员修改，请刷新后再试', 409);
        return r.rows[0];
      });
      return NextResponse.json(result);
    },
  }),
];
